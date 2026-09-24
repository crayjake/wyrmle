import {
  clearLetterStrikeSelection,
  createLetterStrikeGame,
  previewLetterStrike,
  submitLetterStrike,
  toggleLetterStrikeTile,
} from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'

// A self-contained teaching encounter. The ordinary engine still owns every
// preview, strike, refill and Resolve change; this module only gates the lesson.
export const tutorialEncounter: LetterStrikeEncounter = {
  id: 'tutorial-cold-2',
  enemy: {
    word: 'COLD',
    definition: 'having a low temperature',
    partOfSpeech: 'adjective',
    semanticRelations: {
      opposite: ['HOT', 'WARM'],
      similar: ['ICE', 'ICY', 'FROST'],
      related: [],
    },
  },
  enemyLetters: [...'COLD'].map((letter, index) => ({
    id: `tutorial-enemy-${index}`,
    letter,
    initialHits: letter === 'C' || letter === 'D' ? 2 : 1,
    hitsRemaining: letter === 'C' || letter === 'D' ? 2 : 1,
  })),
  startingResolve: 5,
  startingTiles: [...'HOTW ICEA RMLD ADUF'.replaceAll(' ', '')].map((letter, id) => ({
    id,
    letter,
    type: id === 5 || id === 7 ? 'gem' : 'normal',
    ...(id === 5 ? { gem: 'strike' as const } : id === 7 ? { gem: 'ward' as const } : {}),
  })),
  // HOT supplies DIG; ICE supplies an ordinary C for the ICY grammar lesson.
  // ICY then leaves I/G for DIG and O for DUO. Replacements follow board order,
  // and every accepted choice of duplicate letters preserves the later words.
  refillQueue: 'DIG' + 'ICY' + 'IOG' + 'LAD' + 'DUG' + 'HOTWARMICELADDUO'.repeat(6),
  minimumWordLength: 3,
  grammarModifiers: { adjective: 1 },
  wordPartsOfSpeech: {
    HOT: ['adjective'], WARM: ['adjective'], ICE: ['noun'], ICY: ['adjective'],
    LAD: ['noun'], DIG: ['verb'], DUO: ['noun'],
  },
  longWordRule: { minimumLength: 6, bonusStrikes: 1 },
  tileEffects: {
    strike: { strike: true, preventResolveLoss: false },
    ward: { strike: false, preventResolveLoss: true },
  },
}

export type TutorialStep = 'enemy' | 'counter' | 'types' | 'strike' | 'grammar' | 'resolve'
  | 'ward' | 'ward-result' | 'armour' | 'armour-break' | 'complete'

export type TutorialState = {
  step: TutorialStep
  game: LetterStrikeState
}

export type TutorialAction = { type: 'continue' } | { type: 'select'; tileId: number }
  | { type: 'clear' } | { type: 'attack' }

const moves: Partial<Record<TutorialStep, { word: string; next: TutorialStep }>> = {
  counter: { word: 'HOT', next: 'types' },
  strike: { word: 'ICE', next: 'grammar' },
  grammar: { word: 'ICY', next: 'resolve' },
  ward: { word: 'LAD', next: 'ward-result' },
  armour: { word: 'DIG', next: 'armour-break' },
  'armour-break': { word: 'DUO', next: 'complete' },
}

const continuations: Partial<Record<TutorialStep, TutorialStep>> = {
  enemy: 'counter',
  types: 'strike',
  resolve: 'ward',
  'ward-result': 'armour',
}

export function createTutorial(): TutorialState {
  return { step: 'enemy', game: createLetterStrikeGame(tutorialEncounter) }
}

export function getTutorialMove(state: TutorialState) {
  const move = moves[state.step]
  if (!move) return null
  const tileIds: number[] = []
  for (const letter of move.word) {
    const candidates = state.game.tiles.filter(tile => tile.letter === letter && !tileIds.includes(tile.id))
    const special = state.step === 'ward' ? 'ward' : state.step === 'strike' ? 'strike' : undefined
    const tile = candidates.find(tile => special && tile.gem === special) ?? candidates[0]
    if (!tile) throw new Error(`The tutorial needs an available ${letter} for ${move.word}.`)
    tileIds.push(tile.id)
  }
  return { ...move, tileIds }
}

export function canAttackInTutorial(state: TutorialState): boolean {
  const move = getTutorialMove(state)
  const preview = previewLetterStrike(state.game)
  if (!move || !preview.valid || preview.word !== move.word) return false
  // These lessons must use their real special tile, even when another copy of
  // the letter is available. Other correct spellings remain valid choices.
  if (state.step === 'strike' && !preview.effectLabels.includes('STRIKE')) return false
  if (state.step === 'ward' && !preview.effectLabels.includes('WARD')) return false
  return true
}

export function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  if (action.type === 'continue') {
    const next = continuations[state.step]
    return next ? { ...state, step: next } : state
  }
  if (!getTutorialMove(state)) return state
  if (action.type === 'select') {
    return { ...state, game: toggleLetterStrikeTile(state.game, action.tileId) }
  }
  if (action.type === 'clear') {
    return { ...state, game: clearLetterStrikeSelection(state.game) }
  }
  if (!canAttackInTutorial(state)) return state
  return { step: moves[state.step]!.next, game: submitLetterStrike(state.game) }
}
