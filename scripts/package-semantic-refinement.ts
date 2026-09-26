/** Build a complete retrieval index and contextual memo cache for offline authoring. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { getDefinedDictionaryWords, MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'
import { semanticAssessmentProvider } from '../src/generator/semanticAssessments.ts'
import { createSemanticRefinementProvider, semanticRefinementDigest, semanticRetrievalDigest } from '../src/generator/semanticRefinement.ts'
import type { RefinementCache, RefinementManifest, RefinementMemo, RefinementSense } from '../src/generator/semanticRefinement.ts'
import lock from './semantics/model-lock.json' with { type: 'json' }

/** Independently derive a memo from the model's complete per-sense response. */
export function verifySenseDecisions(policy: { senseCategories: Record<string, string>; categoryNames: Record<string, string>
  categoryRelations: Record<string, Record<string, string>>; relationPriority: string[]; independentSenseInference?: boolean
  sourceSelection?: string; sourceDomainPriority?: Record<string, number>
  verification?: { scoringCategories: string[]; proposalPromptDigest: string; proposalPolicyDigest: string; cuePatterns?: Record<string, string> } },
enemy: string, senses: readonly RefinementSense[], memo: RefinementMemo, preferredSenseId?: string, lexnames: readonly string[] = []): void {
  if (memo.status !== 'ok') return
  const body = JSON.parse(memo.rawResponse)
  assert.deepEqual(Object.keys(body), ['senses'])
  assert.ok(Array.isArray(body.senses))
  assert.equal(body.senses.length, senses.length, 'Every source sense requires an explicit decision.')
  const candidates: { relation: string; index: number; category: string }[] = []
  for (const [index, sense] of senses.entries()) {
    const row = body.senses[index]
    assert.deepEqual(Object.keys(row).sort(), policy.verification?.cuePatterns
      ? ['categories', 'cueCategories', 'definition', 'index', 'inputDigest', 'proposal', 'response', 'verified']
      : policy.verification ? ['categories', 'definition', 'index', 'inputDigest', 'proposal', 'response', 'verified']
      : policy.independentSenseInference ? ['categories', 'definition', 'index', 'inputDigest', 'response'] : ['categories', 'definition', 'index'])
    assert.equal(row.index, index)
    assert.equal(row.definition, sense.definition, 'A category must refer to the exact indexed source definition.')
    assert.ok(Array.isArray(row.categories) && row.categories.length > 0 && row.categories.length <= 4)
    assert.equal(new Set(row.categories).size, row.categories.length)
    assert.ok(!row.categories.includes('OTHER') || row.categories.length === 1)
    if (policy.independentSenseInference) {
      assert.deepEqual(JSON.parse(row.response), { categories: row.categories }, 'Categories differ from the actual individual model response.')
      const { id, lemma, definition, partOfSpeech } = sense
      assert.equal(row.inputDigest, semanticRefinementDigest({ sense: { id, lemma, definition, partOfSpeech },
        promptDigest: memo.promptDigest, policyDigest: memo.policyDigest, sourceDigest: memo.sourceDigest }))
    }
    if (policy.verification) {
      assert.deepEqual(Object.keys(row.proposal).sort(), ['inputDigest', 'response'])
      const { id, lemma, definition, partOfSpeech } = sense
      assert.equal(row.proposal.inputDigest, semanticRefinementDigest({ sense: { id, lemma, definition, partOfSpeech },
        promptDigest: policy.verification.proposalPromptDigest, policyDigest: policy.verification.proposalPolicyDigest,
        sourceDigest: memo.sourceDigest }))
      const proposal = JSON.parse(row.proposal.response)
      assert.deepEqual(Object.keys(proposal), ['categories'])
      assert.ok(Array.isArray(proposal.categories) && proposal.categories.length > 0 && proposal.categories.length <= 4)
      assert.equal(new Set(proposal.categories).size, proposal.categories.length)
      assert.ok(!proposal.categories.includes('OTHER') || proposal.categories.length === 1)
      assert.ok(proposal.categories.every((category: unknown) => typeof category === 'string' && Object.hasOwn(policy.senseCategories, category)))
      let scoring: string[] = proposal.categories.filter((category: string) => policy.verification!.scoringCategories.includes(category))
      if (policy.verification.cuePatterns) {
        const cues = Object.entries(policy.verification.cuePatterns)
          .filter(([, pattern]) => new RegExp(pattern, 'i').test(`${sense.lemma}\n${sense.definition}`)).map(([category]) => category).sort()
        assert.deepEqual(row.cueCategories, cues, 'Source-text proposals differ from the frozen cue policy.')
        scoring = [...new Set([...scoring, ...cues])].sort()
      }
      assert.equal(row.verified, scoring.length > 0, 'Every proposed scoring sense requires verification.')
      if (scoring.length) assert.ok(row.categories.every((category: string) => category === 'OTHER' || scoring.includes(category)), 'Verification cannot introduce unproposed categories.')
      else assert.equal(row.response, row.proposal.response, 'An unverified non-scoring response cannot change.')
    }
    for (const category of row.categories) {
      assert.ok(typeof category === 'string' && Object.hasOwn(policy.senseCategories, category))
      const relation = policy.categoryRelations[enemy][category] ?? 'neutral'
      assert.ok(['opposite', 'similar', 'neutral'].includes(relation))
      if (relation !== 'neutral') candidates.push({ relation, index, category })
    }
  }
  const preferred = (index: number) => policy.sourceSelection ? Number(senses[index].id !== preferredSenseId) : 0
  const directness = (index: number) => {
    if (!policy.sourceSelection) return 0
    const parts = senses[index].id.split('__').at(-1)!.split('.')
    const domain = parts.length > 3 && /^\d+$/.test(parts[1]) ? lexnames[Number(parts[1])] : 'function word'
    return policy.sourceDomainPriority?.[domain] ?? 5
  }
  candidates.sort((a, b) => policy.relationPriority.indexOf(a.relation) - policy.relationPriority.indexOf(b.relation)
    || preferred(a.index) - preferred(b.index) || directness(a.index) - directness(b.index)
    || a.index - b.index || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0))
  const selected = candidates[0]
  const neutralIndex = policy.sourceSelection ? Math.max(0, senses.findIndex(sense => sense.id === preferredSenseId)) : 0
  assert.equal(memo.relation, selected?.relation ?? 'neutral', 'Memo label differs from the actual per-sense model decisions.')
  assert.equal(memo.senseId, senses[selected?.index ?? neutralIndex].id, 'Memo source differs from the actual per-sense model decisions.')
  const explanation = selected
    ? `This sense expresses ${policy.categoryNames[selected.category]}, which ${selected.relation === 'opposite' ? 'counters' : 'reinforces'} ${enemy}.`
    : `None of the reviewed dictionary senses directly counters or reinforces ${enemy}.`
  assert.equal(memo.explanation, explanation)
}

