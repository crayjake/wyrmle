import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDailyPuzzleId, shiftPuzzleId, validatePuzzleId } from '../src/daily/date.ts'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { letterStrikeEncounter } from '../src/game/letterStrike.ts'
import { createLetterStrikeGame as createGame, submitLetterStrike as submitWord } from '../src/game/letterStrike.ts'

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
  assert.notEqual(puzzle.encounter, letterStrikeEncounter)
  assert.notEqual(puzzle.encounter.tileEffects, letterStrikeEncounter.tileEffects)
  const oldPrototype = { ...letterStrikeEncounter }
  delete oldPrototype.grammarModifiers
  oldPrototype.strikeConsumesAllowance = true
  assert.deepEqual({ ...puzzle.encounter, id: letterStrikeEncounter.id }, oldPrototype)
  // The initial authored catalog has one entry, deliberately repeated by date.
  assert.deepEqual(getDailyPuzzle('2026-09-23').encounter, puzzle.encounter)
  assert.notEqual(getDailyPuzzle('2026-09-23').puzzleId, puzzle.puzzleId)
})

test('grammar release uses a fixed UTC boundary and never changes published v1 puzzle rules', () => {
  const before = getDailyPuzzle('2026-09-24')
  const after = getDailyPuzzle('2026-09-25')
  assert.equal(before.gameVersion, 'letter-strike-1')
  assert.equal(before.puzzleVersion, 1)
  assert.equal(before.encounter.grammarModifiers, undefined)
  assert.equal(after.gameVersion, 'letter-strike-3')
  assert.equal(after.puzzleVersion, 3)
  assert.deepEqual(after.encounter.grammarModifiers, { adjective: 1 })
  assert.ok(Object.isFrozen(after.encounter.grammarModifiers))
  assert.notEqual(after.encounter.enemyLetters, before.encounter.enemyLetters)
  const sadIds = [15, 13, 14]
  const oldSad = submitWord(createGame(before.encounter), sadIds)
  const newSad = submitWord(createGame(after.encounter), sadIds)
  assert.equal(oldSad.playedWords[0].strikes, 0)
  assert.equal(newSad.playedWords[0].strikes, 1)
  assert.deepEqual(getDailyPuzzle('2026-09-24'), before)
  assert.deepEqual(getDailyPuzzle('2026-09-25'), after)
})

test('new September 25 attempts get additive Strike while archived v1 and v2 retain overlap', () => {
  const v1 = getDailyPuzzle('2026-09-24')
  const v2 = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-2', 2)
  const v3 = getDailyPuzzle('2026-09-25')
  assert.equal(v1.encounter.strikeConsumesAllowance, true)
  assert.equal(v2.encounter.strikeConsumesAllowance, true)
  assert.equal(v3.encounter.strikeConsumesAllowance, false)
  assert.deepEqual(v2.encounter.grammarModifiers, v3.encounter.grammarModifiers)
  for (const [definition, expected] of [[v1, 1], [v2, 1], [v3, 2]] as const) {
    const game = submitWord(createGame(definition.encounter), [9, 13, 14]) // LAD, actual Strike L.
    assert.equal(game.playedWords[0].strikes, expected)
  }
  assert.throws(() => getDailyPuzzleForVersion('2026-09-24', 'letter-strike-2', 2), /unsupported/)
  assert.throws(() => getDailyPuzzleForVersion('2026-09-25', 'letter-strike-2', 3), /unsupported/)
  assert.throws(() => getDailyPuzzleForVersion('2026-09-25', 'letter-strike-99', 99), /unsupported/)
})

test('daily definitions freeze every nested tile, rule, semantic list and catalog identity', () => {
  const puzzle = getDailyPuzzle('2026-09-24')
  assert.ok(Object.isFrozen(puzzle))
  assert.ok(Object.isFrozen(puzzle.encounter))
  assert.ok(Object.isFrozen(puzzle.encounter.startingTiles))
  assert.ok(Object.isFrozen(puzzle.encounter.startingTiles[0]))
  assert.ok(Object.isFrozen(puzzle.encounter.enemyLetters))
  assert.ok(Object.isFrozen(puzzle.encounter.enemyLetters[0]))
  assert.ok(Object.isFrozen(puzzle.encounter.tileEffects.ward))
  assert.ok(Object.isFrozen(puzzle.encounter.enemy.semanticRelations.opposite))
  assert.throws(() => { puzzle.encounter.startingTiles[0].letter = 'X' }, TypeError)
  assert.throws(() => { puzzle.encounter.enemyLetters[0].hitsRemaining = 99 }, TypeError)
  const game = createGame(puzzle.encounter)
  game.tiles[0].letter = 'X'
  assert.equal(puzzle.encounter.startingTiles[0].letter, 'J')
})
