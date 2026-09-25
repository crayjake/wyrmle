import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import benchmarkData from '../tests/fixtures/semantic-benchmark-v1.json' with { type: 'json' }
import legacyCoverage from '../tests/fixtures/semantic-legacy-coverage-v1.json' with { type: 'json' }
import { getWordMeanings } from './lib/wordMeanings.ts'
import { getDictionaryMeaning } from '../src/lexicon/meaningDictionary.ts'
import { getFunctionWord } from '../src/lexicon/functionWords.ts'

export type BenchmarkLabel = 'opposite' | 'similar' | 'neutral'
export type BenchmarkSplit = 'all' | 'development' | 'holdout'
export type SemanticBenchmarkPrediction = {
  enemy: string
  word: string
  relation: BenchmarkLabel | 'related' | 'unrelated'
  senseId: string
}
export type SemanticBenchmarkSnapshot = {
  modelId?: string
  configurationHash?: string
  records: readonly SemanticBenchmarkPrediction[]
}

export const semanticBenchmark = benchmarkData
export const semanticLegacyCoverage = legacyCoverage
const normalize = (word: string) => word.trim().toUpperCase()
const label = (relation: string): BenchmarkLabel | undefined =>
  relation === 'related' || relation === 'unrelated' || relation === 'neutral' ? 'neutral'
    : relation === 'opposite' || relation === 'similar' ? relation : undefined

