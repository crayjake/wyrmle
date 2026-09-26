/** Evidence produced offline; runtime validates and reads it without inference. */
export type SemanticRefinementMetadata = Readonly<{
  version: string
  modelId: string
  modelRevision: string
  modelDigest: string
  promptDigest: string
  eligibilityPolicyDigest: string
  baseCacheDigest: string
  inventoryDigest: string
  cacheDigest: string
  eligibleWords: number
  reviewedWords: number
  reviewScope?: 'all-source-senses'
  sourceReviewDigest?: string
  sourceReviewedWords?: number
}>

export type SemanticAssessmentMetadata = Readonly<{
  version: string
  modelId: string
  modelRevision: string
  sourceDigest: string
  policyDigest: string
  cacheDigest: string
  method: 'embedding-nli' | 'embedding' | 'local-llm'
  assessedWords: number
  assessedSenses: number
  refinement?: SemanticRefinementMetadata
}>

export type WordSemanticAssessment = Readonly<{
  counterScore: number
  resistedScore: number
  margin: number
  sensesEvaluated: number
  selectedAnchor: string
  decisionBasis?: string
}>

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const between = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
const fail = (detail: string): never => { throw new Error(`Invalid semantic assessment: ${detail}.`) }

const metadataKeys = new Set([
  'version', 'modelId', 'modelRevision', 'sourceDigest', 'policyDigest', 'cacheDigest',
  'method', 'assessedWords', 'assessedSenses',
  'refinement',
])
const scoreKeys = new Set(['counterScore', 'resistedScore', 'margin', 'sensesEvaluated', 'selectedAnchor', 'decisionBasis'])
const refinementKeys = new Set(['version', 'modelId', 'modelRevision', 'modelDigest', 'promptDigest',
  'eligibilityPolicyDigest', 'baseCacheDigest', 'inventoryDigest', 'cacheDigest', 'eligibleWords', 'reviewedWords', 'reviewScope',
  'sourceReviewDigest', 'sourceReviewedWords'])

export function readSemanticRefinementMetadata(value: unknown): SemanticRefinementMetadata {
  if (!object(value) || Object.keys(value).some(key => !refinementKeys.has(key))) return fail('unsupported refinement metadata')
  for (const key of refinementKeys) {
    if (['eligibleWords', 'reviewedWords', 'reviewScope', 'sourceReviewDigest', 'sourceReviewedWords'].includes(key)) continue
    if (!nonempty(value[key])) fail(`missing refinement ${key}`)
  }
  if (Object.hasOwn(value, 'reviewScope') && value.reviewScope !== 'all-source-senses') return fail('unsupported contextual review scope')
  if (!Number.isSafeInteger(value.eligibleWords) || !Number.isSafeInteger(value.reviewedWords)
    || (value.eligibleWords as number) < 0 || (value.reviewedWords as number) < 0
    || (value.reviewedWords as number) > (value.eligibleWords as number)) return fail('invalid refinement coverage')
  if (Object.hasOwn(value, 'sourceReviewDigest') || Object.hasOwn(value, 'sourceReviewedWords')) {
    if (typeof value.sourceReviewDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceReviewDigest)
      || !positiveInteger(value.sourceReviewedWords) || value.sourceReviewedWords > (value.reviewedWords as number)) return fail('invalid source review coverage')
  }
  return Object.freeze({ ...value }) as SemanticRefinementMetadata
}

/** Copy and freeze, preserving field order used by publication fingerprints. */
export function readSemanticAssessmentMetadata(value: unknown): SemanticAssessmentMetadata {
  if (!object(value) || Object.keys(value).some(key => !metadataKeys.has(key))) return fail('unsupported metadata')
  for (const key of ['version', 'modelId', 'modelRevision', 'sourceDigest', 'policyDigest', 'cacheDigest']) {
    if (!nonempty(value[key])) fail(`missing ${key}`)
  }
  if (!['embedding-nli', 'embedding', 'local-llm'].includes(value.method as string)
    || !positiveInteger(value.assessedWords) || !positiveInteger(value.assessedSenses)) {
    return fail('unsupported method or coverage counts')
  }
  const copy = { ...value }
  if (Object.hasOwn(value, 'refinement')) copy.refinement = readSemanticRefinementMetadata(value.refinement)
  return Object.freeze(copy) as SemanticAssessmentMetadata
}

/** Scores are stored model output, never probabilities recomputed in play. */
export function readWordSemanticAssessment(value: unknown): WordSemanticAssessment {
  if (!object(value) || Object.keys(value).some(key => !scoreKeys.has(key))
    || !between(value.counterScore, 0, 1) || !between(value.resistedScore, 0, 1)
    || !between(value.margin, -1, 1) || !positiveInteger(value.sensesEvaluated)
    || !nonempty(value.selectedAnchor)
    || (Object.hasOwn(value, 'decisionBasis') && !nonempty(value.decisionBasis))) return fail('missing or invalid word scores')
  return Object.freeze({ ...value }) as WordSemanticAssessment
}
