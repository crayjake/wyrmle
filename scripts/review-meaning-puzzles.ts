import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateForEnemy } from '../src/generator/generate.ts'

const enemies = (process.argv[2] ?? 'ANGER,DESPAIR,CHAOS').split(',')
const count = Number(process.argv[3] ?? 6)
const output = resolve(process.argv[4] ?? '/tmp/wyrmle-meaning-candidates')
mkdirSync(output, { recursive: true })
const summaries: unknown[] = []
for (const enemy of enemies) for (let index = 0; index < count; index++) {
  const refillLimit = [12, 15, 18][index % 3]
  const result = generateForEnemy(enemy, `meaning-review-20260925:${index}`, {
    candidateCount: 1, keep: 1, refinementRounds: 0, includeRegenTile: true, refillLimit,
    analysis: {
      solver: { maxStates: 48, beamWidth: 10, maxMovesPerState: 48, maxSelectionsPerState: 600 },
      maxReasonableStates: 20, maxFinalStates: 6,
      counterfactualSolver: { maxStates: 20, beamWidth: 6, maxMovesPerState: 32, maxSelectionsPerState: 400 },
    },
  })
  for (const ranked of result.ranked) {
    writeFileSync(resolve(output, `${ranked.candidate.id}.json`), JSON.stringify(ranked))
    const a = ranked.analysis
    const summary = { id: ranked.candidate.id, enemy, refillLimit, score: ranked.quality.total,
      accepted: ranked.validation.accepted, reasons: ranked.validation.reasons.map(reason => reason.code),
      depth: a.bestWinDepth, semantic: a.semanticMechanicImportance, revive: a.regenImportance,
      reduced: a.refillPressure?.winsOnReducedBoard, variety: a.numberOfDistinctWinningStrategies,
      lines: a.winningLines.slice(0, 4).map(line => line.moves.map(move => move.word)) }
    summaries.push(summary)
    console.log(JSON.stringify(summary))
    writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summaries, null, 2) + '\n')
  }
}
