/** Collect actual hybrid decisions without reading any expected benchmark labels. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import development from '../../tests/fixtures/semantic-development-extension-v1.json' with { type: 'json' }
import confirmation from '../../tests/fixtures/semantic-confirmation-v1.json' with { type: 'json' }
import diagnostic from '../../tests/fixtures/semantic-fresh-diagnostic-v1.json' with { type: 'json' }
import inventoryRegressions from '../../tests/fixtures/semantic-inventory-regressions-v1.json' with { type: 'json' }
import refinementData from '../../src/generator/data/semantic-refinements-v1.json' with { type: 'json' }
import { evaluateSemanticBenchmark, semanticBenchmark } from '../evaluate-semantic-benchmark.ts'
import type { SemanticBenchmarkPrediction, SemanticBenchmarkSnapshot } from '../evaluate-semantic-benchmark.ts'
import { semanticAssessmentProvider } from '../../src/generator/semanticAssessments.ts'
import { createSemanticRefinementProvider, semanticBaseWordDigest, semanticRefinementDigest, semanticRefinementProvider } from '../../src/generator/semanticRefinement.ts'
import type { RefinementCache, RefinementManifest } from '../../src/generator/semanticRefinement.ts'
import type { SemanticAssessmentMetadata, SemanticRefinementMetadata } from '../../src/game/semanticAssessment.ts'
import { semanticSourceReviewPolicy } from '../../src/generator/semanticSourceReview.ts'

type ProvenPrediction = SemanticBenchmarkPrediction & {
  baseWordDigest: string; decisionBasis: string; memoDigest: string | null
}
export type SemanticQualitySnapshot = SemanticBenchmarkSnapshot & {
  source: 'actual-frozen-hybrid-provider'
  refinementFileDigest: string
  confirmationDigest: string
  sourceReviewPolicyDigest: string
  baseCaches: Record<string, SemanticAssessmentMetadata>
  manifests: Record<string, RefinementManifest>
  inventories: Record<string, { ready: boolean; eligibleWords: number; reviewedWords: number
    issues: readonly string[]; metadata?: SemanticRefinementMetadata }>
  records: ProvenPrediction[]
}
const sha = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex')
export const semanticPublicationGates = Object.freeze({
  minimumCoverage: 1, minimumCoreAccuracy: 1, minimumAccuracy: 1, minimumHoldoutAccuracy: 1,
  minimumPerEnemyAccuracy: 1, minimumConstrainedSenseAccuracy: 1, minimumNovelConceptRecall: 1,
  maximumNeutralFalsePositiveRate: 0,
})

/** Evaluate real provider output; a saved passing report cannot bless changed inputs. */
export function evaluateSemanticQuality(snapshot: SemanticQualitySnapshot) {
  const primary = evaluateSemanticBenchmark(snapshot, 'all', { ...semanticBenchmark, gates: semanticPublicationGates })
  const developmentReport = evaluateSemanticBenchmark(snapshot, 'all', {
    ...semanticBenchmark, version: development.version, cases: development.cases, reviewCases: [],
    gates: semanticPublicationGates,
  }, Object.fromEntries(development.cases.map(entry => [entry.id, entry.legacyRelation])))
  const confirmationReport = evaluateSemanticBenchmark(snapshot, 'all', {
    ...semanticBenchmark, version: confirmation.version, cases: confirmation.cases, reviewCases: [],
    gates: semanticPublicationGates,
  }, Object.fromEntries(confirmation.cases.map(entry => [entry.id, entry.legacyRelation])))
  const diagnosticReport = evaluateSemanticBenchmark(snapshot, 'all', {
    ...semanticBenchmark, version: diagnostic.version, cases: diagnostic.cases, reviewCases: [], gates: semanticPublicationGates,
  }, Object.fromEntries(diagnostic.cases.map(entry => [entry.id, entry.legacyRelation])))
  const inventoryReport = evaluateSemanticBenchmark(snapshot, 'all', {
    ...semanticBenchmark, version: inventoryRegressions.version, cases: inventoryRegressions.cases, reviewCases: [], gates: semanticPublicationGates,
  }, {})
  const ready = Object.keys(semanticBenchmark.enemyDefinitions).every(enemy => {
    const inventory = snapshot.inventories[enemy], manifest = snapshot.manifests[enemy]
    return inventory?.ready && manifest?.reviewScope === 'all-source-senses' && manifest.trustedDecisionBases.length === 0
      && inventory.eligibleWords === snapshot.records.filter(record => record.enemy === enemy).length
      && inventory.reviewedWords === inventory.eligibleWords
  })
  return { ready, primary, development: developmentReport, confirmation: confirmationReport, diagnostic: diagnosticReport, inventory: inventoryReport,
    passed: ready && primary.passed && developmentReport.passed && confirmationReport.passed && diagnosticReport.passed && inventoryReport.passed }
}

