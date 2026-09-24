import { getCompletedResults } from './results.ts'
import type { DailyPuzzleDefinition, DailyResult } from './types.ts'

export type DailyHistoryEntry = {
  puzzleId: string
  date: string
  played: boolean
  status: 'unplayed' | 'in-progress' | 'won' | 'lost'
  won: boolean | null
  enemyWord: string | null
  quality: { resolveRemaining: number; startingResolve: number; fraction: number } | null
  attacks: number | null
  totalDamage: number | null
  counters: number | null
  specialTilesTriggered: number | null
}

/** Calendar/archive projection, newest day first. Unplayed days reveal no enemy. */
export function getDailyHistory(
  puzzles: readonly DailyPuzzleDefinition[],
  results: readonly DailyResult[],
  inProgressIds: readonly string[] = [],
): DailyHistoryEntry[] {
  const completed = new Map(getCompletedResults(results).map((result) => [result.puzzleId, result]))
  const inProgress = new Set(inProgressIds)
  const distinctPuzzles = new Map(puzzles.map((puzzle) => [puzzle.puzzleId, puzzle]))
  return [...distinctPuzzles.values()]
    .sort((left, right) => left.date < right.date ? 1 : left.date > right.date ? -1 : 0)
    .map((puzzle) => {
      const result = completed.get(puzzle.puzzleId)
      const played = Boolean(result) || inProgress.has(puzzle.puzzleId)
      return {
        puzzleId: puzzle.puzzleId,
        date: puzzle.date,
        played,
        status: result ? (result.won ? 'won' : 'lost') : played ? 'in-progress' : 'unplayed',
        won: result?.won ?? null,
        enemyWord: played ? puzzle.encounter.enemy.word : null,
        quality: result ? {
          resolveRemaining: result.resolveRemaining,
          startingResolve: result.startingResolve,
          fraction: result.resolveRemaining / result.startingResolve,
        } : null,
        attacks: result?.attacks ?? null,
        totalDamage: result?.totalDamage ?? null,
        counters: result?.counters ?? null,
        specialTilesTriggered: result?.specialTilesTriggered ?? null,
      }
    })
}
