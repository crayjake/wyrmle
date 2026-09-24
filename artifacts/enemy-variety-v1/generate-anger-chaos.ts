import { writeFile } from 'node:fs/promises'
import { generateForEnemy } from '../../src/generator/generate.ts'
for (const enemy of ['ANGER', 'CHAOS']) {
  const result = generateForEnemy(enemy, `enemy-variety-v1:${enemy}`, {
    candidateCount: 6, keep: 6, refinementRounds: 0,
    analysis: { solver: { maxStates: 100, beamWidth: 12 }, counterfactualSolver: { maxStates: 40, beamWidth: 8 }, maxReasonableStates: 64 },
    onProgress: p => console.log(enemy, p),
  })
  await writeFile(`artifacts/enemy-variety-v1/${enemy}.json`, JSON.stringify(result, null, 2))
  console.log('DONE', enemy, result.acceptedCount, result.accepted.map(i => [i.candidate.seed, i.quality.total, i.analysis.bestWinDepth]))
}
