/** Optional authoring-only LLM decisions; incomplete inventories remain drafts. */
import data from './data/semantic-refinements-v1.json?raw' with { type: 'json' }
import { getDefinedDictionaryWords, MEANING_DICTIONARY_VERSION } from '../lexicon/meaningDictionary.ts'
import { readSemanticRefinementMetadata, readWordSemanticAssessment } from '../game/semanticAssessment.ts'
import type { SemanticAssessmentMetadata, SemanticRefinementMetadata } from '../game/semanticAssessment.ts'
import type { PuzzleWordMeaning } from '../game/meaningLexicon.ts'
import type { PartOfSpeech } from '../game/types.ts'
import { PARTS_OF_SPEECH } from '../game/types.ts'
import { semanticAssessmentProvider } from './semanticAssessments.ts'
import { sha256 } from './sha256.ts'
import { applySemanticSourceReview, semanticSourceReviewPolicy } from './semanticSourceReview.ts'
import type { SourceReviewPolicy } from './semanticSourceReview.ts'

export type RefinementSense = { id: string; lemma: string; definition: string; partOfSpeech: PartOfSpeech; source: 'oewn-2025' | 'wiktionary-en' }
export type RefinementManifest = {
  version: string; modelId: string; modelRevision: string; modelDigest: string; promptDigest: string
  policyDigest: string; sourceDigest: string; baseCacheDigest: string; retrievalDigest: string
  threshold: number; trustedDecisionBases: string[]; reviewScope?: 'all-source-senses'
  sourceSelection?: 'baseline-agreement-then-directness-v1'
  /** Attestation of the memo records checked by the offline packager. */
  recordsDigest?: string
}
export type RefinementMemo = {
  inputDigest: string; policyDigest: string; sourceDigest: string; baseWordDigest: string
  modelId: string; modelRevision: string; modelDigest: string; promptDigest: string
  /** Direct response, or a source-indexed envelope retaining every individual response. */
  rawResponse: string
} & ({ status: 'ok'; relation: 'opposite' | 'similar' | 'neutral'; senseId: string; explanation: string }
  | { status: 'error'; error: string })
export type RefinementRetrieval = [combined: number, definition: number, lemma: number, qualifiedSenseIndices: number[]]
export type RefinementCache = {
  version: 'wyrmle-semantic-refinement-cache-1'; dictionaryVersion: string; words: string[]; senses: RefinementSense[]
  enemies: Record<string, { manifest: RefinementManifest; retrieval: RefinementRetrieval[]; records: Record<string, RefinementMemo> }>
}
type BaseProvider = { metadata(enemy: string): SemanticAssessmentMetadata; definition(enemy: string): string }
export type RefinementResult = { words: Readonly<Record<string, PuzzleWordMeaning>>; metadata?: SemanticRefinementMetadata
  ready: boolean; eligibleWords: number; reviewedWords: number; issues: readonly string[] }

const trustedBases = ['lexical-expansion', 'reviewed-profile', 'source-direction-proof']
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => [key, canonical(child)])) : value
export const semanticRefinementDigest = (value: unknown): string => sha256(JSON.stringify(canonical(value)))
export const semanticBaseWordDigest = (meaning: PuzzleWordMeaning): string => semanticRefinementDigest(meaning)
export const semanticRetrievalDigest = (words: readonly string[], senses: readonly RefinementSense[], retrieval: readonly RefinementRetrieval[]): string =>
  semanticRefinementDigest({ words, senses, retrieval })

/** Shared admitted sense sets permit reuse across inflections, independently of gold labels. */
export function semanticRefinementInput(manifest: RefinementManifest, enemyWord: string, enemyDefinition: string, senses: readonly RefinementSense[], preferredSenseId?: string) {
  return { enemyWord, enemyDefinition, qualifiedSenses: [...senses].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(({ id, lemma, definition, partOfSpeech }) => ({ id, lemma, definition, partOfSpeech })),
  promptDigest: manifest.promptDigest, policyDigest: manifest.policyDigest, sourceDigest: manifest.sourceDigest,
  ...(manifest.sourceSelection ? { preferredSenseId } : {}) }
}

