import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { availableMonths, calendarDays, puzzleLocation } from '../src/daily/calendar.ts'
import { archivedPuzzles, dailySchedule, decodeScheduledPuzzle, puzzleSchedule } from '../src/daily/scheduledPuzzle.ts'
import { migrateArchiveProgress } from '../src/daily/archiveProgress.ts'
import { challengeKey, openChallenge, readChallenge, restartChallenge, saveChallenge } from '../src/daily/challengeProgress.ts'
import { bingoProgressKey, saveBingoAttempt } from '../src/experimental/bingo/progress.ts'
import { getPuzzleGuide } from '../src/daily/guides.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { moreBingoProfiles } from '../scripts/bingo/moreProfiles.ts'
import { bingoProfileVersion } from '../scripts/bingo/meanings.ts'
import { validateBingo } from '../scripts/bingo/validate.ts'
import { getMeaningSense, getWordMeanings } from '../scripts/lib/wordMeanings.ts'

function storage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const play = (state: ReturnType<typeof createLetterStrikeGame>, word: string) => submitLetterStrike(state, selectWordIds(state.tiles, word)!)

test('calendar uses correct Monday-first dates, leap years, and only released months', () => {
  assert.deepEqual(calendarDays('2026-09').slice(0, 3), [null, '2026-09-01', '2026-09-02'])
  assert.ok(calendarDays('2024-02').includes('2024-02-29'))
  assert.ok(!calendarDays('2026-02').includes('2026-02-29'))
  assert.equal(calendarDays('2026-03').length, 42)
  assert.deepEqual(calendarDays('2026-13'), [])
  assert.deepEqual(availableMonths('2026-09-26'), ['2026-09'])
  assert.deepEqual(availableMonths('2026-10-25'), ['2026-09', '2026-10'])
  assert.equal(new Set(puzzleSchedule.map(entry => entry.date)).size, puzzleSchedule.length)
  assert.ok(archivedPuzzles.every(entry => entry.date < dailySchedule[0].date))
  assert.equal(archivedPuzzles.filter(entry => entry.legacyBetaId).length, 10)
})

test('beta links redirect to the corresponding archive date or the calendar', () => {
  for (const entry of archivedPuzzles.filter(entry => entry.legacyBetaId)) assert.equal(puzzleLocation(`?preview=${entry.legacyBetaId}&lives=5`).date, entry.date)
  for (const query of ['?preview=bingos', '?preview=bingo', '?preview=bingo-missing']) assert.equal(puzzleLocation(query).replacement, '?calendar')
  assert.equal(puzzleLocation('').calendar, false)
  assert.equal(puzzleLocation('?calendar=2026-09').month, '2026-09')
})

test('migrating beta progress preserves stars, unfinished moves, hints and original saves', () => {
  for (const lives of [3, 4, 5] as const) {
    const store = storage(), entry = archivedPuzzles.find(entry => entry.enemy === 'ARID')!
    const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
    const initial = createLetterStrikeGame({ ...encounter, startingResolve: lives })
    const sourceKey = bingoProgressKey(entry)
    saveBingoAttempt(sourceKey, play(initial, getPuzzleGuide(entry.id)!.answer), true, 4, store)
    const ongoing = play(initial, 'WATER')
    saveBingoAttempt(sourceKey, ongoing, true, 2, store)
    const original = store.getItem(sourceKey)
    migrateArchiveProgress(store)
    const migrated = openChallenge(entry.date, entry.asset, encounter, store)
    assert.equal(migrated.record.bestWords, 1)
    assert.equal(migrated.game.encounter.startingResolve, lives)
    assert.deepEqual(migrated.game.playedWords, ongoing.playedWords)
    assert.equal(migrated.hintStep, 2)
    assert.equal(store.getItem(sourceKey), original)
    const updated = saveChallenge(migrated.record, migrated.game, true, store, 3)
    const saved = store.getItem(challengeKey(entry.date))
    migrateArchiveProgress(store)
    assert.equal(store.getItem(challengeKey(entry.date)), saved, 'Migration must never replace newer progress')
    assert.equal(restartChallenge(updated, store).run.lives, 1)
  }
})

test('historical four/five-word wins remain honestly recorded and failed writes leave sources intact', () => {
  const store = storage(), entry = archivedPuzzles.find(entry => entry.enemy === 'ARID')!, sourceKey = bingoProgressKey(entry)
  const source = JSON.stringify({ version: 1, bestWords: 5, runs: {} })
  store.setItem(sourceKey, source)
  assert.throws(() => migrateArchiveProgress({ getItem: store.getItem, setItem: () => { throw new Error('quota') } }), /quota/)
  assert.equal(store.getItem(sourceKey), source)
  migrateArchiveProgress(store)
  assert.equal(readChallenge(entry.date, store)?.bestWords, 5)
})

test('all calendar dates have three progressive hints and a replayed winning reveal', () => {
  for (const entry of puzzleSchedule) {
    const guide = getPuzzleGuide(entry.id)
    assert.ok(guide, entry.id)
    assert.equal(guide.hints.length, 3)
    assert.equal(new Set(guide.hints).size, 3)
    assert.ok(guide.hints.every(hint => hint.length > 10 && !hint.toUpperCase().includes(guide.answer)))
    const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
    const game = createLetterStrikeGame({ ...encounter, startingResolve: 1 })
    assert.equal(play(game, guide.answer).status, 'won', entry.id)
  }
})

test('five fresh bingo-first boards retain source senses and replay diverse non-bingo routes', () => {
  for (const profile of moreBingoProfiles) {
    const entry = archivedPuzzles.find(entry => entry.enemy === profile.enemy)!
    const report = read(`artifacts/bingo-first-more-2026-09-26/${profile.enemy.toLowerCase()}.json`)
    const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
    assert.equal(report.method, 'bingo-first'); assert.equal(report.accepted, true)
    assert.equal(encounter.meaningLexicon!.profileVersion, bingoProfileVersion(profile))
    assert.equal(getPuzzleGuide(entry.id)?.answer, profile.bingo)
    assert.ok(getWordMeanings(profile.enemy).senses.some(sense => sense.id === profile.enemySense))
    for (const root of profile.roots) assert.equal(getMeaningSense(root.senseId)?.definition, root.definition)
    assert.equal(encounter.meaningLexicon!.words[profile.enemy]?.relation, 'similar')
    validateBingo(encounter, profile.bingo, report.analysis)
    let state = createLetterStrikeGame({ ...encounter, startingResolve: 2 })
    for (const [index, ids] of report.twoWordWin.tileIds.entries()) {
      state = submitLetterStrike(state, ids)
      assert.equal(state.error, null)
      assert.equal(state.playedWords.at(-1)?.word, report.twoWordWin.words[index])
    }
    assert.equal(state.status, 'won')
  }
})
