import assert from 'node:assert/strict'
import test from 'node:test'
import { analysePuzzle, counterfactualEncounter, hasImpossibleLetterSupply } from '../src/generator/analyse.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import { analyseSemanticChoices } from '../src/generator/semanticChoices.ts'
import { solvePuzzle } from '../src/generator/solve.ts'

function encounter(resolve = 3, enemy = 'BY'): LetterStrikeEncounter {
  return {
    id: 'analysis-fixture',
    enemy: { word: enemy, definition: 'An isolated deterministic analysis fixture.', partOfSpeech: 'noun',
      semanticRelations: { opposite: [], similar: [], related: [] } },
    enemyLetters: [...enemy].map((letter, index) => ({ id: `enemy-${index}`, letter, initialHits: 1, hitsRemaining: 1 })),
    startingResolve: resolve,
    startingTiles: [...'BAYEDQQQQQQQQQQQ'].map((letter, id) => ({ id, letter, type: 'normal' })),
    refillQueue: 'A'.repeat((resolve + 1) * 16),
    minimumWordLength: 3,
    tileEffects: { ward: { strike: false, preventResolveLoss: true }, strike: { strike: true, preventResolveLoss: false } },
  }
}

function candidate(encounter: LetterStrikeEncounter): CandidatePuzzle {
  return { id: encounter.id, seed: 'analysis-fixture', enemyWord: encounter.enemy.word, encounter,
    goal: { archetypes: [], description: 'Isolated analysis fixture.' }, anchors: [],
    construction: { method: 'overlapping-multisets-and-lookahead', plannedWords: [], plannedTileIds: [], refillBlocks: [], mutations: [] },
    provenance: { generatorVersion: 'test', lexicalProvider: 'test' } }
}

const options = {
  solver: { strategy: 'bfs' as const, maxStates: 100, vocabulary: ['BAY', 'YEA', 'BAD'] },
  includeCounterfactuals: false,
  wordCommonness: () => 0.8,
  maxReasonableStates: 40,
}

test('semantic choice publication gates reject absent, stale and insufficient counter evidence', () => {
  const puzzle = candidate(encounter(2))
  const analysis = analysePuzzle(puzzle, options)
  const gates = { minimumCounterOpeningLemmas: 1 }
  assert.ok(validatePuzzle(puzzle, analysis, gates).reasons.some(reason => reason.code === 'missing-semantic-choice-audit'))
  analysis.semanticChoices = analyseSemanticChoices(puzzle.encounter, analysis.winningLines)
  assert.equal(analysis.semanticChoices.openingEnumerationComplete, true)
  assert.deepEqual(analysis.semanticChoices.familiarCounterOpenings, [])
  assert.ok(validatePuzzle(puzzle, analysis, gates).reasons.some(reason => reason.code === 'few-familiarCounterOpeningLemmas'))
  const changed = { ...puzzle, encounter: { ...puzzle.encounter, startingResolve: 1 } }
  assert.ok(validatePuzzle(changed, analysis, gates).reasons.some(reason => reason.code === 'missing-semantic-choice-audit'))
  const invalid = structuredClone(analysis.winningLines)
  invalid[0].moves[0].tileIds = [99]
  assert.throws(() => analyseSemanticChoices(puzzle.encounter, invalid), /replayable winning routes/)
})

test('counter-choice audit separates semantic extra hits from Hit-tile damage', () => {
  const puzzle = encounter(2)
  puzzle.enemy.semanticRelations.opposite = ['BAY']
  const normal = analyseSemanticChoices(puzzle, [])
  assert.ok(normal.meaningBoostedOpenings.includes('BAY'))
  puzzle.startingTiles[0] = { ...puzzle.startingTiles[0], type: 'gem', gem: 'strike' }
  const withHit = analyseSemanticChoices(puzzle, [])
  assert.ok(withHit.multiHitCounterOpenings.includes('BAY'))
  assert.equal(withHit.meaningBoostedOpenings.includes('BAY'), false,
    'The same neutral selection already hits B through Hit and Y normally.')
})

