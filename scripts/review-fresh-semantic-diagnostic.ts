/** One-shot diagnostic of the frozen algorithm; it does not redefine release gates. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import fixture from '../tests/fixtures/semantic-fresh-diagnostic-v1.json' with { type: 'json' }
import { collectSemanticQualitySnapshot } from './lib/semanticQuality.ts'
import { evaluateSemanticBenchmark, semanticBenchmark } from './evaluate-semantic-benchmark.ts'

const [cachePath, outputDirectory] = process.argv.slice(2)
if (!cachePath || !outputDirectory) {
  throw new Error('Usage: node scripts/review-fresh-semantic-diagnostic.ts REFINEMENT_CACHE.json OUTPUT_DIRECTORY')
}
const snapshotPath = join(outputDirectory, 'snapshot.json')
const reportPath = join(outputDirectory, 'report.json')
assert.ok(!existsSync(snapshotPath) && !existsSync(reportPath), 'Preserve the first diagnostic output; choose a separate directory for a later regression run.')
const bytes = readFileSync(new URL('../tests/fixtures/semantic-fresh-diagnostic-v1.json', import.meta.url))
const fixtureFileDigest = createHash('sha256').update(bytes).digest('hex')
assert.equal(fixtureFileDigest, '4c86ac7f2e987526cdaacfd21207e824ad05888a6d5c1bba9f3d50616ad450b2')
const snapshot = collectSemanticQualitySnapshot(fixture.cases.map(({ enemy, word }) => ({ enemy, word })), cachePath)
for (const manifest of Object.values(snapshot.manifests)) assert.equal(manifest.policyDigest, fixture.frozenPolicyDigest)
assert.ok(Object.values(snapshot.inventories).every(inventory => inventory.ready), 'Diagnostic inference must be complete before scoring.')
const comparison = evaluateSemanticBenchmark(snapshot, 'all', {
  ...semanticBenchmark, version: fixture.version, cases: fixture.cases, reviewCases: [],
}, Object.fromEntries(fixture.cases.map(entry => [entry.id, entry.legacyRelation])))
const decisionBases = Object.fromEntries([...new Set(snapshot.records.map(record => record.decisionBasis))]
  .map(basis => [basis, snapshot.records.filter(record => record.decisionBasis === basis).length]))
const report = { diagnosticOnly: true, fixtureFileDigest, frozenPolicyDigest: fixture.frozenPolicyDigest,
  limitations: 'Small assistant-authored sample, scored once after the model policy froze. Prior benchmarks received adaptive feedback and are now regressions. These observations neither estimate dictionary-wide error rates nor alter publication gates.',
  decisionBases, ...comparison }
mkdirSync(outputDirectory, { recursive: true })
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ diagnosticOnly: true, fixtureFileDigest, decisionBases, metrics: report.metrics,
  historicalGateComparison: report.passed, failures: report.failures }, null, 2)}\n`)
