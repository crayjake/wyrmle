import type { LetterStrikeState } from '../game/letterStrike.ts'

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/** Preserve the entire committed state; a half-selected word is transient UI. */
export function captureUndoSnapshot(game: LetterStrikeState): LetterStrikeState {
  return freeze(structuredClone({ ...game, selectedTileIds: [], error: null }))
}

/** Restore a snapshot directly. No damage, recovery, refill or grammar reversal. */
export function restoreUndoSnapshot(snapshot: LetterStrikeState): LetterStrikeState {
  return captureUndoSnapshot(snapshot)
}