test('analysis detects premature hopelessness after a reasonable matching word consumes the only future target', () => {
  const puzzle = encounter()
  const initial = createLetterStrikeGame(puzzle)
  const afterBay = submitLetterStrike(initial, [0, 1, 2])
  assert.equal(afterBay.playerResolve, 2)
  assert.equal(afterBay.enemyLetters.find(letter => letter.letter === 'Y')?.hitsRemaining, 1)
  assert.equal(hasImpossibleLetterSupply(afterBay), true)
  const analysis = analysePuzzle(puzzle, options)
  assert.equal(analysis.solvable, true)
  assert.ok(analysis.fairness.reasonableStates > 0)
  assert.ok(analysis.fairness.provenDeadStates > 0)
  assert.ok((analysis.prematureDeadStateRate ?? 0) > 0)
  assert.ok((analysis.fairness.prematureDeadStateRateLowerBound ?? 0) > 0)
})

test('analysis recognizes and exposes replayable final-Resolve rescue moves', () => {
  const puzzle = encounter(2)
  const analysis = analysePuzzle(puzzle, options)
  assert.equal(analysis.solvable, true)
  assert.ok(analysis.clutchOpportunityCount > 0)
  assert.ok(analysis.fairness.rescuedFinalStates > 0)
  for (const clutch of analysis.clutchLines) {
    let state = createLetterStrikeGame(puzzle)
    for (const move of clutch.prefix) state = submitLetterStrike(state, move.tileIds)
    assert.equal(state.playerResolve, 1)
    for (const rescue of clutch.winningMoves) assert.equal(submitLetterStrike(state, rescue.tileIds).status, 'won')
  }
  assert.ok(Math.abs(analysis.clutchWordCommonness! - 0.8) < 1e-12)
})

test('bounded reasonable traversal reaches final Resolve after Ward without exhausting its budget on early branching', () => {
  const puzzle = encounter(5, 'CCCCCC')
  puzzle.startingTiles = [...'CATCOSTACTCASTOX'].map((letter, id) => id === 0
    ? { id, letter, type: 'gem', gem: 'ward' }
    : { id, letter, type: 'normal' })
  puzzle.refillQueue = 'CATCOS'.repeat(16)
  const analysis = analysePuzzle(puzzle, {
    ...options,
    solver: { strategy: 'beam', maxStates: 1, vocabulary: ['CAT', 'ACT', 'COT', 'CAST', 'COST'] },
    maxReasonableStates: 64,
  })
  assert.ok(analysis.fairness.finalResolveStates > 0)
  assert.ok(analysis.fairness.rescuedFinalStates > 0)
  assert.equal(analysis.fairness.samplingSchedule, 'alternating-breadth-and-depth')
  assert.ok(analysis.fairness.sampledDepthCounts[5] > 0)
  assert.ok(Object.values(analysis.fairness.sampledDepthCounts).reduce((sum, count) => sum + count, 0) <= 64)
  assert.ok(analysis.fairness.sampledDepthCounts[1] >= 2, 'Several distinct early positions remain sampled.')
})

test('bounded or vocabulary-restricted search never fabricates a hopelessness proof', () => {
  const analysis = analysePuzzle(encounter(1, 'B'), {
    ...options,
    solver: { maxStates: 1, vocabulary: ['YEA'] },
    maxReasonableStates: 1,
  })
  assert.equal(analysis.solvable, null)
  assert.equal(analysis.fairness.finalResolveStates, 1)
  assert.equal(analysis.fairness.finalStatesWithoutRescue, 0)
  assert.equal(analysis.fairness.finalStatesUnknown, 1)
  assert.equal(analysis.penultimateRescueRate, null)
  assert.equal(analysis.prematureDeadStateRate, null)
})

