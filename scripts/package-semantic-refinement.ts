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

export function packageSemanticRefinement(sourcePath: string, retrievalDirectory: string, manifestPath: string, memoDirectory: string): RefinementCache {
  const { sourceDigest, ...source } = JSON.parse(readFileSync(sourcePath, 'utf8'))
  assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'), sourceDigest, 'Source export changed.')
  assert.equal(source.dictionaryVersion, MEANING_DICTIONARY_VERSION)
  const spec = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(semanticRefinementDigest(spec.prompt), spec.manifest.promptDigest, 'Prompt digest mismatch.')
  assert.equal(semanticRefinementDigest(spec.policy), spec.manifest.policyDigest, 'Policy digest mismatch.')
  assert.equal(spec.manifest.sourceDigest, sourceDigest)
  assert.equal(spec.manifest.threshold, 0.5)
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
    assert.equal(raw.metadata.threshold, 0.5)
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
        assert.ok(!excluded.has(id), `${enemy}/${word}: excluded source sense ${id}`)
        assert.ok(source.senses[id]?.definition.trim())
        sourceIds.add(id)
      }
      assert.ok(!row.qualifiedSenseIds.length || Math.max(...row.maxima) >= 0.5)
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
    const manifest: RefinementManifest = { ...spec.manifest,
      baseCacheDigest: semanticAssessmentProvider.metadata(enemy).cacheDigest,
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
