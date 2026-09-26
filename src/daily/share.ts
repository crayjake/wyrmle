import type { DailyResult } from './types.ts'
import { getPublicSiteUrl } from '../lib/publicSiteUrl.ts'

/** Equal-width emoji cells show the enemy after each word, from saved evidence. */
export function buildShareRows(result: DailyResult): string[] {
  const maximumHits: number[] = []
  return result.turns.map((turn) => {
    if (turn.letterOutcomes.length !== result.enemyLetterCount
      || turn.letterOutcomes.some((outcome, position) => outcome.position !== position)) {
      throw new Error('Share rows require an outcome for every original enemy position.')
    }
    return turn.letterOutcomes.map((outcome, position) => {
      maximumHits[position] = Math.max(maximumHits[position] ?? 0, outcome.hitsBefore, outcome.hitsAfter)
      if (outcome.regenerated) return '🟥'
      if (outcome.hitsAfter === 0) return '🟩'
      if (outcome.hitsAfter < maximumHits[position]) return '🟨'
      return '⬜'
    }).join('')
  })
}

export function buildShareText(result: DailyResult): string {
  return [
    `WYRMLE ${result.date} · ${result.mode.toUpperCase()}`,
    `${result.won ? 'Won in' : 'Lost after'} ${result.attacks} ${result.attacks === 1 ? 'word' : 'words'}`,
    '',
    ...buildShareRows(result),
    '',
    `${result.resolveRemaining}/${result.startingResolve} lives · ${result.undosUsed} ${result.undosUsed === 1 ? 'undo' : 'undos'}`,
    getPublicSiteUrl(),
  ].join('\n')
}
