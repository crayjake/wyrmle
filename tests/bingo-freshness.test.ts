import assert from 'node:assert/strict'
import { test } from 'node:test'
import { freshnessIssues, mergeDailyWindow } from '../scripts/bingo/freshness.ts'
import type { PuzzleIdentity } from '../scripts/bingo/freshness.ts'

const previous: PuzzleIdentity = { id: 'old-false', enemy: 'FALSE', board: 'AACEEFFLLNNSSSTTU', bingos: ['FACTUALNESS'], bingoFamilies: ['FACTUALNESS'] }

test('new letters or refills cannot disguise a repeated bingo from an archived or retired puzzle', () => {
  const next = { ...previous, id: 'new-false', board: 'DIFFERENTLETTERS' }
  assert.match(freshnessIssues(next, [previous]).join(), /Bingo family/)
  assert.match(freshnessIssues({ ...next, enemy: 'LIE' }, [previous]).join(), /Bingo family/)
})

test('inflected bingos and identical letter multisets do not qualify as fresh', () => {
  const old = { ...previous, bingos: ['ORCHESTRATES'], bingoFamilies: ['ORCHESTRATE'] }
  const next = { ...old, id: 'new-chaos', board: 'DIFFERENTLETTERS', bingos: ['ORCHESTRATED'] }
  assert.match(freshnessIssues(next, [old]).join(), /Bingo family/)
  assert.match(freshnessIssues({ ...previous, bingoFamilies: ['FAITHFULNESS'] }, [previous]).join(), /Starting letter pool/)
})

test('an enemy can return only with a fresh bingo family and letter pool', () => {
  const next = { ...previous, id: 'fresh-false', board: 'AACEEFFHILLNSSTTU', bingos: ['FAITHFULNESS'], bingoFamilies: ['FAITHFULNESS'] }
  assert.deepEqual(freshnessIssues(next, [previous]), [])
})

test('publishing a replacement window preserves all dates outside it', () => {
  const before = [{ date: '2026-09-26', id: 'past' }, { date: '2026-09-27', id: 'old' }, { date: '2026-10-17', id: 'future' }]
  const next = [{ date: '2026-09-27', id: 'fresh' }, { date: '2026-09-28', id: 'another' }]
  assert.deepEqual(mergeDailyWindow(before, next), [before[0], ...next, before[2]])
  assert.throws(() => mergeDailyWindow(before, [...next, next[0]]), /Duplicate/)
})
