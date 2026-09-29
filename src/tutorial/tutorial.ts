import { clearLetterStrikeSelection, createLetterStrikeGame, previewLetterStrike, submitLetterStrike, toggleLetterStrikeTile } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import practice from './practice.json' with { type: 'json' }

export const tutorialEncounter = practice as unknown as LetterStrikeEncounter
export const tutorialSteps = [
  { id: 'goal', label: 'The goal' }, { id: 'board', label: 'Letters and lives' },
  { id: 'damp', label: 'First guess' }, { id: 'removed', label: 'Spare tiles' },
  { id: 'wet', label: 'Second guess' }, { id: 'bingo', label: 'The anagram' },
  { id: 'complete', label: 'Finished' },
] as const
export type TutorialStep = typeof tutorialSteps[number]['id']
export type TutorialState = { step: TutorialStep; game: LetterStrikeState }
export type TutorialAction = { type: 'continue' } | { type: 'select'; tileId: number }
  | { type: 'select-many'; tileIds: readonly number[] } | { type: 'clear' } | { type: 'attack' } | { type: 'jump'; step: TutorialStep }
const moves: Partial<Record<TutorialStep, { word: string; action: 'attack' }>> = {
  damp: { word: 'DAMP', action: 'attack' }, wet: { word: 'WET', action: 'attack' }, bingo: { word: 'HYDRATED', action: 'attack' },
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
  const route = tutorialSteps.map(step => step.id)
  const next = route[route.indexOf(state.step) + 1] ?? 'goal'
  const game = action.type === 'attack' ? submitLetterStrike(state.game) : state.game
  return { step: next, game }
}

// Practice is separate from storage. Jumps replay real moves through the engine.
export function createTutorial(step: TutorialStep = 'goal'): TutorialState {
  let state: TutorialState = { step: 'goal', game: createLetterStrikeGame(tutorialEncounter) }
  while (state.step !== step) {
    const move = getTutorialMove(state)
    if (move) for (const tileId of move.tileIds) state = tutorialReducer(state, { type: 'select', tileId })
    const next = tutorialReducer(state, { type: move ? 'attack' : 'continue' })
    if (next === state) throw new Error(`Cannot reach tutorial step ${step}.`)
    state = next
  }
  return state
}