test('a final-Resolve state without a direct finishing move can still win by using Ward first', () => {
  const puzzle = encounter(1)
  puzzle.startingTiles = puzzle.startingTiles.map(tile => tile.id === 2 ? { ...tile, type: 'gem', gem: 'ward' } : tile)
  const analysis = analysePuzzle(puzzle, { ...options, solver: { strategy: 'bfs', maxStates: 100 } })
  assert.equal(analysis.solvable, true)
  assert.ok(analysis.winningLines.some(line => line.turns === 2 && line.moves[0].wardUsed))
  assert.ok(analysis.fairness.finalStatesWithoutRescue > 0, 'No direct finishing move is classified separately from hopelessness.')
  assert.ok(analysis.fairness.rescuedFinalStates > 0)
})

test('physical letter impossibility is a sound certificate even with zero solver budget', () => {
  const puzzle = encounter(3, 'Z')
  const analysis = analysePuzzle(puzzle, { ...options, solver: { maxStates: 0 }, maxReasonableStates: 0 })
  assert.equal(analysis.solvable, false)
  assert.deepEqual(analysis.criticalSinglePointLetters, [0])
})

test('best witnessed openings are not called optimal when minimum depth is unproved', () => {
  const analysis = analysePuzzle(encounter(), options)
  assert.equal(analysis.minimumTurnsProven, false)
  assert.notEqual(analysis.isStrongestImmediateOptimal, true)
})

test('unknown winning-word familiarity cannot pass the familiar-witness validation gate', () => {
  const puzzle = candidate(encounter(2))
  const analysis = analysePuzzle(puzzle, { ...options, wordCommonness: () => null })
  assert.equal(analysis.solvable, true)
  assert.equal(analysis.requiredObscureWordScore, null)
  const validation = validatePuzzle(puzzle, analysis, { minimumWinningTurns: 1, requireSemanticImportance: false })
  assert.ok(validation.reasons.some(reason => reason.code === 'missing-familiar-winning-witness'))
})

test('counterfactuals change only the intended rule and reuse actual route transitions', () => {
  const puzzle = encounter(2)
  puzzle.startingTiles = puzzle.startingTiles.map(tile => tile.id === 1 ? { ...tile, type: 'gem', gem: 'ward' } : tile)
  puzzle.grammarModifiers = { adjective: 1 }
  puzzle.longWordRule = { minimumLength: 6, bonusStrikes: 1 }
  puzzle.enemy.semanticRelations = { opposite: ['YEA'], similar: ['BAD'], related: [] }
  const noWard = counterfactualEncounter(puzzle, 'ward')
  assert.equal(noWard.tileEffects.ward.preventResolveLoss, false)
  assert.equal(noWard.tileEffects.strike.strike, true)
  assert.deepEqual(noWard.longWordRule, puzzle.longWordRule)
  const allNeutral = counterfactualEncounter(puzzle, 'semantic')
  assert.deepEqual(allNeutral.enemy.semanticRelations, { opposite: [], similar: [], related: [] })
  assert.deepEqual(allNeutral.grammarModifiers, puzzle.grammarModifiers)
  assert.deepEqual(puzzle.enemy.semanticRelations.similar, ['BAD'])
  const neutralPuzzle = { ...puzzle, enemy: { ...puzzle.enemy, semanticRelations: { opposite: [], similar: [], related: [] } } }
  const analysis = analysePuzzle(neutralPuzzle, options)
  assert.ok((analysis.wardImportance ?? 0) > 0)
  assert.equal(analysis.counterfactuals.find(item => item.mechanic === 'ward')?.evidence, 'route-replay')
  assert.ok(analysis.counterfactuals.find(item => item.mechanic === 'ward')!.changedWinningOutcomes > 0)
})

