import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { withCompiledMeanings } from '../src/generator/meaningCompiler.ts'
import { certifyOpeningSafety } from '../src/generator/openingSafety.ts'
import { getWordCommonness, localLexicalProvider } from '../src/generator/lexicalProvider.ts'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { difficultyFromAnalysis } from '../src/generator/difficulty.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'

const input = process.argv[2]
if (!input) throw new Error('Pass the ranked CHAOS candidate path.')
const base = JSON.parse(readFileSync(input, 'utf8')) as RankedCandidate
const output = '/tmp/wyrmle-meaning-refinements'
mkdirSync(output, { recursive: true })
const queue = base.candidate.encounter.refillQueue
const variants = [
  { name: 'early-c', queue: 'C' + queue.slice(1) },
  { name: 'spare-c', queue: queue + 'C' },
  { name: 'insert-c', queue: queue.slice(0, 3) + 'C' + queue.slice(3) },
  { name: 'late-c', queue: queue.slice(0, -1) + 'C' },
]
const openingVocabulary = localLexicalProvider.vocabulary().filter(entry => (entry.commonness ?? -1) >= 0.5).map(entry => entry.word)
for (const variant of variants) {
  const candidate = structuredClone(base.candidate)
  candidate.id += `-${variant.name}`
  candidate.encounter = withCompiledMeanings({ ...candidate.encounter, id: candidate.id, refillQueue: variant.queue })
  candidate.construction.mutations.push(`Opening recovery review: ${variant.name}; reserve ${variant.queue}`)
  candidate.provenance.parentId = base.candidate.id
  const openingSafety = certifyOpeningSafety(candidate.encounter, {
    scope: 'all-valid-openings', openingVocabulary, requireFamiliarContinuation: true,
    minimumCommonness: 0.5, maxSuccessors: 1000, maxDurationMs: 180000,
    solver: { maxStates: 100, beamWidth: 12, maxMovesPerState: 64, maxSelectionsPerState: 800 },
  })
  writeFileSync(`${output}/${variant.name}-openings.json`, JSON.stringify(openingSafety, null, 2))
  console.log(JSON.stringify({ variant: variant.name, safe: openingSafety.safeSelections,
    unsafe: openingSafety.unsafeSelections, unknown: openingSafety.unknownSelections }))
  const searchOptions = {
    wordCommonness: getWordCommonness,
    solver: { maxStates: 140, beamWidth: 18, maxWinningLines: 24, maxMovesPerState: 80, maxSelectionsPerState: 1000,
      hintLines: openingSafety.results.filter(result => result.continuation).map(result => [result.openings[0].tileIds, ...result.continuation!.map(move => move.tileIds)]) },
    maxReasonableStates: 48, maxFinalStates: 12,
    counterfactualSolver: { maxStates: 60, beamWidth: 10, maxMovesPerState: 48, maxSelectionsPerState: 600 },
  }
  const analysis = analysePuzzle(candidate, searchOptions)
  analysis.openingSafety = openingSafety
  const publicationGates = { requireOpeningSafety: true, openingSafetyScope: 'all-valid-openings' as const,
    allowRestrictedOpeningSafety: true, requireFairnessCoverage: true }
  const validation = validatePuzzle(candidate, analysis, publicationGates)
  const quality = scorePuzzle(candidate, analysis)
  const difficulty = analysis.bestWinDepth ? difficultyFromAnalysis(candidate.encounter, analysis) : null
  writeFileSync(`${output}/${variant.name}.json`, JSON.stringify({ candidate, analysis, quality, validation, difficulty, searchOptions, publicationGates }))
  console.log(JSON.stringify({ variant: variant.name, accepted: validation.accepted, score: quality.total,
    reasons: validation.reasons.map(reason => reason.code), depth: analysis.bestWinDepth,
    reduced: analysis.refillPressure?.winsOnReducedBoard, semantic: analysis.semanticMechanicImportance,
    revive: analysis.regenImportance, lines: analysis.winningLines.slice(0, 5).map(line => line.moves.map(move => move.word)) }))
}
