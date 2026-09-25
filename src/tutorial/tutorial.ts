import {
  clearLetterStrikeSelection,
  createLetterStrikeGame,
  previewLetterStrike,
  submitLetterStrike,
  toggleLetterStrikeTile,
} from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeGem, LetterStrikeState } from '../game/letterStrike.ts'

// Small, isolated examples use the actual engine. No tutorial action reads or
// writes Daily storage, and even prepared examples are created by real moves.
function encounter(id: string, word: string, board: string, options: {
  definition?: string
  armour?: number[]
  specials?: Record<number, LetterStrikeGem>
  opposite?: string[]
  similar?: string[]
  grammar?: boolean
  long?: boolean
  refill?: string
} = {}): LetterStrikeEncounter {
  if (board.length !== 16) throw new Error(`Tutorial board ${id} needs 16 letters.`)
  return {
    id: `tutorial-${id}`,
    enemy: {
      word, definition: options.definition ?? 'feeling unhappy',
      partOfSpeech: word === 'FEAR' || word === 'STORM' ? 'noun' : 'adjective',
      semanticRelations: { opposite: options.opposite ?? [], similar: options.similar ?? [], related: [] },
    },
    enemyLetters: [...word].map((letter, index) => ({
      id: `${id}-enemy-${index}`, letter,
      hitsRemaining: options.armour?.includes(index) ? 2 : 1,
      initialHits: options.armour?.includes(index) ? 2 : 1,
    })),
    startingResolve: 5,
    startingTiles: [...board].map((letter, id) => ({
      id, letter, type: options.specials?.[id] ? 'gem' : 'normal',
      ...(options.specials?.[id] ? { gem: options.specials[id] } : {}),
    })),
    refillQueue: (options.refill ?? 'SUNGLADREDSTREAM').repeat(64),
    minimumWordLength: 3,
    ...(options.grammar ? { grammarModifiers: { adjective: 1 }, wordPartsOfSpeech: { DAMP: ['adjective'] } } : {}),
    ...(options.long ? { longWordRule: { minimumLength: 6, bonusStrikes: 1 } } : {}),
    tileEffects: {
      strike: { strike: true, preventResolveLoss: false },
      ward: { strike: false, preventResolveLoss: true },
      regen: { strike: false, preventResolveLoss: false, regenerate: true },
    },
  }
}

export const tutorialEncounter = encounter('sad-basics', 'SAD', 'GSUNOLERTAHIMPCD', { opposite: ['GLAD'] })
export const tutorialFixtures = {
  basic: tutorialEncounter,
  armour: encounter('armour', 'SAD', 'SUNACTDIGOEPRLXY', { armour: [0], refill: 'SUN' }),
  resisted: encounter('resisted', 'SAD', 'SADXLUNERTIOGPMC', { similar: ['SAD'] }),
  strike: encounter('strike', 'SAD', 'SADXLUNERTIOGPMC', { similar: ['SAD'], specials: { 0: 'strike' } }),
  ward: encounter('ward', 'SAD', 'SUNCATDIGOEPRLXY', { specials: { 6: 'ward' }, refill: 'XXX' }),
  regen: encounter('regen', 'FEAR', 'REDXELFGHIJKMNOP', {
    definition: 'an unpleasant feeling of danger', specials: { 1: 'regen' }, refill: 'ELF',
  }),
  grammar: encounter('grammar', 'SAD', 'DAMPSUNROEILGCTX', { grammar: true }),
  long: encounter('long', 'STORM', 'STREAMDUNOPILGCY', {
    definition: 'violent weather with wind and rain', long: true,
  }),
} satisfies Record<string, LetterStrikeEncounter>

// Only the first four states form onboarding. The remaining routes are optional
// practice examples, also available directly from the development tools.
export const tutorialSteps = [
  { id: 'goal', label: 'Brief introduction' },
  { id: 'counter', label: 'Demo · GLAD' },
  { id: 'neutral', label: 'Demo · SUN' },
  { id: 'complete', label: 'Ready to play' },
  { id: 'armour', label: 'Optional · Armour' },
  { id: 'armour-finish', label: 'Armour · second hit' },
  { id: 'armour-complete', label: 'Armour · result' },
  { id: 'resisted', label: 'Optional · Resistance' },
  { id: 'strike', label: 'Optional · HIT tile' },
  { id: 'strike-result', label: 'HIT tile · result' },
  { id: 'ward', label: 'Optional · LIFE tile' },
  { id: 'ward-result', label: 'LIFE tile · result' },
  { id: 'regen-dead', label: 'Optional · REVIVE revival' },
  { id: 'regen-alive', label: 'REVIVE · armour' },
  { id: 'regen-safe', label: 'REVIVE · safe choice' },
  { id: 'regen-result', label: 'REVIVE · result' },
  { id: 'grammar', label: 'Optional · Word types' },
  { id: 'grammar-result', label: 'Word types · result' },
  { id: 'long', label: 'Optional · Long words' },
  { id: 'long-result', label: 'Long words · result' },
] as const
export type TutorialStep = typeof tutorialSteps[number]['id']
export type TutorialState = { step: TutorialStep; game: LetterStrikeState }
export type TutorialAction = { type: 'continue' } | { type: 'select'; tileId: number }
  | { type: 'clear' } | { type: 'attack' } | { type: 'jump'; step: TutorialStep }

