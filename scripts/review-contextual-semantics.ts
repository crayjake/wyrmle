/** Evaluate actual frozen LLM memo decisions, separately from whole-corpus NLI coverage. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import development from '../tests/fixtures/semantic-development-extension-v1.json' with { type: 'json' }
import confirmation from '../tests/fixtures/semantic-confirmation-v1.json' with { type: 'json' }
import { collectSemanticQualitySnapshot } from './lib/semanticQuality.ts'
import { evaluateSemanticBenchmark, semanticBenchmark } from './evaluate-semantic-benchmark.ts'

const [snapshotPath, reportDirectory] = process.argv.slice(2)
if (!snapshotPath || !reportDirectory) {
  throw new Error('Usage: node scripts/review-contextual-semantics.ts SNAPSHOT.json REPORT_DIRECTORY')
}
const snapshot = collectSemanticQualitySnapshot()
const primary = evaluateSemanticBenchmark(snapshot)
const developmentReport = evaluateSemanticBenchmark(snapshot, 'all', {
  ...semanticBenchmark, version: development.version, cases: development.cases, reviewCases: [],
  gates: { ...semanticBenchmark.gates, minimumAccuracy: 1, minimumPerEnemyAccuracy: 1 },
}, Object.fromEntries(development.cases.map(entry => [entry.id, entry.legacyRelation])))
const confirmationReport = evaluateSemanticBenchmark(snapshot, 'all', {
  ...semanticBenchmark, version: confirmation.version, cases: confirmation.cases, reviewCases: [],
  gates: { ...semanticBenchmark.gates, ...confirmation.gates },
}, Object.fromEntries(confirmation.cases.map(entry => [entry.id, entry.legacyRelation])))
const ready = Object.values(snapshot.inventories).every(inventory => inventory.ready)
const summary = { source: snapshot.source, modelId: snapshot.modelId, configurationHash: snapshot.configurationHash,
  refinementFileDigest: snapshot.refinementFileDigest, confirmationDigest: snapshot.confirmationDigest,
  baseCaches: snapshot.baseCaches, manifests: snapshot.manifests, inventories: snapshot.inventories,
  passed: ready && primary.passed && developmentReport.passed && confirmationReport.passed,
  primary: { passed: primary.passed, failures: primary.failures, metrics: primary.metrics, fixtureDigest: primary.fixtureDigest },
  development: { passed: developmentReport.passed, failures: developmentReport.failures, metrics: developmentReport.metrics },
  confirmation: { passed: confirmationReport.passed, failures: confirmationReport.failures,
    metrics: confirmationReport.metrics, fixtureDigest: confirmationReport.fixtureDigest },
}
mkdirSync(dirname(snapshotPath), { recursive: true })
mkdirSync(reportDirectory, { recursive: true })
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
for (const [name, report] of Object.entries({ primary, development: developmentReport, confirmation: confirmationReport, summary })) {
  writeFileSync(join(reportDirectory, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`)
}
process.stdout.write(`${JSON.stringify({ passed: summary.passed, ready, configurationHash: snapshot.configurationHash,
  inventories: Object.fromEntries(Object.entries(snapshot.inventories).map(([enemy, inventory]) => [enemy,
    { ready: inventory.ready, eligible: inventory.eligibleWords, reviewed: inventory.reviewedWords, issues: inventory.issues.length }])),
  primary: { accuracy: primary.metrics.accuracy, novelRecall: primary.metrics.novelConceptRecall, failures: primary.failures },
  development: { accuracy: developmentReport.metrics.accuracy, failures: developmentReport.failures },
  confirmation: { accuracy: confirmationReport.metrics.accuracy,
    novelRecall: confirmationReport.metrics.novelConceptRecall, failures: confirmationReport.failures },
}, null, 2)}\n`)
if (!summary.passed) process.exitCode = 1
