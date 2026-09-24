export type MatchHintMode = 'off' | 'dot' | 'underline'

/** Presentation only: this says nothing about the selected word's allowance. */
export function getMatchingTileIds(
  tiles: readonly { id: number; letter: string }[],
  enemyLetters: readonly { letter: string; hitsRemaining: number }[],
): number[] {
  const livingLetters = new Set(enemyLetters.filter(letter => letter.hitsRemaining > 0)
    .map(letter => letter.letter.toUpperCase()))
  return tiles.filter(tile => livingLetters.has(tile.letter.toUpperCase())).map(tile => tile.id)
}
