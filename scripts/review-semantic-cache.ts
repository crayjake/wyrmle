/** Extract and evaluate actual complete inference outputs, never prototype answers. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { evaluateSemanticBenchmark, semanticBenchmark } from './evaluate-semantic-benchmark.ts'
import type { SemanticBenchmarkPrediction, SemanticBenchmarkSnapshot } from './evaluate-semantic-benchmark.ts'
import development from '../tests/fixtures/semantic-development-extension-v1.json' with { type: 'json' }

const [rawDirectory, snapshotPath, reportDirectory, confirmationPath = 'tests/fixtures/semantic-confirmation-v1.json'] = process.argv.slice(2)
if (!rawDirectory || !snapshotPath || !reportDirectory) {
  throw new Error('Usage: node scripts/review-semantic-cache.ts RAW_DIRECTORY SNAPSHOT.json REPORT_DIRECTORY [CONFIRMATION.json]')
}
const confirmationBytes = readFileSync(confirmationPath)
const confirmation = JSON.parse(confirmationBytes.toString('utf8'))
const confirmationDigest = createHash('sha256').update(confirmationBytes).digest('hex')
const cases = [...semanticBenchmark.cases, ...semanticBenchmark.reviewCases, ...development.cases, ...confirmation.cases]
const records: SemanticBenchmarkPrediction[] = []
const rawCaches: Record<string, { sha256: string; wordsAssessed: number; sensesAssessed: number }> = {}
let sourceDigest: string | undefined
let configurationHash: string | undefined
let modelLockDigest: string | undefined
let modelId: string | undefined
for (const enemy of Object.keys(semanticBenchmark.enemyDefinitions)) {
  const bytes = readFileSync(join(rawDirectory, `${enemy.toLowerCase()}.json.gz`))
  const raw = JSON.parse(gunzipSync(bytes).toString('utf8'))
  assert.equal(raw.enemyWord, enemy)
  sourceDigest ??= raw.metadata.sourceDigest
  configurationHash ??= raw.metadata.configurationHash
  modelLockDigest ??= raw.metadata.modelLockDigest
  modelId ??= `${raw.metadata.configuration.embedding} + ${raw.metadata.configuration.nli}`
  assert.match(sourceDigest!, /^[a-f0-9]{64}$/)
  assert.match(configurationHash!, /^[a-f0-9]{64}$/)
  assert.match(modelLockDigest!, /^[a-f0-9]{64}$/)
  assert.equal(raw.metadata.sourceDigest, sourceDigest, 'All enemy outputs must use one source export.')
  assert.equal(raw.metadata.configurationHash, configurationHash, 'All enemy outputs must use one frozen policy.')
  assert.equal(raw.metadata.modelLockDigest, modelLockDigest, 'All enemy outputs must use one model lock.')
  rawCaches[enemy] = { sha256: createHash('sha256').update(bytes).digest('hex'),
    wordsAssessed: raw.metadata.wordsAssessed, sensesAssessed: raw.metadata.sensesAssessed }
  for (const word of [...new Set<string>(cases.filter(entry => entry.enemy === enemy).map(entry => entry.word))].sort()) {
    const prediction = raw.words[word]
    assert.ok(prediction, `Actual inference output is missing ${enemy}/${word}`)
    records.push({ enemy, word, relation: prediction.relation, senseId: prediction.senseId })
  }
}
const snapshot: SemanticBenchmarkSnapshot & { sourceDigest?: string; modelLockDigest?: string;
  confirmationDigest: string; rawCaches: typeof rawCaches } = {
  modelId, configurationHash, sourceDigest, modelLockDigest, confirmationDigest, rawCaches, records,
}
const primary = evaluateSemanticBenchmark(snapshot)
const developmentReport = evaluateSemanticBenchmark(snapshot, 'all', {
  ...semanticBenchmark, version: development.version, cases: development.cases, reviewCases: [],
  gates: { ...semanticBenchmark.gates, minimumAccuracy: 1, minimumPerEnemyAccuracy: 1 },
}, Object.fromEntries(development.cases.map(entry => [entry.id, entry.legacyRelation])))
const confirmationReport = evaluateSemanticBenchmark(snapshot, 'all', {
  ...semanticBenchmark, version: confirmation.version, cases: confirmation.cases, reviewCases: [],
  gates: { ...semanticBenchmark.gates, ...confirmation.gates },
}, Object.fromEntries(confirmation.cases.map((entry: { id: string; legacyRelation: string | null }) => [entry.id, entry.legacyRelation])))
const summary = { source: 'actual-complete-inference-outputs', modelId, configurationHash, sourceDigest,
  modelLockDigest, confirmationDigest, rawCaches, passed: primary.passed && developmentReport.passed && confirmationReport.passed,
  primary: { passed: primary.passed, failures: primary.failures, metrics: primary.metrics, fixtureDigest: primary.fixtureDigest },
  development: { passed: developmentReport.passed, failures: developmentReport.failures, metrics: developmentReport.metrics },
  confirmation: { passed: confirmationReport.passed, failures: confirmationReport.failures,
    metrics: confirmationReport.metrics, fixtureDigest: confirmationReport.fixtureDigest },
}
mkdirSync(dirname(snapshotPath), { recursive: true })
mkdirSync(reportDirectory, { recursive: true })
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
for (const [name, result] of Object.entries({ primary, development: developmentReport, confirmation: confirmationReport, summary })) {
  writeFileSync(join(reportDirectory, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`)
}
process.stdout.write(`${JSON.stringify({ passed: summary.passed, configurationHash,
  primary: { accuracy: primary.metrics.accuracy, novelRecall: primary.metrics.novelConceptRecall, failures: primary.failures },
  development: { accuracy: developmentReport.metrics.accuracy, failures: developmentReport.failures },
  confirmation: { accuracy: confirmationReport.metrics.accuracy,
    novelRecall: confirmationReport.metrics.novelConceptRecall, failures: confirmationReport.failures },
}, null, 2)}\n`)
if (!summary.passed) process.exitCode = 1
