import { defaultRules } from './rules.ts'
import type { Encounter, Tile } from './types.ts'

export const melancholyEncounter: Encounter = {
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
  startingTiles: [...'JOYC HEER SADG LOOM'.replaceAll(' ', '')].map((letter, id): Tile => {
    if (id === 2) return { id, letter, type: 'gem', gem: 'ward' }
    if (id === 5) return { id, letter, type: 'gem', gem: 'power' }
    return { id, letter, type: 'normal' }
  }),
  // JOY then CHEER refill HAP + PYEAT, opening HAPPY as one possible win.
  // 104 fixed letters cover all six possible attacks, even at 16 tiles each.
  refillQueue: 'HAPPYEAT' + 'JOYSCHEERGLADMOOD'.repeat(6),
  rules: defaultRules,
}
