import assert from 'node:assert/strict'
import { test } from 'node:test'
import archived from '../src/daily/puzzles/2026-09-25-v10.json' with { type: 'json' }
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import { MEANING_LEXICON_VERSION, meaningSupply, validateMeaningLexicon } from '../src/game/meaningLexicon.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import { MEANING_ASSESSMENT_PACKING_VERSION, MEANING_PACKING_VERSION, packMeaningLexicon, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { readSemanticAssessmentMetadata, readWordSemanticAssessment } from '../src/game/semanticAssessment.ts'
import type { SemanticAssessmentMetadata, WordSemanticAssessment } from '../src/game/semanticAssessment.ts'

const metadata: SemanticAssessmentMetadata = {
  version: 'assessment-fixture-1', modelId: 'offline/model', modelRevision: 'pinned-model-revision',
  sourceDigest: 'source-digest', policyDigest: 'policy-digest', cacheDigest: 'cache-digest',
  method: 'embedding', assessedWords: 4, assessedSenses: 9,
}
const scores: WordSemanticAssessment = {
  counterScore: 0.8123, resistedScore: 0.1725, margin: 0.6398,
  sensesEvaluated: 4, selectedAnchor: 'composure',
}
const calm: PuzzleWordMeaning = {
  definition: 'Free from agitation.', lemma: 'calm', senseId: 'calm-composure-sense',
  partsOfSpeech: ['adjective', 'noun', 'verb'], relation: 'opposite', reason: 'Stored counter evidence.',
  source: 'oewn-2025', evidence: 'model-assessed', assessment: scores,
}
const physical: LetterStrikeEncounter = {
  id: 'assessment-fixture', enemy: { word: 'CHAOS', definition: 'Disorder.', partOfSpeech: 'noun',
    semanticRelations: { opposite: [], similar: [], related: [] } },
  enemyLetters: [...'CHAOS'].map((letter, index) => ({ id: `enemy-${index}`, letter, hitsRemaining: 1, initialHits: 1 })),
  startingTiles: [...'CALMCHAOTICWHERE'].map((letter, id) => ({ id, letter, type: 'normal' })),
  startingResolve: 5, minimumWordLength: 3, refillQueue: 'S', finiteRefills: true,
  tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true } },
}
const lexicon: PuzzleMeaningLexicon = {
  version: MEANING_LEXICON_VERSION, dictionaryVersion: 'defined-dictionary-fixture', profileVersion: 'assessed-fixture',
  policy: 'defined-only', enemyWord: 'CHAOS', letterSupply: meaningSupply(physical),
  minimumWordLength: 3, maximumWordLength: physical.startingTiles.length, assessment: metadata,
  words: {
    CALM: calm,
    CALMS: { ...calm, assessment: { ...scores } },
    CHAOTIC: { ...calm, definition: 'Lacking order.', lemma: 'chaotic', senseId: 'chaotic-sense',
      partsOfSpeech: ['adjective'], relation: 'similar', reason: 'Stored reinforcement evidence.',
      assessment: { counterScore: 0.125, resistedScore: 0.925, margin: -0.8, sensesEvaluated: 2, selectedAnchor: 'disorder' } },
    WHERE: { ...calm, definition: 'At which place.', lemma: 'where', senseId: 'where-location-sense',
      partsOfSpeech: ['adverb'], relation: 'unrelated', reason: 'Every source sense was assessed; no directional relationship met the policy.',
      source: 'wiktionary-en', assessment: { counterScore: 0.1, resistedScore: 0.12, margin: -0.02,
        sensesEvaluated: 3, selectedAnchor: 'disorder' } },
  },
}

test('model assessments round-trip losslessly in v2, including scored neutral words', () => {
  const packed = packMeaningLexicon(lexicon)
  assert.equal(packed.packingVersion, MEANING_ASSESSMENT_PACKING_VERSION)
  assert.equal(packed.records[0].length, 9)
  assert.equal(packed.assessments!.length, 3)
  assert.equal(packed.words.CALM, packed.words.CALMS)
  const decoded = unpackMeaningLexicon(JSON.parse(JSON.stringify(packed)))
  assert.equal(JSON.stringify(decoded), JSON.stringify(lexicon))
  assert.deepEqual(packMeaningLexicon(decoded), packed)
  assert.equal(decoded.words.WHERE.evidence, 'model-assessed')
  assert.equal(decoded.words.WHERE.assessment!.sensesEvaluated, 3)
  assert.doesNotThrow(() => validateMeaningLexicon({ ...physical, meaningLexicon: decoded }))
})

