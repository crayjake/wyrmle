/** Evaluate actual frozen LLM memo decisions, separately from whole-corpus NLI coverage. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { collectSemanticQualitySnapshot, evaluateSemanticQuality } from './lib/semanticQuality.ts'

const [snapshotPath, reportDirectory, refinementPath] = process.argv.slice(2)
if (!snapshotPath || !reportDirectory) {
  throw new Error('Usage: node scripts/review-contextual-semantics.ts SNAPSHOT.json REPORT_DIRECTORY [REFINEMENT_CACHE.json]')
}
const snapshot = collectSemanticQualitySnapshot(undefined, refinementPath)
const { ready, primary, development: developmentReport, confirmation: confirmationReport, diagnostic, inventory, passed } = evaluateSemanticQuality(snapshot)
const summary = { source: snapshot.source, modelId: snapshot.modelId, configurationHash: snapshot.configurationHash,
  refinementFileDigest: snapshot.refinementFileDigest, confirmationDigest: snapshot.confirmationDigest,
  baseCaches: snapshot.baseCaches, manifests: snapshot.manifests, inventories: snapshot.inventories,
  passed,
  primary: { passed: primary.passed, failures: primary.failures, metrics: primary.metrics, fixtureDigest: primary.fixtureDigest },
  development: { passed: developmentReport.passed, failures: developmentReport.failures, metrics: developmentReport.metrics },
  confirmation: { passed: confirmationReport.passed, failures: confirmationReport.failures,
    metrics: confirmationReport.metrics, fixtureDigest: confirmationReport.fixtureDigest },
  diagnostic: { passed: diagnostic.passed, failures: diagnostic.failures, metrics: diagnostic.metrics, fixtureDigest: diagnostic.fixtureDigest },
  inventory: { passed: inventory.passed, failures: inventory.failures, metrics: inventory.metrics, fixtureDigest: inventory.fixtureDigest },
}
mkdirSync(dirname(snapshotPath), { recursive: true })
mkdirSync(reportDirectory, { recursive: true })
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
for (const [name, report] of Object.entries({ primary, development: developmentReport, confirmation: confirmationReport, diagnostic, inventory, summary })) {
  writeFileSync(join(reportDirectory, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`)
}
process.stdout.write(`${JSON.stringify({ passed: summary.passed, ready, configurationHash: snapshot.configurationHash,
  inventories: Object.fromEntries(Object.entries(snapshot.inventories).map(([enemy, inventory]) => [enemy,
    { ready: inventory.ready, eligible: inventory.eligibleWords, reviewed: inventory.reviewedWords, issues: inventory.issues.length }])),
  primary: { accuracy: primary.metrics.accuracy, novelRecall: primary.metrics.novelConceptRecall, failures: primary.failures },
  development: { accuracy: developmentReport.metrics.accuracy, failures: developmentReport.failures },
  confirmation: { accuracy: confirmationReport.metrics.accuracy,
    novelRecall: confirmationReport.metrics.novelConceptRecall, failures: confirmationReport.failures },
  diagnostic: { accuracy: diagnostic.metrics.accuracy, failures: diagnostic.failures },
  inventory: { accuracy: inventory.metrics.accuracy, failures: inventory.failures },
}, null, 2)}\n`)
if (!summary.passed) process.exitCode = 1
