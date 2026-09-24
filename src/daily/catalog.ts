import type { Encounter } from '../game/types.ts'

/**
 * The v1 authored catalog contains one encounter, so dates currently repeat it.
 * Keep this published copy independent of prototype encounters/default rules.
 * Future catalog releases must preserve the definitions assigned to old dates.
 */
export const dailyEncounterV1: Encounter = {
  id: 'melancholy',
  enemy: {
    word: 'MELANCHOLY',
    definition: 'a feeling of pensive sadness, typically with no obvious cause',
    partOfSpeech: 'noun',
    maxHealth: 33,
    semanticRelations: {
      similar: ['SAD', 'SADNESS', 'GLOOM', 'GRIEF', 'SORROW', 'BLUE'],
      opposite: ['JOY', 'CHEER', 'HAPPY', 'DELIGHT', 'ELATED'],
      related: ['TEARS', 'CRY', 'LONELY', 'MOOD'],
    },
  },
  startingResolve: 5,
  startingTiles: [
    { id: 0, letter: 'J', type: 'normal' },
    { id: 1, letter: 'O', type: 'normal' },
    { id: 2, letter: 'Y', type: 'gem', gem: 'ward' },
    { id: 3, letter: 'C', type: 'normal' },
    { id: 4, letter: 'H', type: 'normal' },
    { id: 5, letter: 'E', type: 'gem', gem: 'power' },
    { id: 6, letter: 'E', type: 'normal' },
    { id: 7, letter: 'R', type: 'normal' },
    { id: 8, letter: 'S', type: 'normal' },
    { id: 9, letter: 'A', type: 'normal' },
    { id: 10, letter: 'D', type: 'normal' },
    { id: 11, letter: 'G', type: 'normal' },
    { id: 12, letter: 'L', type: 'normal' },
    { id: 13, letter: 'O', type: 'normal' },
    { id: 14, letter: 'O', type: 'normal' },
    { id: 15, letter: 'M', type: 'normal' },
  ],
  refillQueue: 'HAPPYEATJOYSCHEERGLADMOODJOYSCHEERGLADMOODJOYSCHEERGLADMOODJOYSCHEERGLADMOODJOYSCHEERGLADMOODJOYSCHEERGLADMOOD',
  rules: {
    minimumWordLength: 3,
    damagePerLetter: 1,
    semantic: { opposite: 5, similar: -3, related: -1, unrelated: 0, minimumDamage: 1 },
    grammar: { enabled: true, bonus: 2 },
    tileEffects: {
      ward: { bonusDamage: 0, preventResolveLoss: true },
      power: { bonusDamage: 3, preventResolveLoss: false },
    },
  },
}
