import { shiftPuzzleId } from './date.ts'
import type { ChallengeRecord } from './challengeProgress.ts'

/** Archives earn stars, but only a win recorded on its own date earns a streak day. */
export function winStreak(records: readonly ChallengeRecord[], today: string) {
  const dates = [...new Set(records.filter(record => record.bestWords !== null
    && record.wonOn === record.date && record.date <= today).map(record => record.date))].sort()
  let longest = 0, run = 0, previous: string | undefined
  for (const date of dates) {
    run = previous && shiftPuzzleId(previous, 1) === date ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = date
  }
  const wins = new Set(dates)
  let cursor = wins.has(today) ? today : shiftPuzzleId(today, -1), current = 0
  while (wins.has(cursor)) { current++; cursor = shiftPuzzleId(cursor, -1) }
  if (!wins.has(today) && records.some(record => record.date === today && record.bestWords === null && record.run.status === 'lost')) current = 0
  return { current, longest, wonToday: wins.has(today) }
}
