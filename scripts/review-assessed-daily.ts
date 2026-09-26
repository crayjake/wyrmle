import assert from 'node:assert/strict'
import { getGenerationWordCommonness, GENERATION_COMMONNESS_SOURCE } from '../src/generator/familiarity.ts'
import { isMeaningCompilationCurrent, assertMeaningPublicationReady } from '../src/generator/meaningCompiler.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { difficultyFromAnalysis } from '../src/generator/difficulty.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import type { OpeningSafetyReport } from '../src/generator/openingSafety.ts'
import type { SolverMoveSummary } from '../src/generator/findMoves.ts'
import { assertSemanticQualityForPublication } from './lib/semanticQuality.ts'
import { analyseSemanticChoices } from '../src/generator/semanticChoices.ts'
import { assessedPublicationGates as publicationGates } from './lib/publicationGates.ts'

const [candidatePath, witnessesPath, requestedOutput] = process.argv.slice(2)
if (candidatePath && (!witnessesPath || !requestedOutput)) throw new Error('Pass candidate, opening certificate, and output paths, or omit all three to review the publication.')
const published = candidatePath ? undefined : JSON.parse(gunzipSync(readFileSync('artifacts/meaning-v3/selected.json.gz')).toString())
const candidate = (candidatePath ? JSON.parse(readFileSync(candidatePath, 'utf8')) : published.candidate) as CandidatePuzzle
const certificate = (witnessesPath ? JSON.parse(readFileSync(witnessesPath, 'utf8')) : published.analysis.openingSafety) as OpeningSafetyReport
assert.ok(isMeaningCompilationCurrent(candidate.encounter), 'Recompile the current complete assessment cache before review.')
assert.ok(isOpeningSafetyCertificateCurrent(candidate.encounter, certificate), 'Review requires a current, complete all-opening proof.')
assert.equal(certificate.familiarity.source, GENERATION_COMMONNESS_SOURCE)
assertMeaningPublicationReady(candidate.encounter)
assertSemanticQualityForPublication()
const outputPath = requestedOutput ?? '/tmp/wyrmle-assessed-review.json'
const seen = new Set<string>()
const byOpening = new Map<string, number[][][]>()
for (const result of certificate.results) {
  if (result.status !== 'safe' || !result.continuation) continue
  if ((getGenerationWordCommonness(result.openings[0].word) ?? -1) < certificate.familiarity.minimum) continue
  const opening = result.openings[0]
  const route = [opening.tileIds, ...result.continuation.map((move: SolverMoveSummary) => move.tileIds)]
  const key = JSON.stringify(route)
  if (seen.has(key)) continue
  seen.add(key)
  if (!byOpening.has(opening.word)) byOpening.set(opening.word, [])
  byOpening.get(opening.word)!.push(route)
}
// Round-robin distinct words before alternate physical selections. Keep counter
// openings represented instead of letting copies of one spelling fill the budget.
const openingWords = [...byOpening.keys()].sort((a, b) =>
  Number(candidate.encounter.meaningLexicon!.words[b].relation === 'opposite')
    - Number(candidate.encounter.meaningLexicon!.words[a].relation === 'opposite')
  || (getGenerationWordCommonness(b) ?? 0) - (getGenerationWordCommonness(a) ?? 0) || a.localeCompare(b))
const hints: number[][][] = []
for (let round = 0; hints.length < 250; round++) {
  const before = hints.length
  for (const word of openingWords) {
    const route = byOpening.get(word)![round]
    if (route) hints.push(route)
    if (hints.length === 250) break
  }
  if (hints.length === before) break
}
const searchOptions = {
  wordCommonness: getGenerationWordCommonness, commonnessSource: GENERATION_COMMONNESS_SOURCE,
  solver: { maxStates: 180, beamWidth: 20, maxWinningLines: 30, maxMovesPerState: 96,
    maxSelectionsPerState: 1200, hintLines: hints },
  maxReasonableStates: 64, maxFinalStates: 16,
  counterfactualSolver: { maxStates: 80, beamWidth: 12, maxMovesPerState: 64, maxSelectionsPerState: 800 },
}
const analysis = analysePuzzle(candidate, searchOptions)
analysis.openingSafety = certificate
analysis.semanticChoices = analyseSemanticChoices(candidate.encounter, analysis.winningLines)
const validation = validatePuzzle(candidate, analysis, publicationGates)
const quality = scorePuzzle(candidate, analysis)
const difficulty = difficultyFromAnalysis(candidate.encounter, analysis)
writeFileSync(outputPath, JSON.stringify({ candidate, analysis, validation, quality, difficulty, searchOptions, publicationGates }))
console.log(JSON.stringify({ accepted: validation.accepted, reasons: validation.reasons, score: quality.total,
  difficulty, reduced: analysis.refillPressure?.winsOnReducedBoard, semantic: analysis.semanticMechanicImportance,
  revive: analysis.regenImportance, choices: analysis.semanticChoices,
  lines: analysis.winningLines.map(line => ({ words: line.moves.map(move => move.word), lives: line.resolveRemaining })) }, null, 2))
if (!validation.accepted) process.exitCode = 1
