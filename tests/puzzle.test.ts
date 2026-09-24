import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDailyPuzzleId, shiftPuzzleId, validatePuzzleId } from '../src/daily/date.ts'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { letterStrikeEncounter } from '../src/game/letterStrike.ts'
import { createLetterStrikeGame as createGame, previewLetterStrike, submitLetterStrike as submitWord } from '../src/game/letterStrike.ts'

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
  const puzzle = getDailyPuzzle('2026-09-23')
  const before = structuredClone(puzzle)
  const game = submitWord(createGame(puzzle.encounter), [0, 1, 2])
  assert.equal(game.playedWords.length, 1)
  assert.deepEqual(getDailyPuzzle('2026-09-23'), before)
  assert.notEqual(puzzle.encounter, letterStrikeEncounter)
  assert.notEqual(puzzle.encounter.tileEffects, letterStrikeEncounter.tileEffects)
  assert.equal(puzzle.encounter.startingTiles.map((tile) => tile.letter).join(''), 'JOYCHEERGLOOMADS')
  assert.equal(puzzle.encounter.startingTiles[2].gem, 'ward')
  assert.equal(puzzle.encounter.longWordRule, undefined)
  assert.equal(puzzle.encounter.enemy.semanticRelations.opposite.includes('GLAD'), false)
  // The initial authored catalog has one entry, deliberately repeated by date.
  assert.deepEqual(getDailyPuzzle('2026-09-22').encounter, puzzle.encounter)
  assert.notEqual(getDailyPuzzle('2026-09-22').puzzleId, puzzle.puzzleId)
})

test('grammar release uses a fixed UTC boundary and never changes published v1 puzzle rules', () => {
  const before = getDailyPuzzleForVersion('2026-09-24', 'letter-strike-1', 1)
  const after = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-4', 4)
  assert.equal(before.gameVersion, 'letter-strike-1')
  assert.equal(before.puzzleVersion, 1)
  assert.equal(before.encounter.grammarModifiers, undefined)
  assert.equal(after.gameVersion, 'letter-strike-4')
  assert.equal(after.puzzleVersion, 4)
  assert.deepEqual(after.encounter.grammarModifiers, { adjective: 1 })
  assert.ok(Object.isFrozen(after.encounter.grammarModifiers))
  assert.notEqual(after.encounter.enemyLetters, before.encounter.enemyLetters)
  const sadIds = [15, 13, 14]
  const oldSad = submitWord(createGame(before.encounter), sadIds)
  const newSad = submitWord(createGame(after.encounter), [12, 13, 14])
  assert.equal(oldSad.playedWords[0].strikes, 0)
  assert.equal(newSad.playedWords[0].strikes, 1)
  assert.deepEqual(getDailyPuzzleForVersion('2026-09-24', 'letter-strike-1', 1), before)
  assert.deepEqual(getDailyPuzzleForVersion('2026-09-25', 'letter-strike-4', 4), after)
})

