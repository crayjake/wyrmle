import type { LetterStrikeEncounter } from '../game/letterStrike.ts'

/**
 * Published letter-strike v1 catalog. Its one authored encounter repeats by
 * date; keep historical definitions independent of mutable prototype defaults.
 */
export const dailyEncounterV1: LetterStrikeEncounter = {
  id: 'daily-melancholy-letter-strike-v1',
  enemy: {
    word: 'MELANCHOLY',
    definition: 'a feeling of pensive sadness, typically with no obvious cause',
    partOfSpeech: 'noun',
    semanticRelations: {
      opposite: ['JOY', 'CHEER', 'HAPPY', 'DELIGHT', 'ELATED', 'MERRY'],
      similar: ['SAD', 'SADNESS', 'GLOOM', 'GRIEF', 'SORROW', 'BLUE'],
      related: ['TEARS', 'CRY', 'LONELY', 'MOOD'],
    },
  },
  enemyLetters: [
    { id: 'enemy-0', letter: 'M', hitsRemaining: 2, initialHits: 2 },
    { id: 'enemy-1', letter: 'E', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-2', letter: 'L', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-3', letter: 'A', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-4', letter: 'N', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-5', letter: 'C', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-6', letter: 'H', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-7', letter: 'O', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-8', letter: 'L', hitsRemaining: 1, initialHits: 1 },
    { id: 'enemy-9', letter: 'Y', hitsRemaining: 2, initialHits: 2 },
  ],
  startingResolve: 5,
  startingTiles: [
    { id: 0, letter: 'J', type: 'normal' },
    { id: 1, letter: 'O', type: 'normal' },
    { id: 2, letter: 'Y', type: 'gem', gem: 'ward' },
    { id: 3, letter: 'C', type: 'normal' },
    { id: 4, letter: 'H', type: 'normal' },
    { id: 5, letter: 'E', type: 'normal' },
    { id: 6, letter: 'E', type: 'normal' },
    { id: 7, letter: 'R', type: 'normal' },
    { id: 8, letter: 'G', type: 'normal' },
    { id: 9, letter: 'L', type: 'gem', gem: 'strike' },
    { id: 10, letter: 'O', type: 'normal' },
    { id: 11, letter: 'O', type: 'normal' },
    { id: 12, letter: 'M', type: 'normal' },
    { id: 13, letter: 'A', type: 'normal' },
    { id: 14, letter: 'D', type: 'normal' },
    { id: 15, letter: 'S', type: 'normal' },
  ],
  refillQueue: 'RYERELATMENDNJOYSADMERRYDELIGHTELATEDNEONSADGLOOMJOYMERRYDELIGHTELATEDNEONSADGLOOMJOYMERRYDELIGHTELATEDNEONSADGLOOMJOYMERRYDELIGHTELATEDNEONSADGLOOMJOY',
  minimumWordLength: 3,
  // Historical v1/v2 rules let a Strike tile consume the normal allowance.
  strikeConsumesAllowance: true,
  tileEffects: {
    strike: { strike: true, preventResolveLoss: false },
    ward: { strike: false, preventResolveLoss: true },
  },
}

/** Release v2 changes only the encounter-defined adjective weakness. */
export const dailyEncounterV2: LetterStrikeEncounter = {
  ...structuredClone(dailyEncounterV1),
  id: 'daily-melancholy-letter-strike-v2',
  grammarModifiers: { adjective: 1 },
}

/** New attempts use additive Strike effects without changing the dated board. */
export const dailyEncounterV3: LetterStrikeEncounter = {
  ...structuredClone(dailyEncounterV2),
  id: 'daily-melancholy-letter-strike-v3',
  strikeConsumesAllowance: false,
}