function validateManifest(manifest: RefinementManifest): void {
  const strings = ['version', 'modelId', 'modelRevision', 'modelDigest', 'promptDigest', 'policyDigest',
    'sourceDigest', 'baseCacheDigest', 'retrievalDigest'] as const
  const keys = new Set<string>([...strings, 'threshold', 'trustedDecisionBases', 'reviewScope', 'sourceSelection', 'recordsDigest'])
  const exhaustive = manifest?.reviewScope === 'all-source-senses'
  if (!manifest || Object.keys(manifest).some(key => !keys.has(key)) || strings.some(key => !nonempty(manifest[key]))
    || (manifest.reviewScope !== undefined && !exhaustive)
    || (manifest.sourceSelection !== undefined && (!exhaustive || manifest.sourceSelection !== 'baseline-agreement-then-directness-v1'))
    || (manifest.recordsDigest !== undefined && !/^[a-f0-9]{64}$/.test(manifest.recordsDigest))
    || !Number.isFinite(manifest.threshold) || (exhaustive ? manifest.threshold !== -1 : manifest.threshold <= 0 || manifest.threshold > 1)
    || !Array.isArray(manifest.trustedDecisionBases)
    || JSON.stringify([...manifest.trustedDecisionBases].sort()) !== JSON.stringify(exhaustive ? [] : trustedBases)) {
    throw new Error('Unsupported or incomplete semantic refinement manifest.')
  }
}

