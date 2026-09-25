import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { difficultyFromAnalysis } from '../src/generator/difficulty.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import type { OpeningSafetyReport } from '../src/generator/openingSafety.ts'
import type { SolverMoveSummary } from '../src/generator/findMoves.ts'

const [candidatePath, witnessesPath, requestedOutput] = process.argv.slice(2)
if (candidatePath && (!witnessesPath || !requestedOutput)) throw new Error('Pass candidate, opening certificate, and output paths, or omit all three to review the publication.')
const published = candidatePath ? undefined : JSON.parse(gunzipSync(readFileSync('artifacts/meaning-v1/selected.json.gz')).toString())
const candidate = (candidatePath ? JSON.parse(readFileSync(candidatePath, 'utf8')) : published.candidate) as CandidatePuzzle
const certificate = (witnessesPath ? JSON.parse(readFileSync(witnessesPath, 'utf8')) : published.analysis.openingSafety) as OpeningSafetyReport
const outputPath = requestedOutput ?? '/tmp/wyrmle-meaning-review.json'
const seen = new Set<string>()
const hints: number[][][] = []
for (const result of certificate.results) {
  if (result.status !== 'safe' || !result.continuation) continue
  const words = [result.openings[0].word, ...result.continuation.map(move => move.word)].join(',')
  if (seen.has(words)) continue
  seen.add(words)
  hints.push([result.openings[0].tileIds, ...result.continuation.map((move: SolverMoveSummary) => move.tileIds)])
}
// Retain distinct familiar openings without making analysis dependent on the
// thousands of equivalent physical copies in a full opening certificate.
const searchOptions = {
  solver: { maxStates: 180, beamWidth: 20, maxWinningLines: 30, maxMovesPerState: 96,
    maxSelectionsPerState: 1200, hintLines: hints.slice(0, 250) },
  maxReasonableStates: 64, maxFinalStates: 16,
  counterfactualSolver: { maxStates: 80, beamWidth: 12, maxMovesPerState: 64, maxSelectionsPerState: 800 },
}
const analysis = analysePuzzle(candidate, searchOptions)
analysis.openingSafety = certificate
const publicationGates = { requireOpeningSafety: true, openingSafetyScope: 'all-valid-openings' as const,
  allowRestrictedOpeningSafety: false, requireFairnessCoverage: true }
const validation = validatePuzzle(candidate, analysis, publicationGates)
const quality = scorePuzzle(candidate, analysis)
const difficulty = difficultyFromAnalysis(candidate.encounter, analysis)
writeFileSync(outputPath, JSON.stringify({ candidate, analysis, validation, quality, difficulty, searchOptions, publicationGates }))
console.log(JSON.stringify({ accepted: validation.accepted, reasons: validation.reasons, score: quality.total,
  difficulty, reduced: analysis.refillPressure?.winsOnReducedBoard, semantic: analysis.semanticMechanicImportance,
  revive: analysis.regenImportance, lines: analysis.winningLines.map(line => ({ words: line.moves.map(move => move.word), lives: line.resolveRemaining })) }, null, 2))
