import { dailyEncounterV1 } from './catalog.ts'
import { validatePuzzleId } from './date.ts'
import type { DailyPuzzleDefinition } from './types.ts'
import { GAME_VERSION, PUZZLE_VERSION } from './versions.ts'

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

// Freeze the catalog itself, including rules, semantic lists and tile identities.
deepFreeze(dailyEncounterV1)

export function getDailyPuzzle(puzzleId: string): DailyPuzzleDefinition {
  validatePuzzleId(puzzleId)
  return deepFreeze({
    puzzleId,
    date: puzzleId,
    gameVersion: GAME_VERSION,
    puzzleVersion: PUZZLE_VERSION,
    encounter: dailyEncounterV1,
  })
}
