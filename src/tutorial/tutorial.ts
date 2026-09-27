import {
  clearLetterStrikeSelection, createLetterStrikeGame, previewLetterStrike,
  submitLetterStrike, toggleLetterStrikeTile,
} from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'

import arid from './arid.json' with { type: 'json' }

// The archived ARID board, armour and finite refills, with only lesson words
// retained in its frozen lexicon. Every action still runs through the real game.
export const tutorialEncounter = arid as unknown as LetterStrikeEncounter
const attempt = (lives: number): LetterStrikeEncounter => ({
  ...tutorialEncounter, id: `tutorial-arid-${lives}`, startingResolve: lives,
})
export const tutorialFixtures = { basic: attempt(3), two: attempt(2), bingo: attempt(1) }
export const tutorialSteps = [
  { id: 'goal', label: 'Introduction' },
  { id: 'board', label: 'The board' },
  { id: 'water', label: '3 lives · WATER' },
  { id: 'spring', label: '3 lives · SPRING' },
  { id: 'dip', label: '3 lives · DIP' },
  { id: 'three-won', label: 'One star' },
  { id: 'rain', label: '2 lives · RAIN' },
  { id: 'muddier', label: '2 lives · MUDDIER' },
  { id: 'two-won', label: 'Two stars' },
  { id: 'bingo', label: '1 life · IRRIGATED' },
  { id: 'complete', label: 'Bingo · three stars' },
  { id: 'neutral', label: 'Optional · Neutral' },
  { id: 'neutral-result', label: 'Neutral · result' },
  { id: 'resisted', label: 'Optional · Similar' },
  { id: 'resisted-result', label: 'Similar · result' },
] as const
export type TutorialStep = typeof tutorialSteps[number]['id']
export type TutorialState = { step: TutorialStep; game: LetterStrikeState }
export type TutorialAction = { type: 'continue' } | { type: 'select'; tileId: number }
  | { type: 'select-many'; tileIds: readonly number[] }
  | { type: 'clear' } | { type: 'attack' } | { type: 'jump'; step: TutorialStep }

export const tutorialExamples = [
  { step: 'neutral', label: 'Neutral words', description: 'A neutral word hits only its first matching letter.' },
  { step: 'resisted', label: 'Similar words', description: 'Similar concepts use a life but hit nothing.' },
] as const satisfies readonly { step: TutorialStep; label: string; description: string }[]

const routes: readonly (readonly TutorialStep[])[] = [
  ['goal', 'board', 'water', 'spring', 'dip', 'three-won', 'rain', 'muddier', 'two-won', 'bingo', 'complete'],
  ['neutral', 'neutral-result', 'goal'],
  ['resisted', 'resisted-result', 'goal'],
]
type GuidedMove = { word: string; action: 'attack' }
const moves: Partial<Record<TutorialStep, GuidedMove>> = Object.fromEntries(
  [['water', 'WATER'], ['spring', 'SPRING'], ['dip', 'DIP'], ['rain', 'RAIN'],
    ['muddier', 'MUDDIER'], ['bingo', 'IRRIGATED'], ['neutral', 'GRID'], ['resisted', 'DRY']]
    .map(([step, word]) => [step, { word, action: 'attack' as const }]),
)
function enterStep(state: TutorialState, step: TutorialStep): TutorialState {
  const lives = step === 'rain' ? 2 : step === 'bingo' ? 1
    : ['goal', 'neutral', 'resisted'].includes(step) ? 3 : null
  return { step, game: lives === null ? state.game : createLetterStrikeGame(attempt(lives)) }
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
  const next = route[route.indexOf(state.step) + 1] ?? 'goal'
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
