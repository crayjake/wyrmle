import type { LetterStrikeState } from '../game/letterStrike.ts'

/** Clues follow actual spare removal, never spent lives or an old hint-menu save. */
export function progressiveHint(
  game: Pick<LetterStrikeState, 'status' | 'playedWords'>,
  hints: readonly string[] | undefined,
  easy: boolean,
  resolvedTurns = game.playedWords.length,
): string | null {
  if (!easy || !hints || game.status !== 'playing') return null
  const helpers = game.playedWords.slice(0, resolvedTurns)
    .filter(move => (move.preview.bingoHunt?.removedTileIds.length ?? 0) > 0).length
  return helpers ? hints[Math.min(helpers, 2) - 1] ?? null : null
}
