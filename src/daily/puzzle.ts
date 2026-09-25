import {
  dailyEncounterV1, dailyEncounterV2, dailyEncounterV3, dailyEncounterV4,
  dailyEncounter20260924, dailyEncounter20260924V6, dailyEncounter20260924V7, dailyEncounter20260925V8, dailyEncounter20260925V9,
} from './catalog.ts'
import { validatePuzzleId } from './date.ts'
import difficultyLabels from './difficultyLabels.json' with { type: 'json' }
import type { PuzzleDifficultyLabel } from '../generator/difficulty.ts'
import type { DailyPuzzleDefinition } from './types.ts'
import {
  GAME_VERSION, GAME_VERSION_V2, GAME_VERSION_V3, GRAMMAR_RELEASE_DATE, LEGACY_GAME_VERSION,
  LEGACY_PUZZLE_VERSION, PUZZLE_VERSION, PUZZLE_VERSION_V2, PUZZLE_VERSION_V3,
  GENERATED_MELANCHOLY_DATE, GENERATED_MELANCHOLY_PUZZLE_VERSION,
  GENERATED_DESPAIR_DATES, GENERATED_DESPAIR_PUZZLE_VERSION,
  LEXICAL_GAME_VERSION, LEXICAL_DESPAIR_PUZZLE_VERSION,
  GENERATED_REVIVE_DATE, GENERATED_REVIVE_PUZZLE_VERSION,
  FINITE_REFILL_GAME_VERSION, FINITE_REFILL_PUZZLE_VERSION,
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
deepFreeze(dailyEncounter20260924)
deepFreeze(dailyEncounter20260924V6)
deepFreeze(dailyEncounter20260924V7)
deepFreeze(dailyEncounter20260925V8)
deepFreeze(dailyEncounter20260925V9)

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
  // A replacement gets its own version. Existing committed attempts keep the
  // historical definition, while new/untouched attempts get the selected board.
  if (puzzleId === GENERATED_MELANCHOLY_DATE) definitions.push({
    gameVersion: GAME_VERSION, puzzleVersion: GENERATED_MELANCHOLY_PUZZLE_VERSION,
    encounter: dailyEncounter20260924,
  })
  if (GENERATED_DESPAIR_DATES.includes(puzzleId)) definitions.push({
    gameVersion: GAME_VERSION, puzzleVersion: GENERATED_DESPAIR_PUZZLE_VERSION,
    encounter: dailyEncounter20260924V6,
  })
  if (GENERATED_DESPAIR_DATES.includes(puzzleId)) definitions.push({
    gameVersion: LEXICAL_GAME_VERSION, puzzleVersion: LEXICAL_DESPAIR_PUZZLE_VERSION,
    encounter: dailyEncounter20260924V7,
  })
  if (puzzleId === GENERATED_REVIVE_DATE) definitions.push({
    gameVersion: LEXICAL_GAME_VERSION, puzzleVersion: GENERATED_REVIVE_PUZZLE_VERSION,
    encounter: dailyEncounter20260925V8,
  })
  if (puzzleId === GENERATED_REVIVE_DATE) definitions.push({
    gameVersion: FINITE_REFILL_GAME_VERSION, puzzleVersion: FINITE_REFILL_PUZZLE_VERSION,
    encounter: dailyEncounter20260925V9,
  })
  return definitions.map((definition) => deepFreeze({ puzzleId, date: puzzleId, ...definition,
    difficulty: (difficultyLabels as Record<string, PuzzleDifficultyLabel>)[definition.encounter.id],
  }))
}

/** Latest publication for a new attempt; committed saves resolve their own version. */
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
