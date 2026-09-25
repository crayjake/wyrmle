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
  const { encounter, ...position } = game
  // Published encounters are deeply frozen, shared definitions. Cloning their
  // complete word meanings for every move wastes megabytes and invalidates
  // identity-based lookup caches. Only the changing position needs a copy.
  let immutableEncounter = encounter
  if (!Object.isFrozen(encounter)) {
    const { meaningLexicon, ...rules } = encounter
    immutableEncounter = freeze({ ...structuredClone(rules), ...(meaningLexicon ? {
      meaningLexicon: Object.isFrozen(meaningLexicon) ? meaningLexicon : freeze(structuredClone(meaningLexicon)),
    } : {}) })
  }
  return freeze({ ...structuredClone({ ...position, selectedTileIds: [], error: null }), encounter: immutableEncounter })
}

/** Restore a snapshot directly. No damage, recovery, refill or grammar reversal. */
export function restoreUndoSnapshot(snapshot: LetterStrikeState): LetterStrikeState {
  return captureUndoSnapshot(snapshot)
}