export const tutorialExamples = [
  { step: 'armour', label: 'Armour', description: 'Double border: two hits to remove a letter.' },
  { step: 'resisted', label: 'Resistance + HIT tiles', description: 'Similar meaning blocks normal hits. A HIT tile still hits its match.' },
  { step: 'ward', label: 'LIFE tiles', description: 'A green LIFE tile saves the life this turn would cost.' },
  { step: 'regen-dead', label: 'REVIVE', description: 'Red tiles help the enemy: matching letters return or gain armour.' },
  { step: 'grammar', label: 'Word types', description: 'An enemy may give extra hits for a word type, such as adjectives.' },
  { step: 'long', label: 'Long words', description: 'Neutral words of six or more letters get an extra hit.' },
] as const satisfies readonly { step: TutorialStep; label: string; description: string }[]

const routes: readonly (readonly TutorialStep[])[] = [
  ['goal', 'counter', 'neutral', 'complete'],
  ['armour', 'armour-finish', 'armour-complete'],
  ['resisted', 'strike', 'strike-result'],
  ['ward', 'ward-result'],
  ['regen-dead', 'regen-alive', 'regen-safe', 'regen-result'],
  ['grammar', 'grammar-result'],
  ['long', 'long-result'],
]

type GuidedMove = { word: string; action: 'continue' | 'attack'; special?: LetterStrikeGem }
const moves: Partial<Record<TutorialStep, GuidedMove>> = {
  counter: { word: 'GLAD', action: 'attack' },
  neutral: { word: 'SUN', action: 'attack' },
  armour: { word: 'SUN', action: 'attack' },
  'armour-finish': { word: 'SUN', action: 'attack' },
  resisted: { word: 'SAD', action: 'continue' },
  strike: { word: 'SAD', action: 'attack', special: 'strike' },
  ward: { word: 'DIG', action: 'attack', special: 'ward' },
  'regen-dead': { word: 'RED', action: 'continue', special: 'regen' },
  'regen-alive': { word: 'RED', action: 'continue', special: 'regen' },
  'regen-safe': { word: 'RED', action: 'attack' },
  grammar: { word: 'DAMP', action: 'attack' },
  long: { word: 'STREAM', action: 'attack' },
}

function playPreparedWord(game: LetterStrikeState, word: string): LetterStrikeState {
  const selectedTileIds: number[] = []
  for (const letter of word) {
    const tile = game.tiles.find(tile => tile.letter === letter && tile.type === 'normal' && !selectedTileIds.includes(tile.id))
    if (!tile) throw new Error(`Missing prepared tutorial letter ${letter}.`)
    selectedTileIds.push(tile.id)
  }
  const result = submitLetterStrike({ ...game, selectedTileIds })
  if (result.error) throw new Error(result.error)
  return result
}

function enterStep(state: TutorialState, step: TutorialStep): TutorialState {
  let game = state.game
  if (step === 'armour') game = createLetterStrikeGame(tutorialFixtures.armour)
  if (step === 'resisted') game = createLetterStrikeGame(tutorialFixtures.resisted)
  if (step === 'strike') game = createLetterStrikeGame(tutorialFixtures.strike)
  if (step === 'ward') {
    game = playPreparedWord(playPreparedWord(createLetterStrikeGame(tutorialFixtures.ward), 'SUN'), 'CAT')
  }
  if (step === 'regen-dead') game = playPreparedWord(createLetterStrikeGame(tutorialFixtures.regen), 'ELF')
  if (step === 'regen-alive') game = createLetterStrikeGame(tutorialFixtures.regen)
  if (step === 'regen-safe') game = clearLetterStrikeSelection(game)
  if (step === 'grammar') game = createLetterStrikeGame(tutorialFixtures.grammar)
  if (step === 'long') game = createLetterStrikeGame(tutorialFixtures.long)
  return { step, game }
}

export function getTutorialMove(state: TutorialState) {
  const move = moves[state.step]
  if (!move) return null
  const tileIds: number[] = []
  for (const letter of move.word) {
    const candidates = state.game.tiles.filter(tile => tile.letter === letter && !tileIds.includes(tile.id))
    const tile = candidates.find(tile => move.special && tile.gem === move.special)
      ?? candidates.find(tile => tile.type === 'normal')
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
  return !move || move.action === 'continue' && isGuidedWordSelected(state)
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