test('assessment metadata and scores are frozen copies, without freezing or modifying caller data', () => {
  const before = structuredClone(lexicon)
  const packed = packMeaningLexicon(lexicon)
  assert.deepEqual(lexicon, before)
  assert.ok(!Object.isFrozen(metadata))
  assert.ok(!Object.isFrozen(scores))
  assert.ok(Object.isFrozen(packed.lexicon.assessment))
  assert.ok(Object.isFrozen(packed.assessments))
  assert.ok(Object.isFrozen(packed.assessments![0]))
  const transport = structuredClone(packed)
  const decoded = unpackMeaningLexicon(transport)
  assert.ok(Object.isFrozen(decoded.assessment))
  assert.ok(Object.isFrozen(decoded.words.CALM.assessment))
  ;(transport.lexicon.assessment as { modelId: string }).modelId = 'changed'
  ;(transport.assessments![0] as { counterScore: number }).counterScore = 0
  assert.equal(decoded.assessment!.modelId, metadata.modelId)
  assert.equal(decoded.words.CALM.assessment!.counterScore, scores.counterScore)
})

test('the archived v1 publication retains its exact transport bytes and no assessment fields', () => {
  const original = archived.packedMeanings
  const decoded = unpackMeaningLexicon(original)
  const repacked = packMeaningLexicon(decoded)
  assert.equal(repacked.packingVersion, MEANING_PACKING_VERSION)
  assert.equal(JSON.stringify(repacked), JSON.stringify(original))
  assert.equal(Object.hasOwn(repacked, 'assessments'), false)
  assert.equal(Object.hasOwn(decoded, 'assessment'), false)
  assert.ok(Object.values(decoded.words).every(word => !Object.hasOwn(word, 'assessment')))
})

test('model-era records cannot omit assessment evidence or detach it from metadata', () => {
  for (const mutate of [
    (value: PuzzleMeaningLexicon) => { delete value.words.CALM.assessment },
    (value: PuzzleMeaningLexicon) => { value.words.CALM.evidence = 'defined-neutral' },
    (value: PuzzleMeaningLexicon) => { delete value.assessment },
    (value: PuzzleMeaningLexicon) => { value.words.CALM.assessment = { ...scores, counterScore: NaN } },
    (value: PuzzleMeaningLexicon) => { value.assessment = { ...metadata, assessedWords: 1 } },
    (value: PuzzleMeaningLexicon) => { value.words.CALM.assessment = { ...scores, sensesEvaluated: 10 } },
  ]) {
    const corrupted = structuredClone(lexicon)
    mutate(corrupted)
    assert.throws(() => packMeaningLexicon(corrupted))
    assert.throws(() => validateMeaningLexicon({ ...physical, meaningLexicon: corrupted }))
  }
})

