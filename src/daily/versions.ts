// Bump these explicitly when rules, authored puzzle shape, or saved data change.
// Unsupported versions are reported to the player; they are never reset silently.
export const LEGACY_GAME_VERSION = 'letter-strike-1'
export const LEGACY_PUZZLE_VERSION = 1
export const GAME_VERSION_V2 = 'letter-strike-2'
export const PUZZLE_VERSION_V2 = 2
export const GAME_VERSION_V3 = 'letter-strike-3'
export const PUZZLE_VERSION_V3 = 3
export const GAME_VERSION = 'letter-strike-4'
export const PUZZLE_VERSION = 4
export const SAVE_VERSION = 5
export const GRAMMAR_RELEASE_DATE = '2026-09-25'
// Explicitly selected generated content; the existing v4 combat rules apply.
export const GENERATED_MELANCHOLY_DATE = '2026-09-24'
export const GENERATED_MELANCHOLY_PUZZLE_VERSION = 5
// Both days deliberately share the exact selected encounter.
export const GENERATED_DESPAIR_DATES: readonly string[] = ['2026-09-24', '2026-09-25']
export const GENERATED_DESPAIR_PUZZLE_VERSION = 6
