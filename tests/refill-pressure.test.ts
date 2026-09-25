import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLetterStrikeGame, letterStrikeEncounter, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import { findPlayableWords } from '../src/generator/findMoves.ts'
import { analyseRefillPressure } from '../src/generator/refillPressure.ts'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { encounterRuleKey } from '../src/generator/stateKey.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { createCandidate } from '../src/generator/generate.ts'

function encounter(queue: string): LetterStrikeEncounter {
  return { ...structuredClone(letterStrikeEncounter), id: 'finite-pressure-fixture', finiteRefills: true,
    startingResolve: 4, refillQueue: queue, grammarModifiers: {}, wordPartsOfSpeech: {}, longWordRule: undefined,
    startingTiles: [...'CATDOGZZZZZZZZZZ'].map((letter, id) => ({ id, letter, type: 'normal' })),
    enemy: { word: 'CD', definition: 'Fixture', partOfSpeech: 'noun', semanticRelations: { opposite: [], similar: [], related: [] } },
    enemyLetters: [...'CD'].map((letter, index) => ({ id: `e${index}`, letter, initialHits: 1, hitsRemaining: 1 })) }
}
const route = [{ word: 'CAT', tileIds: [0, 1, 2] }, { word: 'DOG', tileIds: [3, 4, 5] }]

test('finite word discovery ignores empty cells and the rule has a distinct cache key', () => {
  const puzzle = encounter('')
  const first = submitLetterStrike(createLetterStrikeGame(puzzle), route[0].tileIds)
  assert.equal(first.refillIndex, 0)
  assert.equal(first.tiles.filter(tile => !tile.letter).length, 3)
  assert.ok(findPlayableWords(first).includes('DOG'))
  assert.ok(!findPlayableWords(first).includes('CAT'))
  assert.notEqual(encounterRuleKey(puzzle), encounterRuleKey({ ...puzzle, finiteRefills: undefined }))
})

test('supply pressure requires play on an already reduced board and only counts real wins', () => {
  const pressured = analyseRefillPressure(encounter('ZZ'), [{ moves: route }])
  assert.equal(pressured.winsOnReducedBoard, 1)
  assert.equal(pressured.winsAfterRefillsExhausted, 1)
  assert.equal(pressured.minimumTilesBeforeWinningMove, 15)
  assert.equal(pressured.routes[0].firstEmptySlotAfterTurn, 1)
  const finalOnly = analyseRefillPressure(encounter('ZZZZ'), [{ moves: route }])
  assert.equal(finalOnly.replayedWinningLines, 1)
  assert.equal(finalOnly.winsOnReducedBoard, 0)
  assert.equal(finalOnly.routes[0].firstEmptySlotAfterTurn, 2)
  assert.equal(analyseRefillPressure(encounter('ZZ'), [{ moves: [{ word: 'CAT', tileIds: [99] }] }]).replayedWinningLines, 0)
})

test('analysis and validation use fingerprinted engine-replayed supply evidence', () => {
  const candidate = createCandidate('ANGER', 'finite-validation-fixture')
  candidate.encounter = encounter('ZZZZ')
  const analysis = analysePuzzle(candidate.encounter, { solver: { maxStates: 0, hintLines: [route.map(move => move.tileIds)] },
    maxReasonableStates: 0, maxFinalStates: 0, includeCounterfactuals: false })
  assert.equal(analysis.solvable, true)
  assert.deepEqual(analysis.refillPressure?.reserveByEnemyLetter, [
    { letter: 'C', boardCopies: 1, reserveCopies: 0, requiredHits: 1 },
    { letter: 'D', boardCopies: 1, reserveCopies: 0, requiredHits: 1 },
  ])
  assert.ok(validatePuzzle(candidate, analysis).reasons.some(reason => reason.code === 'decorative-refill-limit'))
  candidate.encounter = { ...candidate.encounter, refillQueue: 'QQQQ' }
  assert.ok(validatePuzzle(candidate, analysis).reasons.some(reason => reason.code === 'missing-refill-pressure'))
})
