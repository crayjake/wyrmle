import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { semanticBenchmark, semanticLegacyCoverage, evaluateSemanticBenchmark } from '../scripts/evaluate-semantic-benchmark.ts'
import type { SemanticBenchmarkSnapshot, BenchmarkLabel } from '../scripts/evaluate-semantic-benchmark.ts'
import { getDictionaryMeaning } from '../src/lexicon/meaningDictionary.ts'
import { getWordMeanings } from '../scripts/lib/wordMeanings.ts'
import { getFunctionWord } from '../src/lexicon/functionWords.ts'
import developmentExtension from './fixtures/semantic-development-extension-v1.json' with { type: 'json' }
import confirmation from './fixtures/semantic-confirmation-v1.json' with { type: 'json' }

test('independent semantic benchmark is balanced by enemy and split and has real source senses', () => {
  const ids = new Set<string>()
  assert.equal(semanticBenchmark.cases.length, 144)
  for (const entry of semanticBenchmark.cases) {
    assert.ok(!ids.has(entry.id), `duplicate ${entry.id}`)
    ids.add(entry.id)
    assert.ok(getDictionaryMeaning(entry.word)?.definition, `missing definition for ${entry.word}`)
    assert.ok(entry.rationale.trim())
    if ('allowedSenses' in entry) {
      const meanings = getWordMeanings(entry.word)
      for (const sense of entry.allowedSenses ?? []) {
        assert.equal(meanings.senses.find(source => source.id === sense.senseId)?.definition, sense.definition)
      }
    }
  }
  for (const enemy of Object.keys(semanticBenchmark.enemyDefinitions)) {
    for (const split of ['development', 'holdout']) {
      assert.equal(semanticBenchmark.cases.filter(entry => entry.enemy === enemy && entry.split === split).length, 12)
    }
  }
  assert.equal(semanticBenchmark.reviewCases.length, 6)
  assert.deepEqual(Object.keys(semanticLegacyCoverage.relations).sort(), [...ids].sort())
  assert.match(semanticLegacyCoverage.profileSha256, /^[a-f0-9]{64}$/)
})

test('novel development extension has source-backed senses and does not reuse holdout words', () => {
  const heldOut = new Set(semanticBenchmark.cases.filter(entry => entry.split === 'holdout').map(entry => entry.word))
  for (const entry of developmentExtension.cases) {
    assert.ok(!heldOut.has(entry.word), `held-out word leaked into development: ${entry.word}`)
    assert.ok(getDictionaryMeaning(entry.word)?.definition)
    for (const sense of entry.allowedSenses) {
      assert.equal(getWordMeanings(entry.word).senses.find(source => source.id === sense.senseId)?.definition, sense.definition)
    }
  }
})

test('confirmation words are separate, definition backed, and retain the original frozen fixture', () => {
  const previous = new Set([...semanticBenchmark.cases, ...developmentExtension.cases].map(entry => entry.word))
  const original = readFileSync(new URL('../artifacts/semantic-assessment/evaluation/confirmation-original-fixture.json', import.meta.url))
  assert.equal(createHash('sha256').update(original).digest('hex'), confirmation.originalFrozenSha256)
  assert.equal(confirmation.cases.length, 36)
  for (const entry of confirmation.cases) {
    assert.ok(!previous.has(entry.word), `confirmation word already used: ${entry.word}`)
    assert.ok(getDictionaryMeaning(entry.word)?.definition)
    for (const sense of ('allowedSenses' in entry ? entry.allowedSenses : []) ?? []) {
      assert.equal(getWordMeanings(entry.word).senses.find(source => source.id === sense.senseId)?.definition, sense.definition)
    }
  }
})

const perfectSnapshot = (): SemanticBenchmarkSnapshot => ({
  modelId: 'evaluation-test-fixture', configurationHash: 'synthetic-test-only',
  records: semanticBenchmark.cases.map(entry => ({ enemy: entry.enemy, word: entry.word,
    relation: entry.expected as BenchmarkLabel,
    senseId: ('allowedSenses' in entry ? entry.allowedSenses?.[0]?.senseId : undefined)
      ?? getDictionaryMeaning(entry.word)!.senseId,
  })),
})

test('benchmark evaluation detects neutral false positives and the known CALM regression', () => {
  const perfect = perfectSnapshot()
  assert.equal(evaluateSemanticBenchmark(perfect).passed, true)
  const corrupted = structuredClone(perfect)
  const calm = corrupted.records.find(entry => entry.enemy === 'CHAOS' && entry.word === 'CALM')!
  calm.relation = 'unrelated'
  for (const entry of corrupted.records.filter(entry => entry.word === 'WHERE')) entry.relation = 'opposite'
  const report = evaluateSemanticBenchmark(corrupted)
  assert.equal(report.passed, false)
  assert.ok(report.failures.some(message => message.startsWith('core accuracy:')))
  assert.ok(report.failures.some(message => message.startsWith('neutral false positives:')))
})

test('benchmark rejects a correct relation with the wrong source sense and missing assessments', () => {
  const corrupted = structuredClone(perfectSnapshot())
  const nerve = corrupted.records.find(entry => entry.word === 'NERVE')!
  nerve.senseId = 'oewn-nerve__1.08.00..'
  const senseReport = evaluateSemanticBenchmark(corrupted, 'holdout')
  assert.equal(senseReport.metrics.accuracy.rate, 1)
  assert.equal(senseReport.passed, false)
  assert.ok(senseReport.failures.some(message => message.startsWith('constrained sense accuracy:')))
  const missingReport = evaluateSemanticBenchmark({ records: corrupted.records.slice(1) })
  assert.ok(missingReport.failures.some(message => message.startsWith('coverage:')))
})

test('legacy profile agreement cannot mask poor recall of newly assessed concepts', () => {
  const corrupted = structuredClone(perfectSnapshot())
  for (const prediction of corrupted.records) {
    const id = `${prediction.enemy}/${prediction.word}` as keyof typeof semanticLegacyCoverage.relations
    if (semanticLegacyCoverage.relations[id] === null) prediction.relation = 'neutral'
  }
  const report = evaluateSemanticBenchmark(corrupted)
  assert.equal(report.metrics.coreAccuracy.rate, 1)
  assert.equal(report.metrics.novelConceptRecall.rate, 0)
  assert.ok(report.failures.some(message => message.startsWith('previously unprofiled scoring-concept recall:')))
})

test('source-sense validation accepts every licensed function-word sense, not only the default', () => {
  const snapshot = structuredClone(perfectSnapshot())
  const senses = getFunctionWord('WHERE')!.senses
  const alternate = senses.find(sense => sense.id !== getDictionaryMeaning('WHERE')!.senseId)!
  assert.ok(alternate)
  for (const prediction of snapshot.records.filter(entry => entry.word === 'WHERE')) prediction.senseId = alternate.id
  assert.equal(evaluateSemanticBenchmark(snapshot).metrics.sourceSenseAccuracy.rate, 1)
})
