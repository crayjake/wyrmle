import assert from 'node:assert/strict'
import test from 'node:test'
import { verifySenseDecisions } from '../scripts/package-semantic-refinement.ts'
import type { RefinementMemo, RefinementSense } from '../src/generator/semanticRefinement.ts'
import { semanticRefinementDigest } from '../src/generator/semanticRefinement.ts'

test('packaging independently binds every category, final label and displayed definition to the actual response', () => {
  const senses: RefinementSense[] = [
    { id: 'physical', lemma: 'test', definition: 'A physical object.', partOfSpeech: 'noun', source: 'oewn-2025' },
    { id: 'order', lemma: 'test', definition: 'To arrange in order.', partOfSpeech: 'verb', source: 'oewn-2025' },
  ]
  const policy = { senseCategories: { OTHER: 'other', ORDER: 'order' }, categoryNames: { ORDER: 'order' },
    categoryRelations: { CHAOS: { ORDER: 'opposite' } }, relationPriority: ['opposite', 'similar'] }
  const raw = { senses: senses.map((sense, index) => ({ index, definition: sense.definition, categories: [index ? 'ORDER' : 'OTHER'] })) }
  const memo: RefinementMemo = { status: 'ok', relation: 'opposite', senseId: 'order',
    explanation: 'This sense expresses order, which counters CHAOS.', rawResponse: JSON.stringify(raw),
    inputDigest: 'test', policyDigest: 'test', sourceDigest: 'test', baseWordDigest: 'test',
    modelId: 'test', modelRevision: 'test', modelDigest: 'test', promptDigest: 'test' }
  assert.doesNotThrow(() => verifySenseDecisions(policy, 'CHAOS', senses, memo))
  for (const change of [
    { relation: 'similar' }, { senseId: 'physical' }, { explanation: 'A misleading explanation.' },
    { rawResponse: JSON.stringify({ senses: raw.senses.slice(0, 1) }) },
    { rawResponse: JSON.stringify({ senses: [...raw.senses].reverse() }) },
    { rawResponse: JSON.stringify({ senses: raw.senses.map(row => ({ ...row, definition: 'Invented source.' })) }) },
    { rawResponse: JSON.stringify({ senses: raw.senses.map(row => ({ ...row, categories: ['OTHER'] })) }) },
  ]) assert.throws(() => verifySenseDecisions(policy, 'CHAOS', senses, { ...memo, ...change } as RefinementMemo))
  const independentPolicy = { ...policy, independentSenseInference: true }
  const envelope = { senses: raw.senses.map((row, index) => {
    const { id, lemma, definition, partOfSpeech } = senses[index]
    return { ...row, response: JSON.stringify({ categories: row.categories }),
      inputDigest: semanticRefinementDigest({ sense: { id, lemma, definition, partOfSpeech },
        promptDigest: memo.promptDigest, policyDigest: memo.policyDigest, sourceDigest: memo.sourceDigest }) }
  }) }
  const withEnvelope = { ...memo, rawResponse: JSON.stringify(envelope) }
  assert.doesNotThrow(() => verifySenseDecisions(independentPolicy, 'CHAOS', senses, withEnvelope))
  envelope.senses[1].response = '{"categories":["OTHER"]}'
  assert.throws(() => verifySenseDecisions(independentPolicy, 'CHAOS', senses,
    { ...memo, rawResponse: JSON.stringify(envelope) }), /actual individual model response/)

  const verifiedPolicy = { ...independentPolicy, verification: { scoringCategories: ['ORDER'],
    proposalPolicyDigest: 'proposal-policy', proposalPromptDigest: 'proposal-prompt' } }
  const verified = { senses: envelope.senses.map((row, index) => {
    const { id, lemma, definition, partOfSpeech } = senses[index]
    const response = JSON.stringify({ categories: raw.senses[index].categories })
    return { ...row, response, verified: index === 1, proposal: { response,
      inputDigest: semanticRefinementDigest({ sense: { id, lemma, definition, partOfSpeech },
        promptDigest: 'proposal-prompt', policyDigest: 'proposal-policy', sourceDigest: memo.sourceDigest }) } }
  }) }
  assert.doesNotThrow(() => verifySenseDecisions(verifiedPolicy, 'CHAOS', senses, { ...memo, rawResponse: JSON.stringify(verified) }))
  verified.senses[1].verified = false
  assert.throws(() => verifySenseDecisions(verifiedPolicy, 'CHAOS', senses, { ...memo, rawResponse: JSON.stringify(verified) }), /requires verification/)
  verified.senses[1].verified = true
  verified.senses[1].proposal.inputDigest = 'changed-source'
  assert.throws(() => verifySenseDecisions(verifiedPolicy, 'CHAOS', senses, { ...memo, rawResponse: JSON.stringify(verified) }))
  const cuePolicy = { ...verifiedPolicy, verification: { ...verifiedPolicy.verification, cuePatterns: { ORDER: 'physical' } } }
  const withCues = { senses: envelope.senses.map((row, index) => {
    const { id, lemma, definition, partOfSpeech } = senses[index]
    const response = JSON.stringify({ categories: raw.senses[index].categories })
    return { ...row, response, verified: true, cueCategories: index ? [] : ['ORDER'], proposal: { response,
      inputDigest: semanticRefinementDigest({ sense: { id, lemma, definition, partOfSpeech },
        promptDigest: 'proposal-prompt', policyDigest: 'proposal-policy', sourceDigest: memo.sourceDigest }) } }
  }) }
  // The deliberately broad test cue nominates the object, but the actual
  // verifier's OTHER response keeps it neutral; the action still supports ORDER.
  assert.doesNotThrow(() => verifySenseDecisions(cuePolicy, 'CHAOS', senses, { ...memo, rawResponse: JSON.stringify(withCues) }))
  withCues.senses[0].verified = false
  assert.throws(() => verifySenseDecisions(cuePolicy, 'CHAOS', senses, { ...memo, rawResponse: JSON.stringify(withCues) }), /requires verification/)
})

