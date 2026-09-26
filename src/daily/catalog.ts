import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import generatedMelancholy20260924 from './puzzles/2026-09-24.json' with { type: 'json' }
import generatedDespair20260924 from './puzzles/2026-09-24-v6.json' with { type: 'json' }
import lexicalDespair20260924 from './puzzles/2026-09-24-v7.json' with { type: 'json' }
import reviveAnger20260925 from './puzzles/2026-09-25-v8.json' with { type: 'json' }
import finiteAnger20260925 from './puzzles/2026-09-25-v9.json' with { type: 'json' }
import meaningChaos20260925 from './puzzles/2026-09-25-v10.json' with { type: 'json' }
import coveredMeaningChaos20260925 from './puzzles/2026-09-25-v11.json' with { type: 'json' }
import assessedMeaningChaos20260926 from './puzzles/2026-09-26-v12.json' with { type: 'json' }
import correctedMeaningChaos20260926 from './puzzles/2026-09-26-v13.json' with { type: 'json' }
import { unpackMeaningLexicon } from '../game/meaningPacking.ts'
import { unpackMeaningRevision } from '../game/meaningRevision.ts'

// Frozen publication snapshot, independent of future generator rankings. Only
// runtime encounter data belongs here; solutions and analysis stay in DEV.
export const dailyEncounter20260924 = generatedMelancholy20260924 as LetterStrikeEncounter
// The Sep 24 and Sep 25 publications share this exact frozen encounter.
export const dailyEncounter20260924V6 = generatedDespair20260924 as LetterStrikeEncounter
// Same board and refill; versioned broad word classification for fresh attempts.
export const dailyEncounter20260924V7 = lexicalDespair20260924 as LetterStrikeEncounter
export const dailyEncounter20260925V8 = reviveAnger20260925 as LetterStrikeEncounter
export const dailyEncounter20260925V9 = finiteAnger20260925 as LetterStrikeEncounter
const { packedMeanings, ...meaningRules } = meaningChaos20260925
export const dailyEncounter20260925V10 = { ...meaningRules,
  meaningLexicon: unpackMeaningLexicon(packedMeanings),
} as LetterStrikeEncounter
const { meaningBase, packedMeanings: coveredPackedMeanings, ...coveredMeaningRules } = coveredMeaningChaos20260925 as unknown as
  LetterStrikeEncounter & { meaningBase?: string; packedMeanings: unknown }
export const dailyEncounter20260925V11 = { ...coveredMeaningRules,
  meaningLexicon: meaningBase === undefined ? unpackMeaningLexicon(coveredPackedMeanings)
    : unpackMeaningRevision(dailyEncounter20260925V10, meaningBase, coveredPackedMeanings),
} as LetterStrikeEncounter
const { packedMeanings: assessedPackedMeanings, ...assessedMeaningRules } = assessedMeaningChaos20260926
export const dailyEncounter20260926V12 = { ...assessedMeaningRules,
  meaningLexicon: unpackMeaningLexicon(assessedPackedMeanings),
} as LetterStrikeEncounter
const { packedMeanings: correctedPackedMeanings, ...correctedMeaningRules } = correctedMeaningChaos20260926
export const dailyEncounter20260926V13 = { ...correctedMeaningRules,
  meaningLexicon: unpackMeaningLexicon(correctedPackedMeanings),
} as LetterStrikeEncounter

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

/** Release v4 introduces the authored long-word board and opt-in neutral bonus. */
export const dailyEncounterV4: LetterStrikeEncounter = {
  ...structuredClone(dailyEncounterV3),
  id: 'daily-melancholy-letter-strike-v4',
  enemy: {
    ...structuredClone(dailyEncounterV3.enemy),
    semanticRelations: {
      opposite: ['JOY', 'CHEER', 'GLAD', 'GAY', 'HAPPY', 'DELIGHT', 'ELATED', 'MERRY'],
      similar: ['SAD', 'SADNESS', 'GLOOM', 'GLOOMY', 'GRIEF', 'SORROW', 'BLUE'],
      related: ['TEARS', 'CRY', 'LONELY', 'MOOD'],
    },
  },
  startingTiles: [
    { id: 0, letter: 'J', type: 'normal' },
    { id: 1, letter: 'O', type: 'normal' },
    { id: 2, letter: 'Y', type: 'normal' },
    { id: 3, letter: 'T', type: 'normal' },
    { id: 4, letter: 'C', type: 'normal' },
    { id: 5, letter: 'H', type: 'normal' },
    { id: 6, letter: 'E', type: 'normal' },
    { id: 7, letter: 'R', type: 'normal' },
    { id: 8, letter: 'G', type: 'normal' },
    { id: 9, letter: 'L', type: 'gem', gem: 'strike' },
    { id: 10, letter: 'O', type: 'normal' },
    { id: 11, letter: 'M', type: 'normal' },
    { id: 12, letter: 'S', type: 'normal' },
    { id: 13, letter: 'A', type: 'normal' },
    { id: 14, letter: 'D', type: 'normal' },
    { id: 15, letter: 'E', type: 'gem', gem: 'ward' },
  ],
  refillQueue: 'RYERELATMENDNJOYSADPPYMERRYDELIGHTLEMONSCLOSETTHREADHAPPYNEARELATEDSADGLOOMMERRYLEMONSTHREADCLOSETNEARJOY',
  longWordRule: { minimumLength: 6, bonusStrikes: 1 },
  wordPartsOfSpeech: {
    SAD: ['adjective'],
    GLAD: ['adjective'],
    GLOOM: ['noun'],
    JOY: ['noun'],
    CHEER: ['noun', 'verb'],
    CLOSET: ['noun'],
    THREAD: ['noun', 'verb'],
    SANDY: ['adjective'],
    GAY: ['adjective'],
    GLOOMY: ['adjective'],
    COMELY: ['adjective'],
    HOMELY: ['adjective'],
    STEADY: ['adjective'],
    STORMY: ['adjective'],
    DREAMY: ['adjective'],
    HEARTY: ['adjective'],
    LOAMY: ['adjective'],
    MERRY: ['adjective'],
  },
}
