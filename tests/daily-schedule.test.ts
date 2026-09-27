import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dailySchedule, decodeScheduledPuzzle, latestScheduledPuzzle, scheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { shiftPuzzleId } from '../src/daily/date.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { validateBingo } from '../scripts/bingo/validate.ts'

test('the queued bingo-first dailies have replayed one-, two- and three-life wins', () => {
  assert.ok(dailySchedule.length >= 30)
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
    assert.ok(encounter.enemyLetters.reduce((sum, letter) => sum + letter.initialHits, 0) > 3, 'Neutral single hits must not solve the puzzle')
    validateBingo(encounter, report.answer, report.analysis)
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
  data.encounter.startingTiles[0].type = 'gem'
  assert.throws(() => decodeScheduledPuzzle(data, entry), /schedule/)
})