test('source preference cannot override the reviewed relation and otherwise prefers a direct action', () => {
  const senses: RefinementSense[] = [
    { id: 'oewn-test__1.14.00..', lemma: 'test', definition: 'A classified collection.', partOfSpeech: 'noun', source: 'oewn-2025' },
    { id: 'oewn-test__2.36.00..', lemma: 'test', definition: 'To classify systematically.', partOfSpeech: 'verb', source: 'oewn-2025' },
    { id: 'oewn-test__3.00.00..', lemma: 'test', definition: 'Unrelated.', partOfSpeech: 'adjective', source: 'oewn-2025' },
  ]
  const lexnames: string[] = []
  lexnames[14] = 'noun.group'; lexnames[36] = 'verb.creation'; lexnames[0] = 'adj.all'
  const policy = { senseCategories: { OTHER: 'other', ORDER: 'order' }, categoryNames: { ORDER: 'order' },
    categoryRelations: { CHAOS: { ORDER: 'opposite' } }, relationPriority: ['similar', 'opposite'],
    sourceSelection: 'baseline-agreement-then-directness-v1', sourceDomainPriority: { 'noun.group': 4, 'verb.creation': 1, 'adj.all': 0 } }
  const raw = { senses: senses.map((sense, index) => ({ index, definition: sense.definition, categories: [index === 2 ? 'OTHER' : 'ORDER'] })) }
  const memo: RefinementMemo = { status: 'ok', relation: 'opposite', senseId: senses[1].id,
    explanation: 'This sense expresses order, which counters CHAOS.', rawResponse: JSON.stringify(raw),
    inputDigest: 'test', policyDigest: 'test', sourceDigest: 'test', baseWordDigest: 'test',
    modelId: 'test', modelRevision: 'test', modelDigest: 'test', promptDigest: 'test' }
  assert.doesNotThrow(() => verifySenseDecisions(policy, 'CHAOS', senses, memo, senses[2].id, lexnames))
  assert.throws(() => verifySenseDecisions(policy, 'CHAOS', senses, { ...memo, senseId: senses[2].id }, senses[2].id, lexnames))
  assert.doesNotThrow(() => verifySenseDecisions(policy, 'CHAOS', senses, { ...memo, senseId: senses[0].id }, senses[0].id, lexnames))
  const neutral = { ...memo, relation: 'neutral' as const, senseId: senses[2].id,
    explanation: 'None of the reviewed dictionary senses directly counters or reinforces CHAOS.',
    rawResponse: JSON.stringify({ senses: raw.senses.map(row => ({ ...row, categories: ['OTHER'] })) }) }
  assert.doesNotThrow(() => verifySenseDecisions(policy, 'CHAOS', senses, neutral, senses[2].id, lexnames))
})
