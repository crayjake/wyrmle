/** Validate complete model output against licensed source senses, then compact for authoring. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'
import { readSemanticAssessmentMetadata, readWordSemanticAssessment } from '../src/game/semanticAssessment.ts'
import type { AssessmentCache } from '../src/generator/semanticAssessments.ts'
import lock from './semantics/model-lock.json' with { type: 'json' }

const [sourcePath, rawDirectory, outputPath, requestedEnemies] = process.argv.slice(2)
if (!sourcePath || !rawDirectory || !outputPath) throw new Error('Usage: node scripts/package-semantic-cache.ts SOURCE.json RAW_DIRECTORY OUTPUT.json [CHAOS,ANGER,...]')
const { sourceDigest, ...source } = JSON.parse(readFileSync(sourcePath, 'utf8'))
assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'), sourceDigest, 'Source export changed after inference.')
assert.equal(source.dictionaryVersion, MEANING_DICTIONARY_VERSION)
const words = [...getDefinedDictionaryWords()]
assert.deepEqual(Object.keys(source.words), words)
const cache: AssessmentCache = { version: 'wyrmle-semantic-cache-1', dictionaryVersion: MEANING_DICTIONARY_VERSION,
  words, senses: [], anchors: [], methods: [], enemies: {} }
const senseIndices = new Map<string, number>()
const anchorIndices = new Map<string, number>()
const methodIndices = new Map<string, number>()
const models = Object.values(lock.models)
const sorted = (value: unknown): unknown => Array.isArray(value) ? value.map(sorted)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => [key, sorted(child)])) : value
const modelLockDigest = createHash('sha256').update(JSON.stringify(sorted(lock))).digest('hex')
let policyDigest: string | undefined
const enemies = requestedEnemies ? requestedEnemies.toUpperCase().split(',').sort() : Object.keys(source.profiles).sort()
for (const enemy of enemies) {
  assert.ok(source.profiles[enemy], `Unsupported enemy ${enemy}`)
  const bytes = readFileSync(`${rawDirectory}/${enemy.toLowerCase()}.json.gz`)
  const raw = JSON.parse(gunzipSync(bytes).toString('utf8'))
  assert.equal(raw.enemyWord, enemy)
  assert.equal(raw.metadata.sourceDigest, sourceDigest)
  assert.equal(raw.metadata.dictionaryVersion, MEANING_DICTIONARY_VERSION)
  assert.equal(raw.metadata.modelLockDigest, modelLockDigest, 'Model output does not match pinned model files.')
  assert.equal(raw.metadata.configuration.embeddingRevision, lock.models.embedding.revision)
  assert.equal(raw.metadata.configuration.nliRevision, lock.models.inference.revision)
  policyDigest ??= raw.metadata.configurationHash
  assert.equal(raw.metadata.configurationHash, policyDigest, 'Enemies must use the same assessment policy.')
  assert.equal(raw.metadata.wordsAssessed, words.length)
  assert.equal(raw.metadata.sensesAssessed, Object.keys(source.senses).length)
  assert.deepEqual(Object.keys(raw.words).sort(), words)
  const assessment = readSemanticAssessmentMetadata({ version: raw.metadata.version,
    modelId: models.map(model => model.repository).join(' + '),
    modelRevision: models.map(model => model.revision).join(' + '), sourceDigest,
    policyDigest: raw.metadata.configurationHash, cacheDigest: createHash('sha256').update(bytes).digest('hex'),
    method: 'embedding-nli', assessedWords: words.length, assessedSenses: raw.metadata.sensesAssessed })
  const rows: AssessmentCache['enemies'][string]['rows'] = []
  for (const word of words) {
    const entry = raw.words[word]
    const applicable: string[] = source.words[word]
    assert.ok(applicable.includes(entry.senseId), `${enemy}/${word}: selected sense must belong to word`)
    assert.equal(entry.sensesEvaluated, applicable.length, `${enemy}/${word}: all senses must be assessed`)
    const selectedSource = source.senses[entry.senseId]
    assert.ok(selectedSource?.definition.trim())
    const relation = ({ neutral: 0, unrelated: 0, opposite: 1, similar: 2, related: 3 } as Record<string, number>)[entry.relation]
    assert.notEqual(relation, undefined, `${enemy}/${word}: unsupported relation`)
    // Scores retain four decimals. Quantisation happens only once and is deterministic.
    const quantize = (value: number) => Math.round(value * 10000)
    const anchorSense = source.senses[entry.selectedAnchor]
    const anchor = anchorSense ? `${anchorSense.lemma}: ${anchorSense.definition}` : entry.selectedAnchor
    const scores = readWordSemanticAssessment({ counterScore: entry.counterScore, resistedScore: entry.resistedScore,
      margin: entry.margin, sensesEvaluated: entry.sensesEvaluated, selectedAnchor: anchor, decisionBasis: entry.method })
    let sense = -1
    if (entry.senseId !== getDictionaryMeaning(word)!.senseId) {
      if (!senseIndices.has(entry.senseId)) {
        senseIndices.set(entry.senseId, cache.senses.length)
        cache.senses.push([selectedSource.id, selectedSource.lemma, selectedSource.definition, selectedSource.partOfSpeech, selectedSource.source])
      }
      sense = senseIndices.get(entry.senseId)!
    }
    if (!anchorIndices.has(anchor)) { anchorIndices.set(anchor, cache.anchors.length); cache.anchors.push(anchor) }
    if (!methodIndices.has(entry.method)) { methodIndices.set(entry.method, cache.methods.length); cache.methods.push(entry.method) }
    rows.push([sense, relation, quantize(scores.counterScore), quantize(scores.resistedScore), quantize(scores.margin),
      scores.sensesEvaluated, anchorIndices.get(anchor)!, methodIndices.get(entry.method)!])
  }
  cache.enemies[enemy] = { definition: source.profiles[enemy].definition, assessment, rows }
}
writeFileSync(outputPath, JSON.stringify(cache) + '\n')
console.log(JSON.stringify({ outputPath, words: words.length, enemies: Object.keys(cache.enemies),
  alternateSenses: cache.senses.length, anchors: cache.anchors.length }))