/** Scores a frozen assessment export; no model, anchor or profile code is imported. */
export function evaluateSemanticBenchmark(
  snapshot: SemanticBenchmarkSnapshot,
  split: BenchmarkSplit = 'all',
  definition = semanticBenchmark,
  legacyRelations: Readonly<Record<string, string | null>> = legacyCoverage.relations,
) {
  const cases = definition.cases.filter(entry => split === 'all' || entry.split === split)
  const byId = new Map<string, SemanticBenchmarkPrediction>()
  const duplicates: string[] = []
  const wanted = new Set([...cases, ...definition.reviewCases].map(entry => entry.id))
  for (const prediction of snapshot.records) {
    const id = `${normalize(prediction.enemy)}/${normalize(prediction.word)}`
    if (!wanted.has(id)) continue
    if (byId.has(id)) duplicates.push(id)
    byId.set(id, prediction)
  }
  const results = cases.map(entry => {
    const prediction = byId.get(entry.id)
    const actual = prediction && label(prediction.relation)
    const sourceIds = new Set(getWordMeanings(entry.word).senses.map(sense => sense.id))
    for (const sense of getFunctionWord(entry.word)?.senses ?? []) sourceIds.add(sense.id)
    const fallback = getDictionaryMeaning(entry.word)
    if (fallback) sourceIds.add(fallback.senseId)
    const sourceSenseValid = Boolean(prediction?.senseId && sourceIds.has(prediction.senseId))
    const allowed = 'allowedSenses' in entry ? entry.allowedSenses : undefined
    const legacyRelation = legacyRelations[entry.id]
    return {
      id: entry.id, enemy: entry.enemy, word: entry.word, split: entry.split, core: entry.core,
      expected: entry.expected, actual: actual ?? null, correct: actual === entry.expected,
      covered: Boolean(actual), senseId: prediction?.senseId ?? null, sourceSenseValid,
      constrained: Boolean(allowed?.length),
      constrainedSenseCorrect: !allowed?.length || Boolean(prediction && allowed.some(sense => sense.senseId === prediction.senseId)),
      legacyRelation, novelConcept: legacyRelation === null && entry.expected !== 'neutral',
      rationale: entry.rationale,
    }
  })
  const fraction = (items: typeof results, predicate: (entry: typeof results[number]) => boolean) => ({
    correct: items.filter(predicate).length, total: items.length,
    rate: items.length ? items.filter(predicate).length / items.length : null,
  })
  const coverage = fraction(results, entry => entry.covered)
  const accuracy = fraction(results, entry => entry.correct)
  const coreAccuracy = fraction(results.filter(entry => entry.core), entry => entry.correct)
  const holdoutAccuracy = fraction(results.filter(entry => entry.split === 'holdout'), entry => entry.correct)
  const sourceSenseAccuracy = fraction(results, entry => entry.sourceSenseValid)
  const constrainedSenseAccuracy = fraction(results.filter(entry => entry.constrained), entry => entry.constrainedSenseCorrect)
  const novelConceptRecall = fraction(results.filter(entry => entry.novelConcept), entry => entry.correct)
  const neutral = results.filter(entry => entry.expected === 'neutral')
  const neutralFalsePositives = fraction(neutral, entry => entry.actual === 'opposite' || entry.actual === 'similar')
  const byEnemy = Object.fromEntries(Object.keys(definition.enemyDefinitions).map(enemy =>
    [enemy, fraction(results.filter(entry => entry.enemy === enemy), entry => entry.correct)]))
  const gates = definition.gates
  const failures: string[] = []
  const atLeast = (name: string, value: number | null, minimum: number) => {
    if (value !== null && value < minimum) failures.push(`${name}: ${value.toFixed(4)} < ${minimum}`)
  }
  atLeast('coverage', coverage.rate, gates.minimumCoverage)
  atLeast('core accuracy', coreAccuracy.rate, gates.minimumCoreAccuracy)
  atLeast('accuracy', accuracy.rate, split === 'holdout' ? gates.minimumHoldoutAccuracy : gates.minimumAccuracy)
  atLeast('holdout accuracy', holdoutAccuracy.rate, gates.minimumHoldoutAccuracy)
  atLeast('valid source sense', sourceSenseAccuracy.rate, 1)
  atLeast('constrained sense accuracy', constrainedSenseAccuracy.rate, gates.minimumConstrainedSenseAccuracy)
  atLeast('previously unprofiled scoring-concept recall', novelConceptRecall.rate, gates.minimumNovelConceptRecall)
  for (const [enemy, value] of Object.entries(byEnemy)) atLeast(`${enemy} accuracy`, value.rate, gates.minimumPerEnemyAccuracy)
  if (neutralFalsePositives.rate !== null && neutralFalsePositives.rate > gates.maximumNeutralFalsePositiveRate) {
    failures.push(`neutral false positives: ${neutralFalsePositives.rate.toFixed(4)} > ${gates.maximumNeutralFalsePositiveRate}`)
  }
  if (duplicates.length) failures.push(`duplicate predictions: ${duplicates.join(', ')}`)
  return {
    version: definition.version,
    fixtureDigest: createHash('sha256').update(JSON.stringify(definition)).digest('hex'),
    legacyCoverageDigest: createHash('sha256').update(JSON.stringify(legacyRelations)).digest('hex'),
    split, modelId: snapshot.modelId ?? null,
    configurationHash: snapshot.configurationHash ?? null, passed: failures.length === 0, failures,
    metrics: { coverage, accuracy, coreAccuracy, holdoutAccuracy, byEnemy, sourceSenseAccuracy,
      constrainedSenseAccuracy, neutralFalsePositives, novelConceptRecall },
    results,
    review: definition.reviewCases.map(entry => ({ ...entry, prediction: byId.get(entry.id) ?? null })),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, ...options] = process.argv.slice(2)
  const split = options.find(value => value.startsWith('--split='))?.slice(8) ?? 'all'
  const output = options.find(value => value.startsWith('--output='))?.slice(9)
  if (!input || !['all', 'development', 'holdout'].includes(split)) {
    throw new Error('Usage: node scripts/evaluate-semantic-benchmark.ts predictions.json [--split=development|holdout|all] [--output=report.json]')
  }
  const snapshot = JSON.parse(readFileSync(input, 'utf8')) as SemanticBenchmarkSnapshot
  if (!Array.isArray(snapshot.records)) throw new Error('Prediction export requires a records array.')
  const report = evaluateSemanticBenchmark(snapshot, split as BenchmarkSplit)
  const rendered = `${JSON.stringify(report, null, 2)}\n`
  if (output) writeFileSync(output, rendered)
  else process.stdout.write(rendered)
  if (!report.passed) process.exitCode = 1
}