export function createSemanticRefinementProvider(input: RefinementCache, base: BaseProvider = semanticAssessmentProvider,
  vocabulary: readonly string[] = getDefinedDictionaryWords(), sourceReviewPolicy: SourceReviewPolicy = semanticSourceReviewPolicy) {
  if (input.version !== 'wyrmle-semantic-refinement-cache-1' || input.dictionaryVersion !== MEANING_DICTIONARY_VERSION
    || input.words.length !== vocabulary.length || input.words.some((word, index) => word !== vocabulary[index])) {
    throw new Error('Semantic refinement retrieval must cover the current dictionary exactly.')
  }
  const indices = new Map(input.words.map((word, index) => [word, index]))
  const senseIds = new Set<string>()
  for (const sense of input.senses) {
    if (!sense || !nonempty(sense.id) || !nonempty(sense.lemma) || !nonempty(sense.definition)
      || !PARTS_OF_SPEECH.includes(sense.partOfSpeech) || !['oewn-2025', 'wiktionary-en'].includes(sense.source) || senseIds.has(sense.id)) {
      throw new Error('Invalid or duplicated refinement source sense.')
    }
    senseIds.add(sense.id)
  }
  for (const table of Object.values(input.enemies)) {
    validateManifest(table.manifest)
    if (table.manifest.recordsDigest && semanticRefinementDigest(table.records) !== table.manifest.recordsDigest) {
      throw new Error('Semantic memo records changed after offline verification.')
    }
    if (table.retrieval.length !== vocabulary.length) throw new Error('Incomplete semantic retrieval coverage.')
    for (const row of table.retrieval) {
      if (!Array.isArray(row) || row.length !== 4 || row.slice(0, 3).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1)
        || !Array.isArray(row[3]) || new Set(row[3]).size !== row[3].length
        || row[3].some(index => !Number.isSafeInteger(index) || !input.senses[index])) throw new Error('Invalid semantic retrieval row.')
      if (row[3].length && !row.slice(0, 3).some(value => typeof value === 'number' && value >= table.manifest.threshold)) {
        throw new Error('Qualified source senses require retrieval evidence at the frozen threshold.')
      }
      if (table.manifest.reviewScope === 'all-source-senses' && !row[3].length) {
        throw new Error('Exhaustive contextual review requires source senses for every dictionary word.')
      }
    }
    if (semanticRetrievalDigest(input.words, input.senses, table.retrieval) !== table.manifest.retrievalDigest) {
      throw new Error('Semantic retrieval artifact digest changed.')
    }
    for (const word of Object.keys(table.records)) if (!indices.has(word)) throw new Error(`Unknown refinement memo spelling ${word}.`)
  }
  const baseDigests = new WeakMap<PuzzleWordMeaning, string>()
  const baseDigest = (meaning: PuzzleWordMeaning) => {
    if (!Object.isFrozen(meaning) || !Object.isFrozen(meaning.assessment) || !Object.isFrozen(meaning.partsOfSpeech)) {
      return semanticBaseWordDigest(meaning)
    }
    let digest = baseDigests.get(meaning)
    if (!digest) { digest = semanticBaseWordDigest(meaning); baseDigests.set(meaning, digest) }
    return digest
  }
  return Object.freeze({
    refine(enemy: string, inventory: Readonly<Record<string, PuzzleWordMeaning>>): RefinementResult {
      const table = input.enemies[enemy]
      const failed = (issue: string): RefinementResult => ({ words: inventory, ready: false, eligibleWords: 0, reviewedWords: 0, issues: [issue] })
      if (!table) return failed(`No frozen LLM refinement manifest for ${enemy}.`)
      const manifest = table.manifest
      const header = base.metadata(enemy)
      if (manifest.baseCacheDigest !== header.cacheDigest || manifest.sourceDigest !== header.sourceDigest) {
        return failed(`LLM refinement source or baseline cache is stale for ${enemy}.`)
      }
      const words = { ...inventory }
      const eligible: string[] = [], reviewed: [string, unknown][] = [], issues: string[] = []
      const sourceEdits = new Map<string, SourceReviewPolicy['reviews'][number]>()
      let sourceReviewedWords = 0
      for (const word of Object.keys(inventory).sort()) {
        const meaning = inventory[word]
        const index = indices.get(word)
        if (index === undefined) throw new Error(`No semantic retrieval for inventory word ${word}.`)
        const row = table.retrieval[index]
        const basis = meaning.assessment?.decisionBasis
        if (basis && manifest.trustedDecisionBases.includes(basis)) continue
        if (![...trustedBases, 'local-vector-nli', 'local-vector-nli-neutral'].includes(basis ?? '')) {
          issues.push(`${word}: unsupported baseline decision basis`); continue
        }
        if (manifest.reviewScope !== 'all-source-senses' && basis === 'local-vector-nli-neutral' && row[3].length === 0) continue
        eligible.push(word)
        const senses = row[3].map(sense => input.senses[sense])
        const inputDigest = semanticRefinementDigest(semanticRefinementInput(manifest, enemy, base.definition(enemy), senses, meaning.senseId))
        const memo = table.records[word]
        if (!memo) { issues.push(`${word}: missing LLM review`); continue }
        if (memo.inputDigest !== inputDigest || memo.baseWordDigest !== baseDigest(meaning)
          || memo.policyDigest !== manifest.policyDigest || memo.sourceDigest !== manifest.sourceDigest
          || memo.modelId !== manifest.modelId || memo.modelRevision !== manifest.modelRevision
          || memo.modelDigest !== manifest.modelDigest || memo.promptDigest !== manifest.promptDigest) {
          issues.push(`${word}: stale LLM input, model or policy`); continue
        }
        if (memo.status !== 'ok') { issues.push(`${word}: failed LLM review`); continue }
        if (!['neutral', 'opposite', 'similar'].includes(memo.relation) || !nonempty(memo.explanation) || !nonempty(memo.rawResponse)) {
          issues.push(`${word}: invalid LLM decision`); continue
        }
        let sense = senses.find(sense => sense.id === memo.senseId)
        if (memo.relation === 'neutral' && manifest.reviewScope !== 'all-source-senses' ? memo.senseId !== meaning.senseId : !sense) {
          issues.push(`${word}: LLM decision does not select an admitted qualified sense`); continue
        }
        const audited = applySemanticSourceReview(sourceReviewPolicy, manifest, enemy, senses, memo, meaning.senseId)
        if (audited) {
          sense = audited.sense
          sourceReviewedWords++
          for (const edit of audited.reviews) sourceEdits.set(edit.senseId, edit)
        }
        const relation = audited?.relation ?? memo.relation
        words[word] = Object.freeze({ ...meaning,
          ...((relation !== 'neutral' || manifest.reviewScope === 'all-source-senses') && sense ? { definition: sense.definition, lemma: sense.lemma, senseId: sense.id,
            source: sense.source, partsOfSpeech: Object.freeze([...new Set([...meaning.partsOfSpeech, sense.partOfSpeech])]) } : {}),
          relation: relation === 'neutral' ? 'unrelated' : relation, reason: audited?.explanation ?? memo.explanation,
          // Every entry retains its real model assessment. The final decision's
          // editorial provenance is explicit in decisionBasis and the header.
          evidence: 'model-assessed',
          assessment: readWordSemanticAssessment({ ...meaning.assessment!, decisionBasis: audited ? 'source-reviewed' : 'local-llm' }),
        })
        reviewed.push([word, memo])
      }
      const sourceReviewDigest = sourceReviewedWords ? semanticRefinementDigest({ ...sourceReviewPolicy,
        reviews: [...sourceEdits.values()].sort((a, b) => a.senseId < b.senseId ? -1 : a.senseId > b.senseId ? 1 : 0) }) : undefined
      const metadata = readSemanticRefinementMetadata({ version: manifest.version, modelId: manifest.modelId,
        modelRevision: manifest.modelRevision, modelDigest: manifest.modelDigest, promptDigest: manifest.promptDigest,
        eligibilityPolicyDigest: manifest.policyDigest, baseCacheDigest: manifest.baseCacheDigest,
        inventoryDigest: semanticRefinementDigest(Object.keys(inventory).sort()),
        cacheDigest: semanticRefinementDigest({ eligible, reviewed, ...(sourceReviewDigest ? { sourceReviewDigest } : {}) }), eligibleWords: eligible.length, reviewedWords: reviewed.length,
        ...(sourceReviewDigest ? { sourceReviewDigest, sourceReviewedWords } : {}),
        ...(manifest.reviewScope ? { reviewScope: manifest.reviewScope } : {}) })
      return { words: Object.freeze(words), metadata, ready: issues.length === 0 && eligible.length === reviewed.length,
        eligibleWords: eligible.length, reviewedWords: reviewed.length, issues: Object.freeze(issues) }
    },
  })
}

