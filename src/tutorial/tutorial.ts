import {
  clearLetterStrikeSelection, createLetterStrikeGame, previewLetterStrike,
  submitLetterStrike, toggleLetterStrikeTile,
} from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'

// Each lesson uses the real rules and a finite supply. Daily saves are untouched.
function encounter(id: string, board: string, options: {
  armour?: number[]; opposite?: string[]; similar?: string[]; refill?: string
} = {}): LetterStrikeEncounter {
  if (board.length !== 16) throw new Error(`Tutorial board ${id} needs 16 letters.`)
  return {
    id: `tutorial-${id}`,
    enemy: { word: 'SAD', definition: 'feeling unhappy', partOfSpeech: 'adjective',
      semanticRelations: { opposite: options.opposite ?? [], similar: options.similar ?? [], related: [] } },
    enemyLetters: [...'SAD'].map((letter, index) => ({
      id: `${id}-enemy-${index}`, letter,
      hitsRemaining: options.armour?.includes(index) ? 2 : 1,
      initialHits: options.armour?.includes(index) ? 2 : 1,
    })),
    startingResolve: 3,
    startingTiles: [...board].map((letter, id) => ({ id, letter, type: 'normal' })),
    refillQueue: options.refill ?? 'SUNGLAD', finiteRefills: true,
    minimumWordLength: 3,
    tileEffects: { strike: { strike: false, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: false } },
  }
}

export const tutorialEncounter = encounter('sad-basics', 'GSUNOLERTAHIMPCD', { opposite: ['GLAD'] })
export const tutorialFixtures = {
  basic: tutorialEncounter,
  armour: encounter('armour', 'SUNACTDIGOEPRLXY', { armour: [0], refill: 'SUN' }),
  resisted: encounter('resisted', 'SADXLUNERTIOGPMC', { similar: ['SAD'] }),
  bingo: encounter('bingo', 'GLADDENSCOURITMP', { armour: [2], opposite: ['GLADDENS'] }),
} satisfies Record<string, LetterStrikeEncounter>

export const tutorialSteps = [
  { id: 'goal', label: 'Brief introduction' },
  { id: 'counter', label: 'Demo · GLAD' },
  { id: 'neutral', label: 'Demo · SUN' },
  { id: 'complete', label: 'Ready to play' },
  { id: 'armour', label: 'Optional · Armour' },
  { id: 'armour-finish', label: 'Armour · second hit' },
  { id: 'armour-complete', label: 'Armour · result' },
  { id: 'resisted', label: 'Optional · Resistance' },
  { id: 'resisted-result', label: 'Resistance · result' },
  { id: 'bingo', label: 'Optional · Bingo' },
  { id: 'bingo-result', label: 'Bingo · result' },
] as const
export type TutorialStep = typeof tutorialSteps[number]['id']
export type TutorialState = { step: TutorialStep; game: LetterStrikeState }
export type TutorialAction = { type: 'continue' } | { type: 'select'; tileId: number }
  | { type: 'select-many'; tileIds: readonly number[] }
  | { type: 'clear' } | { type: 'attack' } | { type: 'jump'; step: TutorialStep }

export const tutorialExamples = [
  { step: 'armour', label: 'Armour', description: 'A double border takes two hits.' },
  { step: 'resisted', label: 'Resistance', description: 'Similar meaning uses a life but hits nothing.' },
  { step: 'bingo', label: 'Bingo', description: 'One counter can remove the whole enemy.' },
] as const satisfies readonly { step: TutorialStep; label: string; description: string }[]

