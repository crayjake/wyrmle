/** A Wyrmle day is midnight-to-midnight UTC, independent of the browser timezone. */
export function getDailyPuzzleId(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) {
    throw new Error('Choose a valid date between years 0000 and 9999.')
  }
  return date.toISOString().slice(0, 10)
}

/** Reject normalized dates such as February 30, not just malformed strings. */
export function validatePuzzleId(puzzleId: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleId)) {
    throw new Error('Puzzle IDs must be real dates in YYYY-MM-DD format.')
  }
  const date = new Date(`${puzzleId}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== puzzleId) {
    throw new Error('Puzzle IDs must be real dates in YYYY-MM-DD format.')
  }
  return puzzleId
}

export function shiftPuzzleId(puzzleId: string, days: number): string {
  validatePuzzleId(puzzleId)
  if (!Number.isSafeInteger(days)) {
    throw new Error('Choose a valid puzzle date and a whole number of days.')
  }
  const date = new Date(`${puzzleId}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return getDailyPuzzleId(date)
}
