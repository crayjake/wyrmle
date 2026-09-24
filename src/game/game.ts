import { calculateDamage } from './damage.ts'
import { isDictionaryWord, normalizeWord } from './dictionary.ts'
import { getSelectedTiles, refillBoard } from './tiles.ts'
import type { AttackPreview, Encounter, GameState } from './types.ts'

export { getSelectedTiles } from './tiles.ts'

// Adapted from bookworm-game's pure immutable state transitions. Creature
// attacks, tile locks, and independent turns/health have no place in this model.
export function createGame(encounter: Encounter): GameState {
  const { startingTiles, startingResolve, rules } = encounter
  if (startingTiles.length !== 16) throw new Error('An encounter needs exactly 16 starting tiles.')
  if (new Set(startingTiles.map((tile) => tile.id)).size !== startingTiles.length) {
    throw new Error('Starting tile IDs must be unique.')
  }
  if (startingTiles.some((tile) => !Number.isSafeInteger(tile.id) || tile.id < 0 || !/^[a-z]$/i.test(tile.letter))) {
    throw new Error('Each starting tile needs a nonnegative integer ID and one letter.')
  }
  if (startingTiles.some((tile) => tile.type === 'gem' && (!tile.gem || !rules.tileEffects[tile.gem]))) {
    throw new Error('Each gem tile needs a configured effect.')
  }
  if (!Number.isSafeInteger(startingResolve) || startingResolve < 1) {
    throw new Error('Starting Resolve must be a positive integer.')
  }
  if (!Number.isFinite(encounter.enemy.maxHealth) || encounter.enemy.maxHealth <= 0) {
    throw new Error('Enemy maximum health must be positive.')
  }
  // Normal refills cannot create new Wards. Each starting defensive tile can
  // therefore extend the encounter by at most one attack. Reserve a full board
  // per possible attack, including the terminal one, so refills cannot run out.
  const defensiveTiles = startingTiles.filter((tile) => (
    tile.type === 'gem' && tile.gem && rules.tileEffects[tile.gem].preventResolveLoss
  )).length
  if (!/^[a-z]+$/i.test(encounter.refillQueue)
    || encounter.refillQueue.length < (startingResolve + defensiveTiles) * startingTiles.length) {
    throw new Error('Provide enough refill letters for every possible turn, including Ward turns, to use all 16 tiles.')
  }

  return {
    encounter,
    tiles: startingTiles.map((tile) => ({ ...tile, letter: tile.letter.toUpperCase() })),
    selectedTileIds: [],
    refillIndex: 0,
    nextTileId: Math.max(...startingTiles.map((tile) => tile.id)) + 1,
    enemyHp: encounter.enemy.maxHealth,
    playerResolve: startingResolve,
    playedWords: [],
    status: 'playing',
    error: null,
  }
}

export function toggleTile(state: GameState, tileId: number): GameState {
  if (state.status !== 'playing' || !state.tiles.some((tile) => tile.id === tileId)) return state
  const selectedTileIds = state.selectedTileIds.includes(tileId)
    ? state.selectedTileIds.filter((id) => id !== tileId)
    : [...state.selectedTileIds, tileId]
  return { ...state, selectedTileIds, error: null }
}

export function clearSelection(state: GameState): GameState {
  if (state.status !== 'playing') return state
  return { ...state, selectedTileIds: [], error: null }
}

export function getSelectedWord(state: GameState, selectedTileIds = state.selectedTileIds): string {
  return normalizeWord(getSelectedTiles(state, selectedTileIds).map((tile) => tile.letter).join(''))
}

export function getWordError(state: GameState, selectedTileIds = state.selectedTileIds): string | null {
  if (state.status !== 'playing') return 'Encounter finished'
  if (new Set(selectedTileIds).size !== selectedTileIds.length) return 'Cannot use the same tile twice'
  const tiles = getSelectedTiles(state, selectedTileIds)
  if (tiles.length !== selectedTileIds.length) return 'Selected tile is not on the board'
  const word = getSelectedWord(state, selectedTileIds)
  if (word.length < state.encounter.rules.minimumWordLength) {
    return `Minimum ${state.encounter.rules.minimumWordLength} letters`
  }
  if (!isDictionaryWord(word)) return 'Not a valid word'
  return null
}

// Neither validation nor preview consumes tiles or advances the refill queue.
// Invalid selections have no actionable damage, bonuses, or Resolve cost.
export function previewAttack(state: GameState, selectedTileIds = state.selectedTileIds): AttackPreview {
  const word = getSelectedWord(state, selectedTileIds)
  const tiles = getSelectedTiles(state, selectedTileIds)
  const error = getWordError(state, selectedTileIds)
  const damage = calculateDamage(word, tiles, state.encounter)
  return {
    word,
    valid: error === null,
    error,
    ...damage,
    ...(error !== null ? { totalDamage: 0, resolveCost: 0, tileEffects: [], bonuses: [] } : {}),
  }
}

// There is no freeform word argument: actual tile IDs determine every effect.
export function submitWord(state: GameState, selectedTileIds = state.selectedTileIds): GameState {
  if (state.status !== 'playing') return state
  const preview = previewAttack(state, selectedTileIds)
  if (!preview.valid) return { ...state, error: preview.error }

  const tiles = getSelectedTiles(state, selectedTileIds)
  const enemyHp = Math.max(0, state.enemyHp - preview.totalDamage)
  const playerResolve = Math.max(0, state.playerResolve - preview.resolveCost)
  // As in bookworm-game, a last-resource killing blow wins before loss is tested.
  const status = enemyHp === 0 ? 'won' : playerResolve === 0 ? 'lost' : 'playing'
  return {
    ...state,
    ...refillBoard(state, selectedTileIds),
    selectedTileIds: [],
    enemyHp,
    playerResolve,
    playedWords: [...state.playedWords, {
      word: preview.word,
      damage: preview.totalDamage,
      tiles,
      effects: preview.tileEffects,
      preview,
    }],
    status,
    error: null,
  }
}