test('decoder rejects missing, nonfinite, unsupported and out-of-range model evidence', () => {
  const corruptions: ((value: ReturnType<typeof JSON.parse>) => void)[] = [
    value => { delete value.lexicon.assessment },
    value => { value.lexicon.assessment = null },
    value => { value.lexicon.assessment.modelRevision = '' },
    value => { value.lexicon.assessment.cacheDigest = ' ' },
    value => { value.lexicon.assessment.method = 'runtime-api' },
    value => { value.lexicon.assessment.assessedWords = 2 },
    value => { value.lexicon.assessment.assessedSenses = 1 },
    value => { value.lexicon.assessment.assessedWords = Infinity },
    value => { value.lexicon.assessment.futureField = true },
    value => { delete value.assessments },
    value => { value.assessments = {} },
    value => { value.assessments[0] = null },
    value => { value.assessments[0].counterScore = NaN },
    value => { value.assessments[0].counterScore = -0.01 },
    value => { value.assessments[0].resistedScore = Infinity },
    value => { value.assessments[0].resistedScore = 1.01 },
    value => { value.assessments[0].margin = -1.01 },
    value => { value.assessments[0].sensesEvaluated = 0 },
    value => { value.assessments[0].sensesEvaluated = 1.5 },
    value => { value.assessments[0].selectedAnchor = ' ' },
    value => { value.assessments[0].futureField = true },
    value => { value.records[0][8] = -1 },
    value => { value.records[0][8] = 99 },
    value => { value.records[0].pop() },
    value => { value.strings[value.records[0][7]] = 'defined-neutral' },
    value => { value.packingVersion = MEANING_PACKING_VERSION },
  ]
  for (const corrupt of corruptions) {
    const packed = structuredClone(packMeaningLexicon(lexicon))
    corrupt(packed)
    assert.throws(() => unpackMeaningLexicon(packed), /Invalid packed puzzle meanings/)
  }
  const old = structuredClone(archived.packedMeanings)
  ;(old as unknown as { assessments: unknown[] }).assessments = []
  assert.throws(() => unpackMeaningLexicon(old), /assessment table/)
})

test('stored assessment validators accept each offline method and score boundaries', () => {
  for (const method of ['embedding', 'embedding-nli', 'local-llm'] as const) {
    assert.equal(readSemanticAssessmentMetadata({ ...metadata, method }).method, method)
  }
  assert.deepEqual(readWordSemanticAssessment({ ...scores, counterScore: 0, resistedScore: 1, margin: -1 }),
    { ...scores, counterScore: 0, resistedScore: 1, margin: -1 })
  assert.deepEqual(readWordSemanticAssessment({ ...scores, counterScore: 1, resistedScore: 0, margin: 1 }),
    { ...scores, counterScore: 1, resistedScore: 0, margin: 1 })
})

test('per-inventory LLM refinement metadata round-trips and freezes without altering baseline scores', () => {
  const refinement = { version: 'refinement-1', modelId: 'local/llm', modelRevision: 'pinned', modelDigest: 'weights',
    promptDigest: 'prompt', eligibilityPolicyDigest: 'policy', baseCacheDigest: metadata.cacheDigest,
    inventoryDigest: 'inventory', cacheDigest: 'memo-subset', eligibleWords: 2, reviewedWords: 2 }
  const refined = { ...lexicon, assessment: { ...metadata, refinement }, words: { ...lexicon.words,
    CALM: { ...calm, assessment: { ...scores, decisionBasis: 'local-llm' } },
    CALMS: { ...calm, assessment: { ...scores, decisionBasis: 'local-llm' } },
  } }
  const restored = unpackMeaningLexicon(packMeaningLexicon(refined))
  assert.equal(JSON.stringify(restored), JSON.stringify(refined))
  assert.ok(Object.isFrozen(restored.assessment!.refinement))
  assert.equal(restored.words.CALM.assessment!.counterScore, scores.counterScore)
  assert.equal(Object.isFrozen(refinement), false)
  assert.doesNotThrow(() => validateMeaningLexicon({ ...physical, meaningLexicon: restored }))
  assert.throws(() => validateMeaningLexicon({ ...physical, meaningLexicon: { ...restored, assessment: metadata } }))
  assert.throws(() => validateMeaningLexicon({ ...physical, meaningLexicon: { ...restored, assessment: { ...metadata, refinement: { ...refinement, reviewedWords: 1 } } } }))
  for (const invalid of [null, { ...refinement, unexpected: true }, { ...refinement, modelDigest: '' },
    { ...refinement, eligibleWords: -1 }, { ...refinement, reviewedWords: 3 }, { ...refinement, reviewedWords: NaN }]) {
    assert.throws(() => readSemanticAssessmentMetadata({ ...metadata, refinement: invalid }))
  }
  assert.doesNotThrow(() => readSemanticAssessmentMetadata({ ...metadata, refinement: { ...refinement, eligibleWords: 0, reviewedWords: 0 } }))
})