const routes: readonly (readonly TutorialStep[])[] = [
  ['goal', 'counter', 'neutral', 'complete'],
  ['armour', 'armour-finish', 'armour-complete'],
  ['resisted', 'resisted-result'],
  ['bingo', 'bingo-result'],
]
type GuidedMove = { word: string; action: 'attack' }
const moves: Partial<Record<TutorialStep, GuidedMove>> = {
  counter: { word: 'GLAD', action: 'attack' },
  neutral: { word: 'SUN', action: 'attack' },
  armour: { word: 'SUN', action: 'attack' },
  'armour-finish': { word: 'SUN', action: 'attack' },
  resisted: { word: 'SAD', action: 'attack' },
  bingo: { word: 'GLADDENS', action: 'attack' },
}
function enterStep(state: TutorialState, step: TutorialStep): TutorialState {
  const fixture = step === 'armour' || step === 'resisted' || step === 'bingo' ? tutorialFixtures[step] : undefined
  return { step, game: fixture ? createLetterStrikeGame(fixture) : state.game }
}
export function getTutorialMove(state: TutorialState) {
  const move = moves[state.step]
  if (!move) return null
  const tileIds: number[] = []
  for (const letter of move.word) {
    const tile = state.game.tiles.find(tile => tile.letter === letter && !tileIds.includes(tile.id))
    if (!tile) throw new Error(`The tutorial needs an available ${letter} for ${move.word}.`)
    tileIds.push(tile.id)
  }
  return { ...move, tileIds }
}

function isGuidedWordSelected(state: TutorialState): boolean {
  const move = getTutorialMove(state)
  return Boolean(move && move.tileIds.length === state.game.selectedTileIds.length
    && move.tileIds.every((id, index) => state.game.selectedTileIds[index] === id)
    && previewLetterStrike(state.game).valid)
}

export function canAttackInTutorial(state: TutorialState): boolean {
  return moves[state.step]?.action === 'attack' && isGuidedWordSelected(state)
}

export function canContinueInTutorial(state: TutorialState): boolean {
  const move = moves[state.step]
  return !move
}

export function getAllowedTutorialTileIds(state: TutorialState): number[] {
  const move = getTutorialMove(state)
  if (!move) return []
  const selected = state.game.selectedTileIds
  const prefix = selected.every((id, index) => id === move.tileIds[index])
  const next = prefix ? move.tileIds[selected.length] : undefined
  return [...selected, ...(next === undefined ? [] : [next])]
}

export function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  if (action.type === 'jump') return createTutorial(action.step)
  if (action.type === 'select-many') {
    // A single fast swipe can cross several letters before React renders.
    // Validate each against the updated prefix, ignoring wrong/repeated tiles.
    return action.tileIds.reduce((current, tileId) => current.game.selectedTileIds.includes(tileId)
      ? current : tutorialReducer(current, { type: 'select', tileId }), state)
  }
  if (action.type === 'select') {
    if (!getAllowedTutorialTileIds(state).includes(action.tileId)) return state
    return { ...state, game: toggleLetterStrikeTile(state.game, action.tileId) }
  }
  if (action.type === 'clear') {
    if (!getAllowedTutorialTileIds(state).length) return state
    return { ...state, game: clearLetterStrikeSelection(state.game) }
  }
  if (action.type === 'continue' && !canContinueInTutorial(state)) return state
  if (action.type === 'attack' && !canAttackInTutorial(state)) return state
  if (state.step === 'complete') return state
  const route = routes.find(route => route.includes(state.step))!
  const next = route[route.indexOf(state.step) + 1] ?? 'complete'
  const game = action.type === 'attack' ? submitLetterStrike(state.game) : state.game
  return enterStep({ ...state, game }, next)
}

// DEV jumps and optional examples replay real moves in their own small route.
// They never fabricate damage, Resolve, tile identities or refill state.
export function createTutorial(step: TutorialStep = 'goal'): TutorialState {
  const route = routes.find(route => route.includes(step))
  if (!route) throw new Error(`Unknown tutorial example: ${step}`)
  let state = enterStep({ step: 'goal', game: createLetterStrikeGame(tutorialEncounter) }, route[0])
  while (state.step !== step) {
    const move = getTutorialMove(state)
    if (move && !isGuidedWordSelected(state)) {
      for (const tileId of move.tileIds) state = tutorialReducer(state, { type: 'select', tileId })
    }
    const next = tutorialReducer(state, { type: canAttackInTutorial(state) ? 'attack' : 'continue' })
    if (next === state) throw new Error(`Cannot reach tutorial step ${step}.`)
    state = next
  }
  return state
}
