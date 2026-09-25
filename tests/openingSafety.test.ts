import assert from 'node:assert/strict'
import test from 'node:test'
import { certifyOpeningSafety, isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'

function fixture(enemy = 'CD', resolve = 2, board = 'CATDOGQQQQQQQQQQ'): LetterStrikeEncounter {
  return {
    id: `opening-safety-${enemy}-${resolve}-${board}`,
    enemy: { word: enemy, definition: 'Opening safety fixture.', partOfSpeech: 'noun',
      semanticRelations: { opposite: [], similar: [], related: [] } },
    enemyLetters: [...enemy].map((letter, index) => ({ id: `enemy-${index}`, letter, initialHits: 1, hitsRemaining: 1 })),
    startingTiles: [...board].map((letter, id) => ({ id, letter, type: 'normal' })),
    startingResolve: resolve, refillQueue: 'A'.repeat((resolve + 1) * 16), minimumWordLength: 3,
    tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true },
      regen: { strike: false, preventResolveLoss: false, regenerate: true } },
  }
}
function candidate(encounter: LetterStrikeEncounter): CandidatePuzzle {
  return { id: encounter.id, seed: 'safety', enemyWord: encounter.enemy.word, encounter,
    goal: { archetypes: [], description: 'Opening safety test.' }, anchors: [],
    construction: { method: 'overlapping-multisets-and-lookahead', plannedWords: [], plannedTileIds: [], refillBlocks: [], mutations: [] },
    provenance: { generatorVersion: 'test', lexicalProvider: 'test' } }
}
const fast = { maxDurationMs: 10_000, maxSuccessors: 10, solver: { maxStates: 20, beamWidth: 4 } }

test('damaging scope excludes zero-hit moves while all-valid scope includes their real terminal losses', () => {
  const encounter = fixture('C', 1)
  const damaging = certifyOpeningSafety(encounter, { ...fast, openingVocabulary: ['CAT', 'DOG'] })
  assert.equal(damaging.certified, true)
  assert.equal(damaging.enumeration.excludedSelections, 1)
  assert.equal(damaging.safeSelections, 1)
  assert.equal(damaging.results[0].evidence, 'opening-victory')
  assert.deepEqual(damaging.results[0].continuation, [])
  const every = certifyOpeningSafety(encounter, { ...fast, scope: 'all-valid-openings', openingVocabulary: ['CAT', 'DOG'] })
  assert.equal(every.certified, false)
  assert.equal(every.unsafeSelections, 1)
  assert.equal(every.results.find(result => result.openings[0].word === 'DOG')!.evidence, 'terminal-loss')
})

test('every physical special choice is checked, including REGEN that reverses a damaging opening', () => {
  const encounter = fixture('C', 1, 'CCATDOGQQQQQQQQQ')
  encounter.startingTiles = encounter.startingTiles.map(tile => tile.id === 1 ? { ...tile, type: 'gem', gem: 'regen' } : tile)
  const report = certifyOpeningSafety(encounter, { ...fast, openingVocabulary: ['CAT'] })
  assert.equal(report.enumeration.completePhysicalSelections, true)
  assert.equal(report.enumeration.requiredSelections, 2)
  assert.equal(report.safeSelections, 1)
  assert.equal(report.unsafeSelections, 1)
  assert.equal(report.certified, false)
  assert.equal(report.results.find(result => result.status === 'unsafe')!.openings[0].tileIds[0], 1)
})

test('zero continuation budgets preserve unknowns while complete root enumeration still finds cheap proofs', () => {
  const encounter = fixture()
  const report = certifyOpeningSafety(encounter, { openingVocabulary: ['CAT'], maxSuccessors: 0 })
  assert.equal(report.enumeration.completePhysicalSelections, true)
  assert.equal(report.unknownSelections, 1)
  assert.equal(report.unsafeSelections, 0)
  assert.equal(report.certified, false)
  assert.equal(report.work.stoppedBy, 'successor-budget')
  const impossible = certifyOpeningSafety(fixture('CC'), { openingVocabulary: ['CAT'], maxSuccessors: 0 })
  assert.equal(impossible.unsafeSelections, 1)
  assert.equal(impossible.results[0].evidence, 'impossible-letter-supply')
  assert.equal(impossible.work.invocationSuccessorsSearched, 0)
})

test('safe continuations replay to victory and checkpoints preserve verified work', () => {
  const encounter = fixture()
  const initialCheckpoint = certifyOpeningSafety(encounter, { ...fast, openingVocabulary: ['CAT'], maxSuccessors: 0 })
  const report = certifyOpeningSafety(encounter, { ...fast, openingVocabulary: ['CAT'], resume: initialCheckpoint })
  assert.equal(report.certified, true)
  assert.equal(report.results[0].evidence, 'winning-witness')
  for (const result of report.results) {
    for (const opening of result.openings) {
      let state = submitLetterStrike(createLetterStrikeGame(encounter), opening.tileIds)
      for (const move of result.continuation!) state = submitLetterStrike(state, move.tileIds)
      assert.equal(state.status, 'won')
    }
  }
  const resumed = certifyOpeningSafety(encounter, { ...fast, openingVocabulary: ['CAT'], resume: report, maxSuccessors: 0 })
  assert.equal(resumed.certified, true)
  assert.equal(resumed.work.invocationSuccessorsSearched, 0)
  assert.equal(isOpeningSafetyCertificateCurrent(encounter, resumed), true)
  const badCheckpoint = structuredClone(report)
  badCheckpoint.results[0].continuation![0].tileIds = [999, 998, 997]
  const rejectedWitness = certifyOpeningSafety(encounter, { openingVocabulary: ['CAT'], resume: badCheckpoint, maxSuccessors: 0 })
  assert.equal(rejectedWitness.certified, false)
  assert.equal(rejectedWitness.unknownSelections, 1)
  assert.throws(() => certifyOpeningSafety(encounter, { openingVocabulary: ['DOG'], resume: report }), /does not match/)
})

