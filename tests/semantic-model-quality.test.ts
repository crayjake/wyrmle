import assert from 'node:assert/strict'
import test from 'node:test'
import storedSnapshot from './fixtures/semantic-model-quality-v1.json' with { type: 'json' }
import confirmation from './fixtures/semantic-confirmation-v1.json' with { type: 'json' }
import development from './fixtures/semantic-development-extension-v1.json' with { type: 'json' }
import diagnostic from './fixtures/semantic-fresh-diagnostic-v1.json' with { type: 'json' }
import inventoryRegressions from './fixtures/semantic-inventory-regressions-v1.json' with { type: 'json' }
import { evaluateSemanticBenchmark, semanticBenchmark } from '../scripts/evaluate-semantic-benchmark.ts'
import type { SemanticBenchmarkSnapshot } from '../scripts/evaluate-semantic-benchmark.ts'
import { collectSemanticQualitySnapshot, evaluateSemanticQuality } from '../scripts/lib/semanticQuality.ts'
import type { SemanticQualitySnapshot } from '../scripts/lib/semanticQuality.ts'

const snapshot = storedSnapshot as unknown as SemanticQualitySnapshot
const scoredSnapshot = snapshot as SemanticBenchmarkSnapshot
const actual = collectSemanticQualitySnapshot()

test('even one known semantic miss blocks publication while historical tolerances stay reproducible', () => {
  // Synthetic evaluator input, never an assessment memo or production snapshot.
  const perfect = structuredClone(actual)
  const expected = new Map([...semanticBenchmark.cases, ...development.cases, ...confirmation.cases, ...diagnostic.cases, ...inventoryRegressions.cases]
    .map(entry => [entry.id, entry]))
  for (const record of perfect.records) {
    const entry = expected.get(`${record.enemy}/${record.word}`)
    if (!entry) continue
    record.relation = entry.expected as typeof record.relation
    if ('allowedSenses' in entry && entry.allowedSenses?.length) record.senseId = entry.allowedSenses[0].senseId
  }
  for (const [enemy, inventory] of Object.entries(perfect.inventories)) {
    inventory.ready = true
    inventory.eligibleWords = inventory.reviewedWords = perfect.records.filter(record => record.enemy === enemy).length
    perfect.manifests[enemy] = { version: 'test', modelId: 'test', modelRevision: 'test', modelDigest: 'test',
      promptDigest: 'test', policyDigest: 'test', sourceDigest: 'test', baseCacheDigest: 'test', retrievalDigest: 'test',
      threshold: -1, reviewScope: 'all-source-senses', trustedDecisionBases: [] }
  }
  assert.equal(evaluateSemanticQuality(perfect).passed, true)
  const entry = semanticBenchmark.cases.find(entry => !entry.core && entry.expected !== 'neutral')!
  perfect.records.find(record => `${record.enemy}/${record.word}` === entry.id)!.relation = 'neutral'
  assert.equal(evaluateSemanticBenchmark(perfect).passed, true, 'The old evaluator retains its original tolerances.')
  assert.equal(evaluateSemanticQuality(perfect).passed, false, 'A single miss must fail the new publication standard.')
})

test('publication quality fails closed for incomplete reviews and incorrect live predictions', () => {
  const incomplete = structuredClone(actual)
  incomplete.inventories.CHAOS.ready = false
  assert.equal(evaluateSemanticQuality(incomplete).passed, false)
  const incorrect = structuredClone(actual)
  for (const record of incorrect.records) record.relation = 'unrelated'
  const report = evaluateSemanticQuality(incorrect)
  assert.equal(report.passed, false)
  assert.ok(report.primary.failures.length > 0)
  assert.ok(report.confirmation.failures.length > 0)
})

test('quality snapshot is the exact frozen hybrid output with actual memo and base-cache provenance', () => {
  assert.equal(snapshot.source, 'actual-frozen-hybrid-provider', 'Extract the final snapshot with review-contextual-semantics.ts.')
  assert.deepEqual(actual, snapshot, 'Model inputs, memo responses, source data or actual decisions changed; re-evaluate the complete fixed method.')
})

test('every eligible evaluation input has a complete valid frozen LLM review', () => {
  for (const [enemy, inventory] of Object.entries(actual.inventories)) {
    assert.ok(inventory.ready, `${enemy}: ${inventory.issues.join('; ')}`)
    assert.equal(inventory.reviewedWords, inventory.eligibleWords, enemy)
    assert.equal(inventory.metadata?.reviewScope, 'all-source-senses')
    assert.equal(inventory.reviewedWords, actual.records.filter(record => record.enemy === enemy).length)
  }
})

test('publication has zero known label or source-sense errors across all regression sets', () => {
  const quality = evaluateSemanticQuality(actual)
  for (const name of ['primary', 'development', 'confirmation', 'diagnostic', 'inventory'] as const) {
    assert.ok(quality[name].passed, `${name}: ${quality[name].failures.join('; ')}`)
  }
  assert.ok(quality.passed)
})

test('frozen hybrid assessments pass the independent primary quality gates', () => {
  const report = evaluateSemanticBenchmark(scoredSnapshot)
  assert.ok(report.passed, report.failures.join('\n'))
})

test('frozen hybrid assessments retain all development meanings and source constraints', () => {
  const report = evaluateSemanticBenchmark(scoredSnapshot, 'all', {
    ...semanticBenchmark, version: development.version, cases: development.cases, reviewCases: [],
    gates: { ...semanticBenchmark.gates, minimumAccuracy: 1, minimumPerEnemyAccuracy: 1 },
  }, Object.fromEntries(development.cases.map(entry => [entry.id, entry.legacyRelation])))
  assert.ok(report.passed, report.failures.join('\n'))
})

test('frozen hybrid assessments pass the separate confirmation quality gates', () => {
  const report = evaluateSemanticBenchmark(scoredSnapshot, 'all', {
    ...semanticBenchmark, version: confirmation.version, cases: confirmation.cases, reviewCases: [],
    gates: { ...semanticBenchmark.gates, ...confirmation.gates },
  }, Object.fromEntries(confirmation.cases.map(entry => [entry.id, entry.legacyRelation])))
  assert.ok(report.passed, report.failures.join('\n'))
})
