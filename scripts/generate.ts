import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { generateForEnemy, generatePuzzle } from '../src/generator/generate.ts'
import type { GenerationOptions, RankedCandidate } from '../src/generator/generate.ts'
import { selectReviewCandidates } from '../src/generator/reviewSelection.ts'
import { validateRefillLimit } from '../src/generator/refillLimit.ts'

const argumentsList = process.argv.slice(2)
const argument = (name: string, fallback: string) => {
  const index = argumentsList.indexOf(`--${name}`)
  return index < 0 ? fallback : argumentsList[index + 1] ?? fallback
}
const integer = (name: string, fallback: number, minimum = 0) => {
  const value = Number(argument(name, String(fallback)))
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`--${name} must be an integer >= ${minimum}.`)
  return value
}
if (argumentsList.includes('--help')) {
  console.log('npm run generate -- --count 200 --enemy MELANCHOLY --seed review --out artifacts/melancholy [--refine 1] [--regen] [--refills 0..96] [--dev-top]')
  console.log('Omit --enemy for suitability-based automatic enemy selection. --states and --beam control bounded search. No daily catalog is changed.')
  console.log('--regen includes one harmful Revive tile. New puzzles compile a definition and meaning classification for every allowed word; no grammar or length bonuses.')
  console.log('--legacy-bonuses reproduces the previous lexical/bonus generation; --legacy reproduces the original archived seed rules.')
  console.log('--refills N opts into N finite replacement letters (0–96). Length mutations may refine this budget; omitted keeps the historical padded supply.')
  process.exit(0)
}
const count = integer('count', 10, 1)
const enemy = argument('enemy', '').toUpperCase()
const seed = argument('seed', 'melancholy-review-v1')
const output = resolve(argument('out', 'artifacts/generated'))
const refillLimit = argumentsList.includes('--refills') ? validateRefillLimit(integer('refills', Number.NaN)) : undefined
await mkdir(output, { recursive: true })
const options: GenerationOptions = {
  lexicalMode: argumentsList.includes('--legacy') ? 'legacy' : 'current',
  scoringMode: argumentsList.includes('--legacy-bonuses') ? 'legacy-bonuses' : 'meaning',
  includeRegenTile: argumentsList.includes('--regen'),
  ...(refillLimit === undefined ? {} : { refillLimit }),
  candidateCount: 1, keep: 100, refinementRounds: integer('refine', 0), mutationsPerRound: integer('mutations', 2),
  analysis: {
    solver: { maxStates: integer('states', 100, 1), beamWidth: integer('beam', 12, 1) },
    counterfactualSolver: { maxStates: integer('counterfactual-states', 50, 1), beamWidth: 8 },
  },
}
const report = {
  seed, requestedSeeds: count, enemy: enemy || 'automatic', attempted: 0, solvable: 0, accepted: 0, acceptedUnique: 0,
  enemyRejectionCounts: {} as Record<string, number>, candidateRejectionReasons: {} as Record<string, number>,
  archetypeDistribution: {} as Record<string, number>, totalSolverStates: 0, totalRuntimeMs: 0,
  averageSolverStates: 0, averageRuntimeMs: 0,
  prematureHopelessness: { unknown: 0, zero: 0, low: 0, high: 0 },
  clutchOpportunities: {} as Record<string, number>,
  topQualityScores: [] as { id: string; score: number; seed: string; enemy: string }[],
  acceptedSeeds: [] as string[],
  search: { scope: 'bounded-development-review', options },
}
const top: RankedCandidate[] = []
const increment = (counts: Record<string, number>, key: string, amount = 1) => { counts[key] = (counts[key] ?? 0) + amount }
for (let index = 0; index < count; index++) {
  const started = performance.now()
  const result = enemy ? generateForEnemy(enemy, `${seed}:${index}`, options) : generatePuzzle(`${seed}:${index}`, options)
  report.totalRuntimeMs += performance.now() - started
  report.attempted += result.attempted
  report.solvable += result.solvable
  report.accepted += result.acceptedCount
  report.acceptedUnique += result.accepted.length
  for (const rejected of result.enemyRejections) for (const reason of rejected.rejectionReasons) increment(report.enemyRejectionCounts, reason)
  for (const [reason, count] of Object.entries(result.rejectionCounts)) increment(report.candidateRejectionReasons, reason, count)
  for (const ranked of result.ranked) {
    const analysis = ranked.analysis
    report.totalSolverStates += analysis.statesExplored
    for (const archetype of ranked.candidate.goal.archetypes) increment(report.archetypeDistribution, archetype)
    const deadRate = analysis.prematureDeadStateRate
    report.prematureHopelessness[deadRate === null ? 'unknown' : deadRate === 0 ? 'zero' : deadRate <= 0.25 ? 'low' : 'high']++
    increment(report.clutchOpportunities, String(analysis.clutchOpportunityCount))
  }
  for (const accepted of result.accepted) {
    report.acceptedSeeds.push(accepted.candidate.seed)
    await writeFile(resolve(output, `${accepted.candidate.id}.json`), JSON.stringify(accepted, null, 2) + '\n')
    top.push(accepted)
  }
  top.sort((a, b) => b.quality.total - a.quality.total || a.candidate.id.localeCompare(b.candidate.id))
  top.splice(20)
  report.averageSolverStates = report.totalSolverStates / Math.max(1, report.attempted)
  report.averageRuntimeMs = report.totalRuntimeMs / Math.max(1, report.attempted)
  report.topQualityScores = top.map(item => ({ id: item.candidate.id, score: item.quality.total, seed: item.candidate.seed, enemy: item.candidate.enemyWord }))
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${index + 1}/${count}: ${result.enemyWord ?? 'rejected enemy'}; attempted ${report.attempted}; solvable ${report.solvable}; accepted ${report.accepted}; best ${top[0]?.quality.total ?? 'none'}`)
}
await writeFile(resolve(output, 'top.json'), JSON.stringify(top, null, 2) + '\n')
if (argumentsList.includes('--dev-top')) {
  if (enemy !== 'MELANCHOLY') throw new Error('--dev-top requires --enemy MELANCHOLY.')
  const unique = selectReviewCandidates(top)
  if (unique.length < 5) throw new Error('Fewer than five distinct accepted puzzles; existing DEV review set was preserved.')
  await writeFile(resolve('src/generator/data/melancholy.json'), JSON.stringify(unique.slice(0, 5), null, 2) + '\n')
}
console.log(JSON.stringify(report, null, 2))