export function assertSemanticQualityForPublication(): SemanticQualitySnapshot {
  const snapshot = collectSemanticQualitySnapshot()
  const quality = evaluateSemanticQuality(snapshot)
  if (!quality.passed) {
    const failures = [
      ...Object.entries(snapshot.inventories).filter(([enemy, inventory]) => !inventory.ready
        || snapshot.manifests[enemy]?.reviewScope !== 'all-source-senses')
        .map(([enemy]) => `${enemy}: incomplete contextual review`),
      ...(['primary', 'development', 'confirmation', 'diagnostic', 'inventory'] as const)
        .flatMap(name => quality[name].failures.map(failure => `${name}: ${failure}`)),
    ]
    throw new Error(`Semantic publication quality gates failed:\n${failures.join('\n')}`)
  }
  return snapshot
}

export function collectSemanticQualitySnapshot(inputs?: readonly { enemy: string; word: string }[], refinementPath?: string): SemanticQualitySnapshot {
  // Only spelling/enemy identities enter the assessor. Gold labels and source
  // constraints are consumed separately by the evaluator after collection.
  const identities = inputs ?? [...semanticBenchmark.cases, ...semanticBenchmark.reviewCases, ...development.cases, ...confirmation.cases, ...diagnostic.cases, ...inventoryRegressions.cases]
    .map(({ enemy, word }) => ({ enemy, word }))
  // A candidate package can be assessed before replacing the published cache.
  // Both paths use the same production provider and all of its digest checks.
  const refinementBytes = readFileSync(refinementPath ?? new URL('../../src/generator/data/semantic-refinements-v1.json', import.meta.url))
  const cache = (refinementPath ? JSON.parse(refinementBytes.toString('utf8')) : refinementData) as unknown as RefinementCache
  const provider = refinementPath ? createSemanticRefinementProvider(cache) : semanticRefinementProvider
  const baseCaches: SemanticQualitySnapshot['baseCaches'] = {}
  const manifests: SemanticQualitySnapshot['manifests'] = {}
  const inventories: SemanticQualitySnapshot['inventories'] = {}
  const records: ProvenPrediction[] = []
  for (const enemy of Object.keys(semanticBenchmark.enemyDefinitions)) {
    baseCaches[enemy] = semanticAssessmentProvider.metadata(enemy)
    if (cache.enemies[enemy]) manifests[enemy] = cache.enemies[enemy].manifest
    const words = [...new Set(identities.filter(entry => entry.enemy === enemy).map(entry => entry.word))].sort()
    const baseline = Object.fromEntries(words.map(word => [word, semanticAssessmentProvider.word(enemy, word)]))
    const reviewed = provider.refine(enemy, baseline)
    inventories[enemy] = { ready: reviewed.ready, eligibleWords: reviewed.eligibleWords,
      reviewedWords: reviewed.reviewedWords, issues: reviewed.issues,
      ...(reviewed.metadata ? { metadata: reviewed.metadata } : {}) }
    for (const word of words) {
      const actual = reviewed.words[word]
      const memo = cache.enemies[enemy]?.records[word]
      records.push({ enemy, word, relation: actual.relation, senseId: actual.senseId,
        baseWordDigest: semanticBaseWordDigest(baseline[word]), decisionBasis: actual.assessment!.decisionBasis,
        memoDigest: memo ? semanticRefinementDigest(memo) : null })
    }
  }
  return {
    source: 'actual-frozen-hybrid-provider',
    modelId: [...new Set([...Object.values(baseCaches).map(base => base.modelId),
      ...Object.values(manifests).map(manifest => manifest.modelId)])].join(' + '),
    configurationHash: semanticRefinementDigest({ baseCaches, manifests, sourceReviewPolicyDigest: semanticRefinementDigest(semanticSourceReviewPolicy) }),
    sourceReviewPolicyDigest: semanticRefinementDigest(semanticSourceReviewPolicy),
    refinementFileDigest: sha(refinementBytes),
    confirmationDigest: sha(readFileSync(new URL('../../tests/fixtures/semantic-confirmation-v1.json', import.meta.url))),
    baseCaches, manifests, inventories, records,
  }
}