// Authoring overlay only: unreviewed inventories remain drafts and cannot publish.
// Vite supplies raw text; Node's JSON loader supplies the parsed object. Avoid
// TypeScript inferring millions of literal types from this authoring artifact.
const cache = (typeof data === 'string' ? JSON.parse(data) : data) as Omit<RefinementCache, 'words'> & { words?: string[] }
let activeProvider: ReturnType<typeof createSemanticRefinementProvider> | undefined
const refinedRelations = new Map<string, ReturnType<typeof semanticAssessmentProvider.relations>>()
export const semanticRefinementProvider = Object.freeze({
  refine(enemy: string, inventory: Readonly<Record<string, PuzzleWordMeaning>>): RefinementResult {
    activeProvider ??= createSemanticRefinementProvider({ ...cache,
      words: cache.words ?? [...getDefinedDictionaryWords()] } as RefinementCache)
    return activeProvider.refine(enemy, inventory)
  },
  /** Construction must use the same reviewed labels as final compilation.
   * Unreviewed inputs remain base-assessed drafts; publication still fails closed.
   */
  relations(enemy: string) {
    const existing = refinedRelations.get(enemy)
    if (existing) return existing
    const baseline = semanticAssessmentProvider.relations(enemy)
    const inventory = Object.fromEntries(Object.keys(cache.enemies[enemy]?.records ?? {})
      .map(word => [word, semanticAssessmentProvider.word(enemy, word)]))
    const reviewed = semanticRefinementProvider.refine(enemy, inventory).words
    const lists = Object.fromEntries(Object.entries(baseline).map(([relation, words]) => [relation, new Set(words)]))
    for (const [word, meaning] of Object.entries(reviewed)) {
      for (const words of Object.values(lists)) words.delete(word)
      lists[meaning.relation].add(word)
    }
    const result = Object.freeze(Object.fromEntries(Object.entries(lists)
      .map(([relation, words]) => [relation, Object.freeze([...words].sort())]))) as typeof baseline
    refinedRelations.set(enemy, result)
    return result
  },
})
