import assert from 'node:assert/strict'
import test from 'node:test'
import storedSnapshot from './fixtures/semantic-model-quality-v1.json' with { type: 'json' }
import confirmation from './fixtures/semantic-confirmation-v1.json' with { type: 'json' }
import development from './fixtures/semantic-development-extension-v1.json' with { type: 'json' }
import { evaluateSemanticBenchmark, semanticBenchmark } from '../scripts/evaluate-semantic-benchmark.ts'
import type { SemanticBenchmarkSnapshot } from '../scripts/evaluate-semantic-benchmark.ts'
import { collectSemanticQualitySnapshot } from '../scripts/lib/semanticQuality.ts'
import type { SemanticQualitySnapshot } from '../scripts/lib/semanticQuality.ts'

const snapshot = storedSnapshot as unknown as SemanticQualitySnapshot
const scoredSnapshot = snapshot as SemanticBenchmarkSnapshot
const actual = collectSemanticQualitySnapshot()

test('quality snapshot is the exact frozen hybrid output with actual memo and base-cache provenance', () => {
  assert.equal(snapshot.source, 'actual-frozen-hybrid-provider', 'Extract the final snapshot with review-contextual-semantics.ts.')
  assert.deepEqual(actual, snapshot, 'Model inputs, memo responses, source data or actual decisions changed; re-evaluate the complete fixed method.')
})

test('every eligible evaluation input has a complete valid frozen LLM review', () => {
  for (const [enemy, inventory] of Object.entries(actual.inventories)) {
    assert.ok(inventory.ready, `${enemy}: ${inventory.issues.join('; ')}`)
    assert.equal(inventory.reviewedWords, inventory.eligibleWords, enemy)
  }
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
