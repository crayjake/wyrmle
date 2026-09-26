import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import { selectWordIds } from './constructRefill.ts'
import { findPlayableWords } from './findMoves.ts'
import { getGenerationWordCommonness } from './familiarity.ts'
import { solvePuzzle } from './solve.ts'
import type { SolverOptions } from './solve.ts'

/** Counter-first search can overlook the Hit tile's purpose: making resisted
 * or ordinary words useful. Probe one familiar opening of each kind, then give
 * the main solver only actual winning continuations, which it replays again.
 */
export function findSpecialOpeningHints(encounter: LetterStrikeEncounter, options: SolverOptions = {}) {
  const hints: number[][][] = []
  let statesExplored = 0
  if ((options.maxStates ?? 160) < 20) return { hints, statesExplored }
  const initial = createLetterStrikeGame(encounter)
  const commonness = options.wordCommonness ?? (word => getGenerationWordCommonness(word) ?? 0)
  const candidates = findPlayableWords(initial, options.vocabulary).filter(word => commonness(word) >= 0.5)
    .map(word => {
      const tileIds = selectWordIds(initial.tiles, word)!
      return { word, tileIds, preview: previewLetterStrike(initial, tileIds) }
    }).filter(move => move.preview.valid && move.preview.effectLabels.includes('STRIKE')
      && move.preview.strikes > (move.preview.recoveries?.length ?? 0))
    .sort((a, b) => commonness(b.word) - commonness(a.word) || a.word.localeCompare(b.word))
  for (const label of ['RESISTED', 'NEUTRAL'] as const) {
    const move = candidates.find(move => move.preview.semanticLabel === label)
    if (!move) continue
    const successor = submitLetterStrike(initial, move.tileIds)
    const result = solvePuzzle(successor, { ...options, hintLine: undefined, hintLines: undefined,
      maxStates: Math.min(options.maxStates ?? 40, 40), beamWidth: Math.min(options.beamWidth ?? 12, 12), maxWinningLines: 1,
      ...(options.maxDepth === undefined ? {} : { maxDepth: Math.max(0, options.maxDepth - 1) }),
      wordCommonness: commonness })
    statesExplored += result.statesExplored
    for (const line of result.winningLines) hints.push([move.tileIds, ...line.moves.map(step => step.tileIds)])
  }
  return { hints, statesExplored }
}
