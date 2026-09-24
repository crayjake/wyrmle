import { validatePuzzleId } from './date.ts'
import { getCompletedResults } from './results.ts'
import type { DailyResult } from './types.ts'

export type PlayerStats = {
  gamesPlayed: number
  wins: number
  /** Percentage from 0 to 100; consumers choose display rounding. */
  winRate: number
  currentStreak: number
  longestStreak: number
  averageResolveOnWins: number
  averageResolveRemaining: number
  averageWordLength: number
  longestWord: string | null
  totalCounters: number
  totalNeutral: number
  totalResisted: number
  totalLettersDestroyed: number
  totalStrikes: number
  totalArmourBroken: number
  totalStrikeActivations: number
  totalWardSaves: number
  uniqueEnemyDefeats: number
  bestResolveRemaining: number
  largestSingleTurnStrikes: number
}

const millisecondsPerDay = 86_400_000

function dayNumber(id: string): number {
  validatePuzzleId(id)
  return new Date(`${id}T00:00:00.000Z`).getTime() / millisecondsPerDay
}

/**
 * All aggregates are derived from first completions, never stored separately.
 * Future development dates are excluded from every aggregate. A current streak
 * may end yesterday while today is unplayed; today's loss, any prior loss, and
 * any missing intervening UTC day break it. Longest streak uses calendar days,
 * rather than adjacent entries in the history array.
 */
export function calculateStats(results: readonly DailyResult[], todayId: string): PlayerStats {
  const today = dayNumber(todayId)
  const completed = getCompletedResults(results).filter((result) => dayNumber(result.date) <= today)
  const wins = completed.filter((result) => result.won)
  const words = completed.flatMap((result) => result.wordsPlayed)
  const byDay = new Map(completed.map((result) => [dayNumber(result.date), result]))

  let currentStreak = 0
  let currentDay = byDay.has(today) ? today : today - 1
  while (byDay.get(currentDay)?.won) {
    currentStreak += 1
    currentDay -= 1
  }

  let longestStreak = 0
  let consecutiveWins = 0
  let previousWinDay: number | null = null
  for (const result of completed) {
    const day = dayNumber(result.date)
    if (!result.won) {
      consecutiveWins = 0
      previousWinDay = null
      continue
    }
    consecutiveWins = previousWinDay !== null && day === previousWinDay + 1 ? consecutiveWins + 1 : 1
    previousWinDay = day
    longestStreak = Math.max(longestStreak, consecutiveWins)
  }

  let longestWord: string | null = null
  for (const word of words) {
    // Equal-length words keep the first chronological submission.
    if (longestWord === null || word.length > longestWord.length) longestWord = word
  }
  return {
    gamesPlayed: completed.length,
    wins: wins.length,
    winRate: completed.length ? wins.length / completed.length * 100 : 0,
    currentStreak,
    longestStreak,
    averageResolveOnWins: wins.length
      ? wins.reduce((sum, result) => sum + result.resolveRemaining, 0) / wins.length : 0,
    averageResolveRemaining: completed.length
      ? completed.reduce((sum, result) => sum + result.resolveRemaining, 0) / completed.length : 0,
    averageWordLength: words.length
      ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0,
    longestWord,
    totalCounters: completed.reduce((sum, result) => sum + result.counters, 0),
    totalNeutral: completed.reduce((sum, result) => sum + result.neutral, 0),
    totalResisted: completed.reduce((sum, result) => sum + result.resisted, 0),
    totalLettersDestroyed: completed.reduce((sum, result) => sum + result.lettersDestroyed, 0),
    totalStrikes: completed.reduce((sum, result) => sum + result.totalStrikes, 0),
    totalArmourBroken: completed.reduce((sum, result) => sum + result.armourBroken, 0),
    totalStrikeActivations: completed.reduce((sum, result) => sum + result.strikeActivations, 0),
    totalWardSaves: completed.reduce((sum, result) => sum + result.wardSaves, 0),
    uniqueEnemyDefeats: new Set(wins.map((result) => result.enemyWord.trim().toUpperCase())).size,
    bestResolveRemaining: completed.reduce((best, result) => Math.max(best, result.resolveRemaining), 0),
    largestSingleTurnStrikes: completed.reduce((largest, result) => Math.max(largest, result.strongestHit), 0),
  }
}
