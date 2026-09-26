import assert from 'node:assert/strict'
import test from 'node:test'
import { createLetterStrikeGame, previewLetterStrike } from '../src/game/letterStrike.ts'
import { getStrikeSummary } from '../src/components/strikeSummary.ts'
import { createTutorial, getTutorialMove } from './fixtures/archivedTutorial.ts'

function preview(step: Parameters<typeof createTutorial>[0]) {
  const state = createTutorial(step)
  return previewLetterStrike(state.game, getTutorialMove(state)!.tileIds)
}

test('a counter preview names the enemy, reports actual matching hits and avoids life-cost boilerplate', () => {
  const summary = getStrikeSummary(preview('counter'), 5, 'SAD')!
  assert.equal(summary.meaning, 'Counters SAD')
  assert.equal(summary.hits, '2 hits')
  assert.deepEqual(summary.details, [])
})

test('a LIFE move names the saved life without a redundant unchanged life counter', () => {
  const summary = getStrikeSummary(preview('ward'), 3, 'SAD')!
  assert.deepEqual(summary.details, [{ kind: 'life', text: 'Life saved' }])
})

test('guaranteed matching hits are identified without promising an extra +1', () => {
  const summary = getStrikeSummary(preview('strike'), 5, 'SAD')!
  assert.equal(summary.meaning, 'Similar meaning')
  assert.equal(summary.hits, '1 hit')
  assert.deepEqual(summary.details, [{ kind: 'hit', text: 'Hit tile' }])
})

test('revive explains the actual recovery while a harmless revive tile adds no warning', () => {
  const move = preview('regen-dead')
  assert.deepEqual(getStrikeSummary(move, 4, 'FEAR')!.details, [{ kind: 'revive', text: 'Revive: E returns' }])
  assert.deepEqual(getStrikeSummary({ ...move, recoveries: [] }, 4, 'FEAR')!.details, [])
})

test('last-life warning appears only when that move leaves an enemy alive', () => {
  const counter = preview('counter')
  assert.ok(getStrikeSummary(counter, 1, 'SAD')!.details.some(detail => detail.kind === 'last-life'))
  const finish = preview('neutral')
  assert.deepEqual(getStrikeSummary(finish, 1, 'SAD')!.details, [])
})

test('archived previews retain real grammar and length effects; invalid selections show no summary', () => {
  assert.deepEqual(getStrikeSummary(preview('grammar'), 5)!.details, [{ kind: 'legacy', text: 'adjective +1' }])
  assert.deepEqual(getStrikeSummary({ ...preview('grammar'), grammaticalModifier: -1 }, 5)!.details,
    [{ kind: 'legacy-resisted', text: 'adjective -1' }])
  assert.deepEqual(getStrikeSummary(preview('long'), 5)!.details, [{ kind: 'legacy', text: 'Long +1' }])
  assert.equal(getStrikeSummary(previewLetterStrike(createLetterStrikeGame())), null)
})
