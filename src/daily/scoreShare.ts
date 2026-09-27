import { validatePuzzleId } from './date.ts'
import { winStars } from '../game/rating.ts'
import { getPublicSiteUrl, normalizePublicSiteUrl } from '../lib/publicSiteUrl.ts'

export type ShareStars = 1 | 2 | 3
export function scoreSharePath(date: string, stars: ShareStars): string {
  validatePuzzleId(date)
  if (![1, 2, 3].includes(stars)) throw new Error('Choose a valid star rating.')
  return `share/${date}/${stars}/`
}

export function scoreShareUrl(date: string, bestWords: number | null, site = getPublicSiteUrl()): string {
  validatePuzzleId(date)
  const base = normalizePublicSiteUrl(site)
  if (bestWords === null) return new URL(`?daily=${date}`, base).href
  if (!Number.isSafeInteger(bestWords) || bestWords < 1 || bestWords > 32) throw new Error('Invalid best score.')
  return new URL(scoreSharePath(date, winStars(bestWords)), base).href
}

export function challengeShareText(record: { date: string; bestWords: number | null }, site = getPublicSiteUrl()): string {
  const words = record.bestWords
  const rating = words === null ? 'Still hunting for a win'
    : `${'★'.repeat(winStars(words))}${'☆'.repeat(3 - winStars(words))} · Best: ${words} ${words === 1 ? 'word' : 'words'}`
  return [`WYRMLE ${record.date}`, rating, scoreShareUrl(record.date, words, site)].join('\n')
}

export function sharedPuzzleDate(path: string): string | null {
  const match = /\/share\/(\d{4}-\d{2}-\d{2})\/[123]\/(?:index\.html)?$/.exec(path)
  if (!match) return null
  try { return validatePuzzleId(match[1]) } catch { return null }
}