test('new September 25 attempts get additive Strike while archived v1 and v2 retain overlap', () => {
  const v1 = getDailyPuzzleForVersion('2026-09-24', 'letter-strike-1', 1)
  const v2 = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-2', 2)
  const v3 = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-3', 3)
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
  const puzzle = getDailyPuzzle('2026-09-23')
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

test('v4 publishes the long-word anchor board with Strike L, Ward E and deterministic authored refills', () => {
  const definition = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-4', 4)
  const state = createGame(definition.encounter)
  assert.equal(state.tiles.map((tile) => tile.letter).join(''), 'JOYTCHERGLOMSADE')
  assert.deepEqual(state.tiles.filter((tile) => tile.type === 'gem'), [
    { id: 9, letter: 'L', type: 'gem', gem: 'strike' },
    { id: 15, letter: 'E', type: 'gem', gem: 'ward' },
  ])
  assert.deepEqual(definition.encounter.longWordRule, { minimumLength: 6, bonusStrikes: 1 })
  assert.ok(Object.isFrozen(definition.encounter.longWordRule))
  assert.ok(Object.isFrozen(definition.encounter.wordPartsOfSpeech))
  const authored = { ...definition.encounter, id: letterStrikeEncounter.id }
  delete authored.strikeConsumesAllowance
  assert.deepEqual(authored, letterStrikeEncounter)
  assert.notEqual(definition.encounter.startingTiles, letterStrikeEncounter.startingTiles)
  assert.notEqual(definition.encounter.wordPartsOfSpeech, letterStrikeEncounter.wordPartsOfSpeech)
  assert.equal(definition.encounter.refillQueue, 'RYERELATMENDNJOYSADPPYMERRYDELIGHTLEMONSCLOSETTHREADHAPPYNEARELATEDSADGLOOMMERRYLEMONSTHREADCLOSETNEARJOY')
  const anchors = [
    ['JOY', [0, 1, 2], 2, 'COUNTER', 0, 1],
    ['CHEER', [4, 5, 6, 15, 7], 3, 'COUNTER', 0, 0],
    ['GLAD', [8, 9, 13, 14], 2, 'COUNTER', 0, 1],
    ['SAD', [12, 13, 14], 1, 'RESISTED', 0, 1],
    ['GLOOM', [8, 9, 1, 10, 11], 1, 'RESISTED', 0, 1],
    ['CLOSET', [4, 9, 1, 12, 6, 3], 3, 'NEUTRAL', 1, 1],
    ['THREAD', [3, 5, 7, 6, 13, 14], 2, 'NEUTRAL', 1, 1],
  ] as const
  for (const [word, ids, strikes, semanticLabel, longWordModifier, resolveCost] of anchors) {
    const preview = previewLetterStrike(state, ids)
    assert.equal(preview.word, word)
    assert.equal(preview.valid, true)
    assert.equal(preview.strikes, strikes, word)
    assert.equal(preview.semanticLabel, semanticLabel, word)
    assert.equal(preview.longWordModifier, longWordModifier, word)
    assert.equal(preview.resolveCost, resolveCost, word)
    assert.deepEqual(submitWord(state, ids), submitWord(createGame(definition.encounter), ids))
  }
})

test('new SANDY grammar and GAY counter annotations belong only to v4 encounter rules', () => {
  const current = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-4', 4)
  const archived = getDailyPuzzleForVersion(current.puzzleId, 'letter-strike-3', 3)
  const currentGay = previewLetterStrike(createGame(current.encounter), [8, 13, 2])
  assert.equal(currentGay.word, 'GAY')
  assert.equal(currentGay.semanticLabel, 'COUNTER')
  assert.equal(currentGay.strikes, 2)
  for (const [definition, modifier] of [[current, 1], [archived, 0]] as const) {
    const game = createGame(definition.encounter)
    game.tiles = game.tiles.map((tile, index) => index < 5
      ? { id: tile.id, letter: 'SANDY'[index], type: 'normal' as const } : tile)
    const sandy = previewLetterStrike(game, [0, 1, 2, 3, 4])
    assert.equal(sandy.word, 'SANDY')
    assert.equal(sandy.grammaticalModifier, modifier)
    assert.equal(sandy.strikes, 1 + modifier)
  }
  assert.equal(archived.encounter.enemy.semanticRelations.opposite.includes('GAY'), false)
  assert.equal(archived.encounter.enemy.semanticRelations.similar.includes('GLOOMY'), false)
  const gloomyState = createGame(current.encounter)
  const gloomyIds = [8, 9, 1, 10, 11, 2]
  const gloomy = previewLetterStrike(gloomyState, gloomyIds)
  assert.equal(gloomy.word, 'GLOOMY')
  assert.equal(gloomy.semanticLabel, 'RESISTED')
  assert.equal(gloomy.grammaticalModifier, 1)
  assert.equal(gloomy.longWordModifier, 0)
  assert.equal(gloomy.strikes, 2)
  gloomyState.tiles[9] = { id: 9, letter: 'L', type: 'normal' }
  assert.equal(previewLetterStrike(gloomyState, gloomyIds).strikes, 1)
})
