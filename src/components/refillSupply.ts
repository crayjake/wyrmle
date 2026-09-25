import type { LetterStrikeState } from '../game/letterStrike.ts'

export type RefillGroup = { letter: string | null; count: number }

/** Counts the actual unconsumed finite reserve, without disclosing draw order. */
export function getRefillGroups(game: Pick<LetterStrikeState, 'encounter' | 'refillIndex' | 'enemyLetters'>): RefillGroup[] | null {
  if (!game.encounter.finiteRefills) return null
  const letters = [...new Set(game.enemyLetters.filter(letter => letter.hitsRemaining > 0).map(letter => letter.letter))]
  const counts = new Map(letters.map(letter => [letter, 0]))
  let other = 0
  for (const letter of game.encounter.refillQueue.slice(game.refillIndex).toUpperCase()) {
    if (counts.has(letter)) counts.set(letter, counts.get(letter)! + 1)
    else other++
  }
  return [{ letter: null, count: other }, ...letters.map(letter => ({ letter, count: counts.get(letter)! }))]
}

export function describeRefillGroups(groups: readonly RefillGroup[]): string {
  return `Refills remaining: ${groups.map(group => `${group.letter ?? 'other letters'} ${group.count}`).join(', ')}. Counts are reserve copies, not the next draw order.`
}
