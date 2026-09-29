import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { availableMonths, calendarDays, puzzleLocation } from '../src/daily/calendar.ts'
import { archivedPuzzles, dailySchedule, decodeScheduledPuzzle, puzzleSchedule } from '../src/daily/scheduledPuzzle.ts'
import { migrateArchiveProgress } from '../src/daily/archiveProgress.ts'
import { challengeKey, openChallenge, readChallenge, restartChallenge, saveChallenge } from '../src/daily/challengeProgress.ts'
import { saveBingoAttempt } from '../src/experimental/bingo/progress.ts'
import { getPuzzleGuide } from '../src/daily/guides.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { avoidsLessAnswer } from '../scripts/puzzles/profiles.ts'
function storage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const play = (state: ReturnType<typeof createLetterStrikeGame>, word: string, hardGuess = false) => submitLetterStrike(state, selectWordIds(state.tiles, word)!, { hardGuess })

test('calendar has real Monday-first dates and only released months', () => {
  assert.deepEqual(calendarDays('2026-09').slice(0, 3), [null, '2026-09-01', '2026-09-02'])
  assert.ok(calendarDays('2024-02').includes('2024-02-29'))
  assert.ok(!calendarDays('2026-02').includes('2026-02-29'))
  assert.equal(calendarDays('2026-03').length, 42)
  assert.deepEqual(calendarDays('2026-13'), [])
  assert.deepEqual(availableMonths('2026-10-25'), ['2026-09', '2026-10'])
  assert.equal(new Set(puzzleSchedule.map(entry => entry.date)).size, puzzleSchedule.length)
  assert.ok(archivedPuzzles.every(entry => entry.date < dailySchedule[0].date && entry.bingoHunt))
})
test('retired links lead to the matching archive, or calendar for excluded puzzles', () => {
  for (const entry of archivedPuzzles.filter(entry => entry.legacyConceptId)) {
    assert.equal(puzzleLocation(`?preview=concepts&puzzle=${entry.legacyConceptId}`).date, entry.date)
  }
  for (const query of ['?preview=bingos', '?preview=wheel', '?preview=concepts', '?preview=concepts&puzzle=hunt-wet', '?preview=concepts&puzzle=hunt-fear-armoured']) assert.equal(puzzleLocation(query).replacement, '?calendar')
  assert.equal(puzzleLocation('').calendar, false)
})
test('preview migration keeps moves, hard misses, hints, stars and original saves', () => {
  for (const completed of [false, true]) {
    const store = storage(), entry = archivedPuzzles.find(entry => entry.enemy === 'ALERT')!
    const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
    const initial = createLetterStrikeGame(encounter), sourceKey = entry.legacyProgressKey!
    if (completed) saveBingoAttempt(sourceKey, play(initial, getPuzzleGuide(entry.id)!.answer), true, 4, store)
    const ongoing = play(initial, 'CAT', true)
    assert.equal(ongoing.playedWords.length, 1)
    saveBingoAttempt(sourceKey, ongoing, true, 2, store)
    const original = store.getItem(sourceKey)
    migrateArchiveProgress(store)
    const migrated = openChallenge(entry.date, entry.asset, encounter, store)
    assert.equal(migrated.record.bestWords, completed ? 1 : null)
    assert.deepEqual(migrated.game.playedWords, ongoing.playedWords)
    assert.equal(migrated.hintStep, 2)
    assert.equal(migrated.record.run.moves[0].hardGuess, true)
    assert.equal(store.getItem(sourceKey), original)
    const saved = store.getItem(challengeKey(entry.date))
    migrateArchiveProgress(store)
    assert.equal(store.getItem(challengeKey(entry.date)), saved)
    assert.throws(() => restartChallenge(migrated.record, store), /one attempt/)
    if (completed) assert.throws(() => saveChallenge(migrated.record, play(migrated.game, 'SLOW'), true, store), /one attempt/)
  }
})
test('score-only migration locks a completed puzzle without inventing a solution or streak', () => {
  const store = storage(), entry = archivedPuzzles.find(entry => entry.enemy === 'ALERT')!, key = entry.legacyProgressKey!
  const source = JSON.stringify({ version: 1, bestWords: 2, runs: {} })
  store.setItem(key, source)
  assert.throws(() => migrateArchiveProgress({ getItem: store.getItem, setItem: () => { throw new Error('quota') } }), /quota/)
  assert.equal(store.getItem(key), source)
  migrateArchiveProgress(store)
  const saved = readChallenge(entry.date, store)!
  assert.equal(saved.bestWords, 2)
  assert.equal(saved.bestSolution, undefined)
  assert.equal(saved.wonOn, undefined)
  assert.throws(() => restartChallenge(saved, store), /one attempt/)
})
test('every active puzzle is the current mode, has hints and a non-less winning answer', () => {
  for (const entry of puzzleSchedule) {
    const guide = getPuzzleGuide(entry.id)!
    assert.ok(guide, entry.id)
    assert.equal(guide.hints.length, 3)
    assert.equal(new Set(guide.hints).size, 3)
    assert.ok(avoidsLessAnswer(guide.answer), entry.id)
    const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
    assert.ok(encounter.bingoHunt)
    assert.equal(encounter.counterRules?.kind, 'antonym')
    assert.equal(encounter.refillQueue, '')
    assert.ok(encounter.startingTiles.every(tile => tile.type === 'normal'))
    const won = play(createLetterStrikeGame(encounter), guide.answer)
    assert.equal(won.status, 'won', entry.id)
    assert.equal(won.playedWords.length, 1)
  }
})
