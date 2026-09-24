import type { DifficultyMode } from './types.ts'

/** Modes change information and forgiveness; combat never reads this table. */
export const MODE_UNDO_LIMITS: Readonly<Record<DifficultyMode, number>> = Object.freeze({
  normal: 3,
  hard: 1,
  hardcore: 0,
})

export function undoLimit(mode: DifficultyMode): number {
  return MODE_UNDO_LIMITS[mode]
}
