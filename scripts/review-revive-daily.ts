import { readFile, writeFile } from 'node:fs/promises'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { difficultyFromAnalysis } from '../src/generator/difficulty.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import type { OpeningSafetyReport } from '../src/generator/openingSafety.ts'

const artifact = (name: string) => new URL(`../artifacts/revive-lexical-v2/anger/${name}.json`, import.meta.url)
const candidate = JSON.parse(await readFile(artifact('early-r-long7-candidate'), 'utf8')) as CandidatePuzzle
const walkthroughs = JSON.parse(await readFile(artifact('selected-walkthroughs'), 'utf8')) as {
  candidateId: string; routes: { tileIds: number[][] }[]
}
if (walkthroughs.candidateId !== candidate.id) throw new Error('Walkthroughs belong to another candidate.')
const analysis = analysePuzzle(candidate.encounter, {
  solver: { maxStates: 320, beamWidth: 24, maxMovesPerState: 96, maxSelectionsPerState: 2200,
    maxWinningLines: 24, hintLines: walkthroughs.routes.map(route => route.tileIds) },
  counterfactualSolver: { maxStates: 80, beamWidth: 12 },
  maxReasonableStates: 120, maxFinalStates: 25,
})
analysis.openingSafety = JSON.parse(await readFile(artifact('early-r-long7-common-opening-safety'), 'utf8')) as OpeningSafetyReport
const publicationGates = { requireOpeningSafety: true, allowRestrictedOpeningSafety: true,
  openingSafetyScope: 'all-valid-openings' as const, requireFairnessCoverage: true }
const validation = validatePuzzle(candidate, analysis, publicationGates)
const quality = scorePuzzle(candidate, analysis)
const difficulty = difficultyFromAnalysis(candidate.encounter, analysis)
const report = { candidate, analysis, validation, quality, difficulty, publicationGates }
await writeFile(artifact('early-r-long7-reviewed'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ accepted: validation.accepted, reasons: validation.reasons, quality: quality.total,
  difficulty, strategies: analysis.numberOfDistinctWinningStrategies, fairness: analysis.fairness,
  counterfactuals: analysis.counterfactuals }, null, 2))
if (!validation.accepted) process.exitCode = 1
