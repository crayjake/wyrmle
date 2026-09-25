import { readFile, writeFile } from 'node:fs/promises'
import { analysePuzzle } from '../src/generator/analyse.ts'
import type { AnalysisOptions } from '../src/generator/analyse.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import type { ValidationConfig } from '../src/generator/config.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { difficultyFromAnalysis } from '../src/generator/difficulty.ts'
import type { OpeningSafetyReport } from '../src/generator/openingSafety.ts'

const path = new URL('../artifacts/finite-refills-v1/selected.json', import.meta.url)
const selected = JSON.parse(await readFile(path, 'utf8')) as {
  candidate: CandidatePuzzle; searchOptions: AnalysisOptions; publicationGates: Partial<ValidationConfig>
  analysis: { openingSafety: OpeningSafetyReport }
}
const analysis = analysePuzzle(selected.candidate.encounter, selected.searchOptions)
analysis.openingSafety = selected.analysis.openingSafety
const validation = validatePuzzle(selected.candidate, analysis, selected.publicationGates)
const quality = scorePuzzle(selected.candidate, analysis)
const difficulty = difficultyFromAnalysis(selected.candidate.encounter, analysis)
await writeFile(path, JSON.stringify({ ...selected, analysis, validation, quality, difficulty }, null, 2) + '\n')
console.log(JSON.stringify({ accepted: validation.accepted, reasons: validation.reasons,
  quality: quality.total, difficulty: difficulty.label, initialRefills: analysis.refillPressure?.initialRefills,
  winsOnReducedBoard: analysis.refillPressure?.winsOnReducedBoard,
  safeOpenings: analysis.openingSafety.safeSelections }, null, 2))
if (!validation.accepted) process.exitCode = 1
