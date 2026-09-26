import { archivedPuzzles, puzzleSchedule } from './scheduledPuzzle.ts'

export function availableMonths(today: string) {
  return [...new Set(puzzleSchedule.filter(entry => entry.date <= today).map(entry => entry.date.slice(0, 7)))]
}

/** Monday-first cells, including empty leading/trailing slots. */
export function calendarDays(month: string): (string | null)[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  const first = new Date(`${month}-01T00:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(0)
  const count = next.getUTCDate()
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) =>
    index < offset || index >= offset + count ? null : `${month}-${String(index - offset + 1).padStart(2, '0')}`)
}

/** Old shared preview links lead to their archived date or to the calendar. */
export function puzzleLocation(search: string) {
  const params = new URLSearchParams(search)
  const preview = params.get('preview')
  if (preview === 'bingo' || preview === 'bingos' || preview?.startsWith('bingo-')) {
    const entry = archivedPuzzles.find(entry => entry.legacyBetaId === preview)
    return { date: entry?.date ?? null, calendar: !entry, month: null,
      replacement: entry ? `?daily=${entry.date}` : '?calendar' }
  }
  return { date: params.get('daily'), calendar: params.has('calendar'), month: params.get('calendar'), replacement: null }
}
