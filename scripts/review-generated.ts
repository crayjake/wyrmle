import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { getWordCommonness } from '../src/generator/lexicalProvider.ts'
import { selectReviewCandidates } from '../src/generator/reviewSelection.ts'
import { difficultyFromAnalysis } from '../src/generator/difficulty.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'

const args = process.argv.slice(2)
const argument = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`)
  return index < 0 ? fallback : args[index + 1] ?? fallback
}
if (args.includes('--help')) {
  console.log('npm run review-generated -- --input artifacts/melancholy/top.json --out artifacts/melancholy/review.json [--dev-top]')
  process.exit(0)
}
const input = resolve(argument('input', 'artifacts/generated/top.json'))
const output = resolve(argument('out', input.replace(/\.json$/, '-review.json')))
const saved = JSON.parse(await readFile(input, 'utf8')) as RankedCandidate[]
if (!Array.isArray(saved) || saved.some(item => !item.candidate?.encounter)) throw new Error('Input must be a ranked-candidate JSON array.')
const ranked: RankedCandidate[] = []
const analysisOptions = {
  solver: { maxStates: 100, beamWidth: 12 },
  counterfactualSolver: { maxStates: 40, beamWidth: 8 },
  maxReasonableStates: 64,
}
for (const [index, item] of saved.entries()) {
  // Recheck a familiar existing route against the real engine as a suggestion.
  const familiar = item.analysis.winningLines.find(line => line.moves.every(move => (getWordCommonness(move.word) ?? 0) >= 0.5))
  const analysis = analysePuzzle(item.candidate, { ...analysisOptions,
    solver: { ...analysisOptions.solver, hintLine: familiar?.moves.map(move => move.tileIds) ?? item.candidate.construction.plannedTileIds },
  })
  const validation = validatePuzzle(item.candidate, analysis)
  const quality = scorePuzzle(item.candidate, analysis)
  ranked.push({ candidate: item.candidate, analysis, validation, quality,
    ...(analysis.bestWinDepth === null ? {} : { difficulty: difficultyFromAnalysis(item.candidate.encounter, analysis) }),
  })
  console.log(`${index + 1}/${saved.length}: ${item.candidate.seed}; ${validation.accepted ? 'accepted' : 'rejected'}; score ${quality.total}; final states ${analysis.fairness.finalResolveStates}; rescues ${analysis.clutchOpportunityCount}`)
}
ranked.sort((a, b) => Number(b.validation.accepted) - Number(a.validation.accepted)
  || b.quality.total - a.quality.total || a.candidate.id.localeCompare(b.candidate.id))
await writeFile(output, JSON.stringify(ranked, null, 2) + '\n')
const accepted = ranked.filter(item => item.validation.accepted)
if (args.includes('--dev-top')) {
  const selected = selectReviewCandidates(accepted)
  if (selected.length < 5 || selected.some(item => item.candidate.enemyWord !== 'MELANCHOLY')) {
    throw new Error('At least five accepted MELANCHOLY candidates are required; previous DEV set preserved.')
  }
  await writeFile(resolve('src/generator/data/melancholy.json'), JSON.stringify(selected, null, 2) + '\n')
}
console.log(JSON.stringify({ reviewed: saved.length, accepted: accepted.length, analysisOptions, output }, null, 2))