test('mechanic analysis replays retained witnesses beyond the first six', () => {
  const puzzle = encounter(2, 'BA')
  puzzle.startingTiles[0] = { ...puzzle.startingTiles[0], type: 'gem', gem: 'strike' }
  puzzle.enemy.semanticRelations.opposite = ['BAY']
  const solution = solvePuzzle(puzzle, { maxStates: 0, hintLines: [[[0, 1, 2]], [[0, 1, 4]]] })
  const counter = solution.winningLines.find(line => line.moves[0].word === 'BAY')!
  const neutral = solution.winningLines.find(line => line.moves[0].word === 'BAD')!
  assert.ok(counter && neutral)
  solution.winningLines = [...Array(6).fill(counter), neutral]
  const analysis = analysePuzzle(puzzle, { ...options, solution })
  const strike = analysis.counterfactuals.find(item => item.mechanic === 'strike')!
  assert.equal(strike.replayedWinningLines, 7)
  assert.equal(strike.changedWinningOutcomes, 1)
  assert.ok(strike.importance! > 0)
})

test('special decision analysis distinguishes proved automatic use from bounded missing alternatives', () => {
  const puzzle = encounter(2, 'Y')
  puzzle.startingTiles = puzzle.startingTiles.map(tile => tile.id === 2 ? { ...tile, type: 'gem', gem: 'ward' } : tile)
  const full = analysePuzzle(puzzle, { ...options, solver: { strategy: 'bfs', maxStates: 100 } })
  assert.equal(full.specialTileDecisions.ward.openingDiscoveryComplete, true)
  assert.equal(full.specialTileDecisions.ward.reasonableOpeningWordsPreserving, 0)
  assert.equal(full.specialTileDecisions.ward.automaticInReasonableOpenings, true)
  assert.ok(validatePuzzle(candidate(puzzle), full).reasons.some(reason => reason.code === 'automatic-ward'))
  const bounded = analysePuzzle(puzzle, { ...options, solver: { vocabulary: ['YEA'], maxStates: 10 } })
  assert.equal(bounded.specialTileDecisions.ward.automaticInReasonableOpenings, null)
  const validation = validatePuzzle(candidate(puzzle), bounded)
  assert.ok(!validation.reasons.some(reason => reason.code === 'automatic-ward'))
  assert.ok(validation.warnings.some(warning => warning.code === 'no-observed-ward-preservation'))
})

test('special decisions expose a real preservation opening and different winning use turns', () => {
  const puzzle = encounter(2)
  puzzle.startingTiles = puzzle.startingTiles.map(tile => tile.id === 2 ? { ...tile, type: 'gem', gem: 'ward' } : tile)
  const analysis = analysePuzzle(puzzle, options)
  assert.ok(analysis.specialTileDecisions.ward.reasonableOpeningWordsPreserving > 0)
  assert.equal(analysis.specialTileDecisions.ward.automaticInReasonableOpenings, false)
  assert.deepEqual(analysis.specialTileDecisions.ward.winningUseTurns, [1, 2])
})

test('validation thresholds and quality contributions are inspectable and editable', () => {
  const puzzle = candidate(encounter(2))
  const analysis = analysePuzzle(puzzle, options)
  const strict = validatePuzzle(puzzle, analysis)
  assert.equal(strict.accepted, false)
  assert.ok(strict.reasons.some(reason => reason.code === 'too-short'))
  const permissive = validatePuzzle(puzzle, analysis, {
    minimumWinningTurns: 1, maximumPrematureDeadStateRate: 1, maximumCriticalSinglePointLetters: 10,
    requireSemanticImportance: false,
  })
  assert.equal(permissive.accepted, true)
  assert.equal(permissive.scope, 'development-review')
  const score = scorePuzzle(puzzle, analysis)
  assert.equal(score.rawTotal, score.components.reduce((sum, component) => sum + component.contribution, 0))
  const changed = scorePuzzle(puzzle, analysis, { commonVocabulary: 0 })
  assert.ok(changed.rawTotal < score.rawTotal)
})
