import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'
import type { PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import type { SemanticAssessmentMetadata } from '../src/game/semanticAssessment.ts'
import { createSemanticRefinementProvider, semanticBaseWordDigest, semanticRefinementDigest,
  semanticRefinementInput, semanticRetrievalDigest } from '../src/generator/semanticRefinement.ts'
import type { RefinementCache, RefinementMemo } from '../src/generator/semanticRefinement.ts'

const words = ['ALPHA', 'BETA', 'GAMMA', 'OMEGA']
const header: SemanticAssessmentMetadata = { version: 'fixture-vector-1', modelId: 'vector', modelRevision: 'v1',
  sourceDigest: 'source', policyDigest: 'baseline-policy', cacheDigest: 'baseline-cache', method: 'embedding-nli',
  assessedWords: 4, assessedSenses: 8 }
const base = { metadata: () => header, definition: () => 'A state of disorder.' }
function meaning(word: string, basis: string, relation: PuzzleWordMeaning['relation'] = 'unrelated'): PuzzleWordMeaning {
  return { lemma: word.toLowerCase(), senseId: `${word}-base`, definition: `The default ${word} sense.`, partsOfSpeech: ['noun'],
    source: 'oewn-2025', relation, reason: 'Vector evidence.', evidence: 'model-assessed',
    assessment: { counterScore: 0.8, resistedScore: 0.1, margin: 0.7, sensesEvaluated: 2,
      selectedAnchor: 'order', decisionBasis: basis } }
}
function fixture() {
  const inventory = { ALPHA: meaning('ALPHA', 'local-vector-nli', 'opposite'),
    BETA: meaning('BETA', 'local-vector-nli-neutral'), GAMMA: meaning('GAMMA', 'local-vector-nli-neutral'),
    OMEGA: meaning('OMEGA', 'reviewed-profile', 'similar') }
  const cache: RefinementCache = { version: 'wyrmle-semantic-refinement-cache-1', dictionaryVersion: MEANING_DICTIONARY_VERSION,
    words: [...words], senses: [
      { id: 'ALPHA-qualified', lemma: 'alpha', definition: 'An unrelated interpretation.', partOfSpeech: 'noun', source: 'oewn-2025' },
      { id: 'BETA-qualified', lemma: 'beta', definition: 'To restore order.', partOfSpeech: 'verb', source: 'oewn-2025' },
    ], enemies: { CHAOS: { manifest: { version: 'refinement-fixture-1', modelId: 'llm', modelRevision: 'commit', modelDigest: 'weights',
      promptDigest: 'prompt', policyDigest: 'policy', sourceDigest: 'source', baseCacheDigest: 'baseline-cache', retrievalDigest: '',
      threshold: 0.5, trustedDecisionBases: ['reviewed-profile', 'lexical-expansion', 'source-direction-proof'] },
    retrieval: [[0.8, 0.4, 0.6, [0]], [0.3, 0.6, 0.2, [1]], [0.2, 0.1, 0.3, []], [0.8, 0.5, 0.6, [0]]], records: {} } } }
  const table = cache.enemies.CHAOS
  table.manifest.retrievalDigest = semanticRetrievalDigest(cache.words, cache.senses, table.retrieval)
  function memo(word: 'ALPHA' | 'BETA', relation: 'opposite' | 'similar' | 'neutral'): RefinementMemo {
    const source = inventory[word]
    const senses = table.retrieval[words.indexOf(word)][3].map(index => cache.senses[index])
    return { status: 'ok', relation, senseId: relation === 'neutral' ? source.senseId : senses[0].id,
      explanation: 'A judgement of the admitted definitions.', rawResponse: relation,
      inputDigest: semanticRefinementDigest(semanticRefinementInput(table.manifest, 'CHAOS', base.definition(), senses)),
      baseWordDigest: semanticBaseWordDigest(source), policyDigest: 'policy', sourceDigest: 'source',
      modelId: 'llm', modelRevision: 'commit', modelDigest: 'weights', promptDigest: 'prompt' }
  }
  return { cache, inventory, table, memo, provider: () => createSemanticRefinementProvider(cache, base, words) }
}

test('every novel positive and retrieved neutral requires review; trusted and unretrieved senses retain explicit baseline scope', () => {
  const { inventory, provider } = fixture()
  const result = provider().refine('CHAOS', inventory)
  assert.equal(result.ready, false)
  assert.equal(result.eligibleWords, 2)
  assert.equal(result.reviewedWords, 0)
  assert.equal(result.words.ALPHA.relation, 'opposite', 'Drafts retain the baseline rather than pretending missing LLM output is neutral.')
  assert.deepEqual(result.issues, ['ALPHA: missing LLM review', 'BETA: missing LLM review'])
  assert.equal(result.words.GAMMA.assessment!.decisionBasis, 'local-vector-nli-neutral')
  assert.equal(result.words.OMEGA.assessment!.decisionBasis, 'reviewed-profile')
})

test('complete decisions select admitted definitions while retaining original vector scores and immutable provenance', () => {
  const { inventory, provider, memo, table } = fixture()
  table.records.ALPHA = memo('ALPHA', 'neutral'); table.records.BETA = memo('BETA', 'opposite')
  const result = provider().refine('CHAOS', inventory)
  assert.equal(result.ready, true)
  assert.equal(result.metadata!.eligibleWords, 2)
  assert.equal(result.metadata!.reviewedWords, 2)
  assert.equal(result.words.ALPHA.relation, 'unrelated')
  assert.equal(result.words.ALPHA.senseId, inventory.ALPHA.senseId)
  assert.equal(result.words.BETA.relation, 'opposite')
  assert.equal(result.words.BETA.senseId, 'BETA-qualified')
  assert.equal(result.words.BETA.definition, 'To restore order.')
  assert.deepEqual(result.words.BETA.partsOfSpeech, ['noun', 'verb'])
  for (const word of ['ALPHA', 'BETA']) {
    assert.equal(result.words[word].assessment!.counterScore, 0.8)
    assert.equal(result.words[word].assessment!.decisionBasis, 'local-llm')
    assert.ok(Object.isFrozen(result.words[word].assessment))
  }
  assert.ok(Object.isFrozen(result.metadata)); assert.ok(Object.isFrozen(result.words))
  assert.equal(inventory.ALPHA.relation, 'opposite')
})

test('missing, failed, stale and foreign-sense memos fail release readiness without inventing classifications', () => {
  const patches: Partial<RefinementMemo>[] = [
    { modelRevision: 'other' }, { modelId: 'other' }, { modelDigest: 'other' }, { promptDigest: 'other' },
    { policyDigest: 'other' }, { sourceDigest: 'other' }, { baseWordDigest: 'other' }, { inputDigest: 'other' },
    { status: 'error', error: 'Invalid model JSON.' }, { status: 'ok', senseId: 'BETA-qualified' },
  ]
  for (const patch of patches) {
    const { inventory, provider, memo, table } = fixture()
    table.records.ALPHA = { ...memo('ALPHA', 'opposite'), ...patch } as RefinementMemo
    const result = provider().refine('CHAOS', { ALPHA: inventory.ALPHA })
    assert.equal(result.ready, false, JSON.stringify(patch))
    assert.equal(result.reviewedWords, 0)
    assert.equal(result.words.ALPHA.assessment!.decisionBasis, 'local-vector-nli')
  }
})

test('memo growth outside an inventory preserves its exact frozen refinement digest', () => {
  const { inventory, provider, memo, table } = fixture()
  table.records.ALPHA = memo('ALPHA', 'neutral')
  const before = provider().refine('CHAOS', { ALPHA: inventory.ALPHA })
  table.records.BETA = memo('BETA', 'opposite')
  const after = provider().refine('CHAOS', { ALPHA: inventory.ALPHA })
  assert.deepEqual(after, before)
  const broader = provider().refine('CHAOS', { ALPHA: inventory.ALPHA, BETA: inventory.BETA })
  assert.notEqual(broader.metadata!.inventoryDigest, before.metadata!.inventoryDigest)
  assert.notEqual(broader.metadata!.cacheDigest, before.metadata!.cacheDigest)
})

test('retrieval coverage, threshold, trusted-source policy and immutable artifact hashes are checked before use', () => {
  for (const mutate of [
    (cache: RefinementCache) => { cache.words.pop() },
    (cache: RefinementCache) => { cache.enemies.CHAOS.retrieval.pop() },
    (cache: RefinementCache) => { cache.enemies.CHAOS.retrieval[0][0] = Number.NaN },
    (cache: RefinementCache) => { cache.enemies.CHAOS.retrieval[0][3] = [999] },
    (cache: RefinementCache) => { cache.enemies.CHAOS.manifest.trustedDecisionBases.push('local-vector-nli') },
    (cache: RefinementCache) => { cache.enemies.CHAOS.manifest.retrievalDigest = 'other' },
  ]) {
    const { cache, provider } = fixture(); mutate(cache); assert.throws(provider)
  }
  const { inventory, provider, table } = fixture()
  table.manifest.baseCacheDigest = 'old-baseline'
  const stale = provider().refine('CHAOS', inventory)
  assert.equal(stale.ready, false)
  assert.equal(stale.metadata, undefined)
})

test('editing a mutable caller-supplied baseline cannot reuse its earlier word digest', () => {
  const { inventory, provider, memo, table } = fixture()
  table.records.ALPHA = memo('ALPHA', 'neutral')
  const active = provider()
  assert.equal(active.refine('CHAOS', { ALPHA: inventory.ALPHA }).ready, true)
  inventory.ALPHA.definition = 'Changed after the LLM assessment.'
  const changed = active.refine('CHAOS', { ALPHA: inventory.ALPHA })
  assert.equal(changed.ready, false)
  assert.match(changed.issues[0], /stale LLM input/)
})