test('a familiar continuation requirement cannot be satisfied by unknown winning vocabulary', () => {
  const encounter = fixture()
  const options = { ...fast, openingVocabulary: ['CAT'], wordCommonness: (word: string) => word === 'CAT' ? 0.9 : null,
    commonnessSource: 'test-only-cat-known' }
  const familiar = certifyOpeningSafety(encounter, options)
  assert.equal(familiar.certified, false)
  assert.equal(familiar.unknownSelections, 1)
  assert.equal(familiar.unsafeSelections, 0, 'A win with unknown words is not an impossibility proof.')
  const unrestricted = certifyOpeningSafety(encounter, { ...options, requireFamiliarContinuation: false })
  assert.equal(unrestricted.certified, true)
  assert.ok(unrestricted.results[0].continuation!.length > 0)
})

test('cross-state word hints certify only after actual physical replay', () => {
  const encounter = fixture()
  const options = { ...fast, openingVocabulary: ['CAT'], solver: { maxStates: 0 } }
  const real = certifyOpeningSafety(encounter, { ...options, witnessLines: [[{ word: 'DOG' }]] })
  assert.equal(real.certified, true)
  assert.equal(real.work.reusedWitnesses, 1)
  assert.equal(real.results[0].solverStatesExplored, 0)
  const impossibleHint = certifyOpeningSafety(encounter, { ...options, witnessLines: [[{ word: 'CUP' }]] })
  assert.equal(impossibleHint.certified, false)
  assert.equal(impossibleHint.unknownSelections, 1)
})

test('a complete unrestricted losing search can certify unsafe when physical supply alone cannot', () => {
  const encounter = fixture('Z', 2, 'DOGZQQQQQQQQQQQQ')
  const report = certifyOpeningSafety(encounter, { ...fast, scope: 'all-valid-openings', openingVocabulary: ['DOG'] })
  assert.equal(report.unsafeSelections, 1)
  assert.equal(report.results[0].evidence, 'exhaustive-continuation-search')
  assert.equal(report.certified, false)
})

test('full-dictionary certificates and restricted-spelling certificates keep separate scopes', () => {
  const encounter = fixture('C', 1)
  const full = certifyOpeningSafety(encounter, fast)
  assert.equal(full.enumeration.vocabularyComplete, true)
  assert.equal(full.openingVocabulary.scope, 'full-dictionary')
  assert.equal(full.certified, true)
  assert.ok(full.enumeration.requiredSelections > 1)
  const subset = certifyOpeningSafety(encounter, { ...fast, openingVocabulary: ['CAT'] })
  assert.equal(subset.enumeration.vocabularyComplete, false)
  assert.equal(subset.certified, true, 'This certificate promises only its explicitly listed words.')
  assert.deepEqual(subset.openingVocabulary.words, ['CAT'])
  const empty = certifyOpeningSafety(encounter, { openingVocabulary: [] })
  assert.equal(empty.certified, false, 'An empty required set cannot produce a publication certificate.')
})

test('publication gate rejects unknowns, stale content and unapproved restricted opening scope', () => {
  const encounter = fixture('C', 1)
  const puzzle = candidate(encounter)
  const analysis = analysePuzzle(encounter, { solver: { vocabulary: ['CAT'], maxStates: 2 }, maxReasonableStates: 0,
    includeCounterfactuals: false, wordCommonness: () => 0.9 })
  const config = { requireOpeningSafety: true, minimumWinningTurns: 1, minimumReasonableOpenings: 0,
    requireSemanticImportance: false, minimumFairnessCoverage: 0, maximumCriticalSinglePointLetters: 100 }
  assert.ok(validatePuzzle(puzzle, analysis, config).reasons.some(reason => reason.code === 'opening-safety-unconfirmed'))
  analysis.openingSafety = certifyOpeningSafety(encounter, { ...fast, openingVocabulary: ['CAT'] })
  assert.ok(validatePuzzle(puzzle, analysis, config).reasons.some(reason => reason.code === 'restricted-opening-safety'))
  assert.equal(validatePuzzle(puzzle, analysis, { ...config, allowRestrictedOpeningSafety: true }).accepted, true)
  analysis.openingSafety = certifyOpeningSafety(encounter, fast)
  assert.equal(validatePuzzle(puzzle, analysis, config).accepted, true)
  assert.ok(validatePuzzle(puzzle, analysis, { ...config, openingSafetyScope: 'all-valid-openings' }).reasons
    .some(reason => reason.code === 'opening-safety-scope'))
  const changed = structuredClone(encounter)
  changed.refillQueue += 'Z'
  assert.equal(isOpeningSafetyCertificateCurrent(changed, analysis.openingSafety), false)
  const fake = structuredClone(analysis.openingSafety)
  fake.results[0].status = 'unknown'
  assert.equal(isOpeningSafetyCertificateCurrent(encounter, fake), false)
})
