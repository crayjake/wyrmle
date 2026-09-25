import { writeFile } from 'node:fs/promises'
import { dailyEncounterV1, dailyEncounterV2, dailyEncounterV3, dailyEncounterV4,
  dailyEncounter20260924, dailyEncounter20260924V6, dailyEncounter20260924V7,
  dailyEncounter20260925V8, dailyEncounter20260925V9, dailyEncounter20260925V10 } from '../src/daily/catalog.ts'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { difficultyFromAnalysis } from '../src/generator/difficulty.ts'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Offline only: public puzzles contain a label, never solution lengths or paths.
const encounters = [dailyEncounterV1, dailyEncounterV2, dailyEncounterV3, dailyEncounterV4,
  dailyEncounter20260924, dailyEncounter20260924V6, dailyEncounter20260924V7, dailyEncounter20260925V8, dailyEncounter20260925V9, dailyEncounter20260925V10]
const reports: Record<string, ReturnType<typeof difficultyFromAnalysis>> = {}
const labels: Record<string, string> = {}
const historicalRoute = [[0, 1, 2], [12, 5, 7, 16, 17], [3, 4, 6, 18, 19],
  [20, 21, 13, 23, 25, 14], [24, 10, 9, 27], [26, 22, 8]]
const authoredRoute = [[0, 1, 2], [4, 5, 15, 18, 16], [11, 20, 9, 10, 14, 17],
  [8, 21, 22, 27], [24, 30, 33, 26, 25, 19]]
const generatedMelancholyRoute = [[6, 8, 13, 1, 5], [20, 18, 0, 4, 11], [23, 7, 14],
  [28, 9, 24, 2, 27, 16, 15], [34, 32, 26, 35], [29, 17, 12, 22, 10, 36, 31, 39]]
const proof = JSON.parse(await readFile(new URL('../src/generator/data/daily-depth-proof.json', import.meta.url), 'utf8'))
const reviveWalkthroughs = JSON.parse(await readFile(new URL('../artifacts/revive-lexical-v2/anger/selected-walkthroughs.json', import.meta.url), 'utf8')) as {
  routes: { tileIds: number[][] }[]
}
const finiteWalkthroughs = JSON.parse(await readFile(new URL('../artifacts/finite-refills-v1/selected-walkthroughs.json', import.meta.url), 'utf8')) as {
  routes: { tileIds: number[][] }[]
}
const meaningWalkthroughs = JSON.parse(await readFile(new URL('../artifacts/meaning-v1/walkthroughs.json', import.meta.url), 'utf8')) as {
  routes: { tileIds: number[][] }[]
}
for (const encounter of encounters) {
  const analysis = analysePuzzle(encounter, {
    solver: { maxStates: 180, beamWidth: 16, hintLine: encounter === dailyEncounterV4 ? authoredRoute
      : encounter === dailyEncounter20260924 ? generatedMelancholyRoute : historicalRoute,
      ...(encounter === dailyEncounter20260924V6 || encounter === dailyEncounter20260924V7 ? { hintLine: [
        [1, 14, 9, 13, 15, 7], [18, 11, 20, 21], [5, 25, 0, 10, 22, 4],
      ] } : {}),
      ...(encounter === dailyEncounter20260925V8 ? { hintLine: undefined,
        hintLines: reviveWalkthroughs.routes.map(route => route.tileIds) } : {}),
      ...(encounter === dailyEncounter20260925V9 ? { hintLine: undefined,
        hintLines: finiteWalkthroughs.routes.map(route => route.tileIds) } : {}),
      ...(encounter === dailyEncounter20260925V10 ? { hintLine: undefined,
        hintLines: meaningWalkthroughs.routes.map(route => route.tileIds) } : {}),
    },
    counterfactualSolver: { maxStates: 40, beamWidth: 8 },
  })
  if (proof.encounterHash === createHash('sha256').update(JSON.stringify(encounter)).digest('hex')) {
    if (analysis.bestWinDepth !== proof.provenMinimumWords) throw new Error('Minimum-depth proof and winning witness disagree.')
    analysis.minimumTurnsToWin = proof.provenMinimumWords
    analysis.minimumTurnsProven = true
  }
  if (analysis.bestWinDepth === null) throw new Error(`No verified route for ${encounter.id}; existing ratings preserved.`)
  const rating = difficultyFromAnalysis(encounter, analysis)
  reports[encounter.id] = rating
  labels[encounter.id] = rating.label
  console.log(`${encounter.id}: ${rating.label} (${rating.score}, ${rating.estimated ? 'bounded estimate' : 'proved minimum'})`)
}
await writeFile(new URL('../src/generator/data/daily-difficulty.json', import.meta.url), JSON.stringify(reports, null, 2) + '\n')
await writeFile(new URL('../src/daily/difficultyLabels.json', import.meta.url), JSON.stringify(labels, null, 2) + '\n')
