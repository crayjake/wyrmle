import { createLetterStrikeGame } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'

// Keep mechanical regressions on a named board while the authored prototype
// changes. This is the original board with independent Strike and grammar.
export const historicalBoardEncounter: LetterStrikeEncounter = {
  id: 'test-original-letter-strike-board',
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
  enemyLetters: [...'MELANCHOLY'].map((letter, index) => {
    const initialHits = index === 0 || letter === 'Y' ? 2 : 1
    return { id: `enemy-${index}`, letter, initialHits, hitsRemaining: initialHits }
  }),
  startingResolve: 5,
  startingTiles: [...'JOYCHEERGLOOMADS'].map((letter, id) => ({
    id, letter, type: id === 2 || id === 9 ? 'gem' : 'normal',
    ...(id === 2 ? { gem: 'ward' as const } : id === 9 ? { gem: 'strike' as const } : {}),
  })),
  refillQueue: 'RYE' + 'RELAT' + 'MENDN' + 'JOYSAD' + 'MERRYDELIGHTELATEDNEONSADGLOOMJOY'.repeat(4),
  minimumWordLength: 3,
  grammarModifiers: { adjective: 1 },
  tileEffects: {
    strike: { strike: true, preventResolveLoss: false },
    ward: { strike: false, preventResolveLoss: true },
  },
}

export function createHistoricalBoardGame(encounter = historicalBoardEncounter) {
  return createLetterStrikeGame(encounter)
}
