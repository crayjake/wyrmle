import { dailyEncounterV1, dailyEncounterV2, dailyEncounterV3, dailyEncounterV4 } from './catalog.ts'
import { validatePuzzleId } from './date.ts'
import type { DailyPuzzleDefinition } from './types.ts'
import {
  GAME_VERSION, GAME_VERSION_V2, GAME_VERSION_V3, GRAMMAR_RELEASE_DATE, LEGACY_GAME_VERSION,
  LEGACY_PUZZLE_VERSION, PUZZLE_VERSION, PUZZLE_VERSION_V2, PUZZLE_VERSION_V3,
} from './versions.ts'

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

// Freeze the catalog itself, including rules, semantic lists and tile identities.
deepFreeze(dailyEncounterV1)
deepFreeze(dailyEncounterV2)
deepFreeze(dailyEncounterV3)
deepFreeze(dailyEncounterV4)

/** Old rules remain available only for dates on which those rules were published. */
export function getSupportedDailyPuzzles(puzzleId: string): DailyPuzzleDefinition[] {
  validatePuzzleId(puzzleId)
  const definitions = puzzleId < GRAMMAR_RELEASE_DATE ? [{
    gameVersion: LEGACY_GAME_VERSION, puzzleVersion: LEGACY_PUZZLE_VERSION, encounter: dailyEncounterV1,
  }] : [{
    gameVersion: GAME_VERSION_V2, puzzleVersion: PUZZLE_VERSION_V2, encounter: dailyEncounterV2,
  }, {
    gameVersion: GAME_VERSION_V3, puzzleVersion: PUZZLE_VERSION_V3, encounter: dailyEncounterV3,
  }, {
    gameVersion: GAME_VERSION, puzzleVersion: PUZZLE_VERSION, encounter: dailyEncounterV4,
  }]
  return definitions.map((definition) => deepFreeze({ puzzleId, date: puzzleId, ...definition }))
}

/** Latest rules for a new attempt; committed saves are resolved by their version. */
export function getDailyPuzzle(puzzleId: string): DailyPuzzleDefinition {
  return getSupportedDailyPuzzles(puzzleId).at(-1)!
}

export function getDailyPuzzleForVersion(
  puzzleId: string, gameVersion: string, puzzleVersion: number,
): DailyPuzzleDefinition {
  const puzzle = getSupportedDailyPuzzles(puzzleId).find((definition) => (
    definition.gameVersion === gameVersion && definition.puzzleVersion === puzzleVersion
  ))
  if (!puzzle) throw new Error(`This save uses an unsupported game or puzzle version for ${puzzleId}.`)
  return puzzle
}
