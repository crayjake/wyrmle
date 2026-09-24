import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDailyPuzzleId, shiftPuzzleId, validatePuzzleId } from '../src/daily/date.ts'
import { getDailyPuzzle } from '../src/daily/puzzle.ts'
import { melancholyEncounter } from '../src/game/encounters.ts'
import { createGame, submitWord } from '../src/game/game.ts'

test('daily IDs use the same UTC day across local timezone offsets', () => {
  assert.equal(getDailyPuzzleId(new Date('2026-09-24T00:00:00Z')), '2026-09-24')
  assert.equal(getDailyPuzzleId(new Date('2026-09-23T20:00:00-04:00')), '2026-09-24')
  assert.equal(getDailyPuzzleId(new Date('2026-09-24T23:59:59.999Z')), '2026-09-24')
  assert.equal(getDailyPuzzleId(new Date('2026-09-25T00:30:00+01:00')), '2026-09-24')
  assert.equal(getDailyPuzzleId(new Date('2026-09-25T00:00:00Z')), '2026-09-25')
})

test('puzzle IDs reject malformed and normalized invalid dates', () => {
  for (const id of ['2026-02-29', '2024-02-30', '2026-13-01', '2026-9-24', 'not-a-date', '2026-09-24T00:00:00Z']) {
    assert.throws(() => validatePuzzleId(id), /real dates/)
    assert.throws(() => getDailyPuzzle(id), /real dates/)
  }
  assert.equal(validatePuzzleId('2024-02-29'), '2024-02-29')
  assert.equal(validatePuzzleId('0000-01-01'), '0000-01-01')
  assert.throws(() => getDailyPuzzleId(new Date('bad-date')), /valid date/)
})

test('UTC day arithmetic handles month, leap year and year boundaries', () => {
  assert.equal(shiftPuzzleId('2024-03-01', -1), '2024-02-29')
  assert.equal(shiftPuzzleId('2025-03-01', -1), '2025-02-28')
  assert.equal(shiftPuzzleId('2026-01-01', -1), '2025-12-31')
  assert.equal(shiftPuzzleId('2026-12-31', 1), '2027-01-01')
})

test('daily definitions are deterministic and independent of player progress and prototype defaults', () => {
  const puzzle = getDailyPuzzle('2026-09-24')
  const before = structuredClone(puzzle)
  const game = submitWord(createGame(puzzle.encounter), [0, 1, 2])
  assert.equal(game.playedWords.length, 1)
  assert.deepEqual(getDailyPuzzle('2026-09-24'), before)
  assert.notEqual(puzzle.encounter, melancholyEncounter)
  assert.notEqual(puzzle.encounter.rules, melancholyEncounter.rules)
  assert.deepEqual(puzzle.encounter, melancholyEncounter)
  // The initial authored catalog has one entry, deliberately repeated by date.
  assert.deepEqual(getDailyPuzzle('2026-09-25').encounter, puzzle.encounter)
  assert.notEqual(getDailyPuzzle('2026-09-25').puzzleId, puzzle.puzzleId)
})

test('daily definitions freeze every nested tile, rule, semantic list and catalog identity', () => {
  const puzzle = getDailyPuzzle('2026-09-24')
  assert.ok(Object.isFrozen(puzzle))
  assert.ok(Object.isFrozen(puzzle.encounter))
  assert.ok(Object.isFrozen(puzzle.encounter.startingTiles))
  assert.ok(Object.isFrozen(puzzle.encounter.startingTiles[0]))
  assert.ok(Object.isFrozen(puzzle.encounter.rules.tileEffects.ward))
  assert.ok(Object.isFrozen(puzzle.encounter.enemy.semanticRelations.opposite))
  assert.throws(() => { puzzle.encounter.startingTiles[0].letter = 'X' }, TypeError)
  assert.throws(() => { puzzle.encounter.rules.damagePerLetter = 99 }, TypeError)
  const game = createGame(puzzle.encounter)
  game.tiles[0].letter = 'X'
  assert.equal(puzzle.encounter.startingTiles[0].letter, 'J')
})
