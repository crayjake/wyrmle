import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dailySchedule, decodeScheduledPuzzle, latestScheduledPuzzle, scheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { shiftPuzzleId } from '../src/daily/date.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { validateBingo } from '../scripts/bingo/validate.ts'
import { certifyProgression } from '../scripts/antonyms/progression.ts'
import previousSchedule from '../artifacts/bingo-hunt-daily-2026-09-29/previous-schedule.json' with { type: 'json' }
import { inspectHuntRemovals } from '../scripts/antonyms/hunt.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { wordEffort } from '../scripts/bingo/routeDifficulty.ts'

test('the active queue preserves played dates and switches every upcoming date to Bingo Hunt', () => {
  assert.deepEqual(dailySchedule.filter(entry => entry.date < '2026-09-29'), previousSchedule.filter(entry => entry.date < '2026-09-29'))
  const upcoming = dailySchedule.filter(entry => entry.date >= '2026-09-29')
  assert.equal(upcoming.length, 6)
  assert.ok(upcoming.every(entry => entry.bingoHunt))
  assert.equal(upcoming[0].enemy, 'OLD')
})

test('the queued bingo-first dailies have replayed one-, two- and three-guess wins', () => {
  assert.equal(new Set(dailySchedule.map(entry => entry.enemy)).size, dailySchedule.length)
  const answers = new Set<string>()
  for (const [index, entry] of dailySchedule.entries()) {
    assert.equal(entry.date, shiftPuzzleId(dailySchedule[0].date, index))
    assert.equal(entry.method, 'bingo-first')
    const data = JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8'))
    const digest = createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 12)
    assert.ok(entry.asset.endsWith(`-${digest}.json`), 'Asset must be immutable and content addressed')
    const report = JSON.parse(readFileSync(entry.report ?? `artifacts/daily-month-${dailySchedule[0].date}/${entry.id}.json`, 'utf8'))
    assert.equal(report.accepted, true)
    assert.equal(report.asset, entry.asset)
    assert.ok(!answers.has(report.answer)); answers.add(report.answer)
    const encounter = decodeScheduledPuzzle(data, entry)
    assert.equal(encounter.startingResolve, 3)
    if (entry.bingoHunt) {
      assert.equal(encounter.refillQueue, '')
      assert.equal(encounter.counterRules?.kind, 'antonym')
      const proof = inspectHuntRemovals(encounter, report.removalProof.preferredHelpers)
      assert.ok(proof.minPreferredFamilies >= 1)
      assert.deepEqual(proof.branches, report.removalProof.branches)
      assert.ok(report.startingBingos.every((bingo: { word: string }) => wordEffort(bingo.word) >= report.helperEffort + .4))
      assert.deepEqual(report.witnesses.map((words: string[]) => words.length), [1, 2, 3])
      const play = (words: string[]) => {
        let state = createLetterStrikeGame(encounter)
        for (const word of words) {
          const ids = selectWordIds(state.tiles, word)
          assert.ok(ids, `${entry.enemy}: ${word} after ${state.playedWords.map(move => move.word)}`)
          state = submitLetterStrike(state, ids)
          assert.equal(state.error, null)
        }
        assert.equal(state.status, 'won')
        assert.equal(state.playedWords.length, words.length)
      }
      report.witnesses.forEach(play)
      let checked = 0
      for (const branch of proof.branches) for (const second of branch.next) {
        play([branch.first, second, report.answer]); checked++
      }
      assert.equal(checked, report.removalProof.pathsChecked)
      continue
    }
    assert.ok(encounter.enemyLetters.reduce((sum, letter) => sum + letter.initialHits, 0) > 3, 'Neutral single hits must not solve the puzzle')
    if (encounter.counterRules) {
      const proof = certifyProgression(encounter, report.progression.routes.map((route: { words: string[] }) => route.words))
      assert.deepEqual(proof.issues, [])
    } else validateBingo(encounter, report.answer, report.analysis)
    assert.ok(report.twoWordWin, `${entry.id}: two-life challenge needs an ordinary win`)
    let state = createLetterStrikeGame({ ...encounter, startingResolve: 2 })
    for (const [turn, ids] of report.twoWordWin.tileIds.entries()) {
      state = submitLetterStrike(state, ids)
      assert.equal(state.error, null)
      assert.equal(state.playedWords.at(-1)?.word, report.twoWordWin.words[turn])
    }
    assert.equal(state.status, 'won')
    assert.equal(state.playedWords.length, 2)
  }
})

test('schedule lookup does not repeat a new result under a fabricated future date', () => {
  assert.equal(scheduledPuzzle('2099-01-01'), undefined)
  assert.equal(latestScheduledPuzzle('2099-01-01')?.date, dailySchedule.at(-1)?.date)
  assert.equal(latestScheduledPuzzle('2000-01-01'), undefined)
  assert.equal(scheduledPuzzle(dailySchedule[0].date)?.id, dailySchedule[0].id)
})

test('daily loader rejects a mismatched or special-tile file', () => {
  const entry = dailySchedule[0]
  const data = JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8'))
  assert.throws(() => decodeScheduledPuzzle({ ...data, method: 'old-generator' }, entry), /schedule/)
  assert.throws(() => decodeScheduledPuzzle({ ...data, id: 'other-day' }, entry), /schedule/)
  assert.throws(() => decodeScheduledPuzzle(data, { ...entry, bingoHunt: true }), /schedule/)
  data.encounter.startingTiles[0].type = 'gem'
  assert.throws(() => decodeScheduledPuzzle(data, entry), /schedule/)
})

test('tomorrow pins age adjectives without treating nouns as manufactured comparatives', () => {
  const entry = scheduledPuzzle('2026-09-29')!
  const encounter = decodeScheduledPuzzle(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')), entry)
  for (const word of ['ADOLESCENT', 'YOUNG', 'YOUNGER', 'YOUNGEST', 'TEEN', 'TEENAGE', 'TEENAGED', 'TENDER', 'EARLY', 'UNDERAGE']) {
    assert.equal(encounter.meaningLexicon!.words[word]?.relation, 'opposite', word)
    assert.deepEqual(encounter.meaningLexicon!.words[word].partsOfSpeech, ['adjective'], word)
  }
  for (const word of ['TEENAGER', 'TEENER', 'AGED', 'RECENT']) {
    assert.equal(encounter.meaningLexicon!.words[word]?.relation, 'unrelated', word)
  }
})

test('queued DIM rejects LITER as a noun while keeping LIT as an adjective counter', () => {
  const entry = dailySchedule.find(entry => entry.enemy === 'DIM')!
  const encounter = decodeScheduledPuzzle(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')), entry)
  assert.equal(encounter.meaningLexicon!.words.LIT.relation, 'opposite')
  assert.equal(encounter.meaningLexicon!.words.LITER.relation, 'unrelated')
  assert.deepEqual(encounter.meaningLexicon!.words.LITER.partsOfSpeech, ['noun'])
})