export function packageSemanticRefinement(sourcePath: string, retrievalDirectory: string, manifestPath: string, memoDirectory: string): RefinementCache {
  const { sourceDigest, ...source } = JSON.parse(readFileSync(sourcePath, 'utf8'))
  assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'), sourceDigest, 'Source export changed.')
  assert.equal(source.dictionaryVersion, MEANING_DICTIONARY_VERSION)
  const spec = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(semanticRefinementDigest(spec.prompt), spec.manifest.promptDigest, 'Prompt digest mismatch.')
  assert.equal(semanticRefinementDigest(spec.policy), spec.manifest.policyDigest, 'Policy digest mismatch.')
  if (spec.policy.verification) {
    assert.equal(spec.proposal.policy.independentSenseInference, true)
    assert.equal(spec.proposal.policy.verification, undefined)
    assert.equal(semanticRefinementDigest(spec.proposal), spec.policy.verification.proposalSpecDigest)
    assert.equal(semanticRefinementDigest(spec.proposal.policy), spec.policy.verification.proposalPolicyDigest)
    assert.equal(semanticRefinementDigest(spec.proposal.prompt), spec.policy.verification.proposalPromptDigest)
    assert.equal(spec.proposal.manifest.policyDigest, spec.policy.verification.proposalPolicyDigest)
    assert.equal(spec.proposal.manifest.promptDigest, spec.policy.verification.proposalPromptDigest)
    for (const key of ['modelId', 'modelRevision', 'modelDigest', 'sourceDigest']) assert.equal(spec.proposal.manifest[key], spec.manifest[key])
    assert.deepEqual([...spec.policy.verification.scoringCategories].sort(), [...new Set<string>(Object.values(spec.policy.categoryRelations)
      .flatMap(relations => Object.keys(relations as object)))].sort(), 'All scoring categories require verification.')
    assert.deepEqual(Object.keys(spec.policy.senseCategories).sort(), Object.keys(spec.proposal.policy.senseCategories).sort())
    for (const [category, pattern] of Object.entries(spec.policy.verification.cuePatterns ?? {})) {
      assert.ok(spec.policy.verification.scoringCategories.includes(category))
      assert.equal(typeof pattern, 'string')
      assert.doesNotThrow(() => new RegExp(pattern as string, 'i'))
    }
  }
  assert.equal(spec.manifest.sourceDigest, sourceDigest)
  assert.equal(spec.manifest.threshold, spec.policy.cosineMinimum)
  const exhaustive = spec.manifest.reviewScope === 'all-source-senses'
  assert.equal(exhaustive, spec.policy.reviewScope === 'all-source-senses')
  assert.equal(spec.manifest.sourceSelection, spec.policy.sourceSelection)
  assert.ok(Number.isFinite(spec.manifest.threshold) && (exhaustive ? spec.manifest.threshold === -1 : spec.manifest.threshold > 0 && spec.manifest.threshold <= 1))
  const words = [...getDefinedDictionaryWords()]
  assert.deepEqual(Object.keys(source.words), words)
  const cache: RefinementCache = { version: 'wyrmle-semantic-refinement-cache-1', dictionaryVersion: MEANING_DICTIONARY_VERSION,
    words, senses: [], enemies: {} }
  const rawTables: Record<string, { metadata: Record<string, unknown>; words: Record<string, { maxima: number[]; qualifiedSenseIds: string[] }> }> = {}
  const sourceIds = new Set<string>()
  for (const enemy of Object.keys(source.profiles).sort()) {
    const raw = JSON.parse(gunzipSync(readFileSync(join(retrievalDirectory, `${enemy.toLowerCase()}.json.gz`))).toString('utf8'))
    const base = semanticAssessmentProvider.metadata(enemy)
    assert.equal(raw.enemyWord, enemy)
    assert.equal(raw.metadata.sourceDigest, sourceDigest)
    assert.equal(raw.metadata.baseRawSha256, base.cacheDigest, `${enemy}: stale retrieval baseline`)
    assert.equal(raw.metadata.baseConfigurationHash, base.policyDigest)
    assert.equal(raw.metadata.embeddingModelId, lock.models.embedding.repository)
    assert.equal(raw.metadata.embeddingRevision, lock.models.embedding.revision)
    assert.equal(raw.metadata.modelLockDigest, semanticRefinementDigest(lock))
    assert.equal(raw.metadata.threshold, spec.manifest.threshold)
    if (exhaustive) assert.equal(raw.metadata.reviewScope, 'all-source-senses')
    assert.equal(raw.metadata.wordsAssessed, words.length)
    assert.equal(raw.metadata.sensesAssessed, Object.keys(source.senses).length)
    assert.deepEqual(raw.metadata.channels, ['lemma-definition', 'definition', 'lemma'])
    assert.deepEqual(Object.keys(raw.words).sort(), words)
    const excluded = new Set(source.profiles[enemy].excludedSenseIds)
    for (const word of words) {
      const row = raw.words[word]
      assert.ok(Array.isArray(row.maxima) && row.maxima.length === 3 && row.maxima.every((score: unknown) => typeof score === 'number'
        && Number.isFinite(score) && score >= -1.00001 && score <= 1.00001), `${enemy}/${word}: invalid retrieval scores`)
      assert.ok(Array.isArray(row.qualifiedSenseIds))
      assert.equal(new Set(row.qualifiedSenseIds).size, row.qualifiedSenseIds.length)
      for (const id of row.qualifiedSenseIds) {
        assert.ok(source.words[word].includes(id), `${enemy}/${word}: foreign source sense ${id}`)
        if (!exhaustive) assert.ok(!excluded.has(id), `${enemy}/${word}: excluded source sense ${id}`)
        assert.ok(source.senses[id]?.definition.trim())
        sourceIds.add(id)
      }
      if (exhaustive) assert.deepEqual([...row.qualifiedSenseIds].sort(), [...source.words[word]].sort(), `${enemy}/${word}: omitted dictionary senses`)
      assert.ok(!row.qualifiedSenseIds.length || Math.max(...row.maxima) >= spec.manifest.threshold)
    }
    rawTables[enemy] = raw
  }
  cache.senses = [...sourceIds].sort().map(id => source.senses[id] as RefinementSense)
  const indices = new Map(cache.senses.map((sense, index) => [sense.id, index]))
  for (const [enemy, raw] of Object.entries(rawTables)) {
    // Exact qualified IDs retain the inference boundary; display scores use four decimals.
    // Clamp only the tiny numerical overshoot possible with normalized float vectors.
    const retrieval = words.map(word => {
      const row = raw.words[word]
      return [...row.maxima.map(score => Math.round(Math.max(-1, Math.min(1, score)) * 10000) / 10000),
        [...row.qualifiedSenseIds].sort().map(id => indices.get(id)!)] as RefinementCache['enemies'][string]['retrieval'][number]
    })
    const memoPath = join(memoDirectory, `${enemy.toLowerCase()}.json`)
    const memo = existsSync(memoPath) ? JSON.parse(readFileSync(memoPath, 'utf8')) : {}
    const records = (memo.records ?? memo) as Record<string, RefinementMemo>
    if (spec.policy.senseCategories) for (const [word, record] of Object.entries(records)) {
      assert.ok(raw.words[word], `Unknown reviewed spelling ${word}.`)
      verifySenseDecisions(spec.policy, enemy, [...raw.words[word].qualifiedSenseIds].sort().map(id => source.senses[id]), record,
        semanticAssessmentProvider.word(enemy, word).senseId, spec.prompt.lexnames)
    }
    const manifest: RefinementManifest = { ...spec.manifest,
      baseCacheDigest: semanticAssessmentProvider.metadata(enemy).cacheDigest,
      recordsDigest: semanticRefinementDigest(records),
      retrievalDigest: semanticRetrievalDigest(words, cache.senses, retrieval) }
    cache.enemies[enemy] = { manifest, retrieval, records }
  }
  const provider = createSemanticRefinementProvider(cache)
  for (const [enemy, table] of Object.entries(cache.enemies)) for (const [word, memo] of Object.entries(table.records)) {
    const result = provider.refine(enemy, { [word]: semanticAssessmentProvider.word(enemy, word) })
    // Failed inference is retained for diagnosis. It must never satisfy a release gate.
    if (memo.status === 'ok') assert.ok(result.ready, `${enemy}/${word}: ${result.issues.join('; ')}`)
    else assert.equal(memo.status, 'error', `${enemy}/${word}: unsupported memo status`)
  }
  return cache
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, retrieval, manifest, memos, output] = process.argv.slice(2)
  if (!source || !retrieval || !manifest || !memos || !output) throw new Error('Usage: node scripts/package-semantic-refinement.ts SOURCE.json RETRIEVAL_DIRECTORY MANIFEST.json MEMO_DIRECTORY OUTPUT.json')
  const cache = packageSemanticRefinement(source, retrieval, manifest, memos)
  writeFileSync(output, JSON.stringify(cache) + '\n')
  console.log(JSON.stringify({ output, words: cache.words.length, senses: cache.senses.length,
    records: Object.fromEntries(Object.entries(cache.enemies).map(([enemy, table]) => [enemy, Object.keys(table.records).length])) }))
}
