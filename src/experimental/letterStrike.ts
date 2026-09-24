import { isDictionaryWord, normalizeWord } from '../game/dictionary.ts'
import { getSemanticRelation } from '../game/semantic.ts'
import { getSelectedTiles, refillBoard } from '../game/tiles.ts'
import type { EnemyConcept } from '../game/types.ts'

export type LetterStrikeGem = 'strike' | 'ward'
export type LetterStrikeTile = {
  id: number
  letter: string
  type: 'normal' | 'gem'
  gem?: LetterStrikeGem
}
export type EnemyLetter = { id: string; letter: string; hitsRemaining: number; initialHits: number }
export type LetterStrikeEncounter = {
  id: string
  enemy: Pick<EnemyConcept, 'word' | 'definition' | 'partOfSpeech' | 'semanticRelations'>
  enemyLetters: readonly EnemyLetter[]
  startingResolve: number
  startingTiles: readonly LetterStrikeTile[]
  refillQueue: string
  minimumWordLength: number
  tileEffects: Record<LetterStrikeGem, { strike: boolean; preventResolveLoss: boolean }>
}
export type LetterStrikeHit = {
  tileId: number
  enemyLetterId: string
  letter: string
  hitsBefore: number
  hitsAfter: number
}
export type LetterStrikeEvaluation = {
  word: string
  semanticLabel: 'COUNTER' | 'NEUTRAL' | 'RESISTED'
  strikes: number
  resolveCost: number
  effectLabels: string[]
  enemyLetters: EnemyLetter[]
  hits: LetterStrikeHit[]
}
export type LetterStrikePreview = LetterStrikeEvaluation & { valid: boolean; error: string | null }
export type LetterStrikePlayedWord = {
  word: string
  strikes: number
  semanticLabel: LetterStrikeEvaluation['semanticLabel']
  effectLabels: string[]
  tiles: LetterStrikeTile[]
  preview: LetterStrikePreview
}
export type LetterStrikeState = {
  encounter: LetterStrikeEncounter
  tiles: LetterStrikeTile[]
  selectedTileIds: number[]
  refillIndex: number
  nextTileId: number
  enemyLetters: EnemyLetter[]
  playerResolve: number
  playedWords: LetterStrikePlayedWord[]
  status: 'playing' | 'won' | 'lost'
  error: string | null
}

export const letterStrikeEncounter: LetterStrikeEncounter = {
  id: 'experimental-melancholy-letter-strike',
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
    return { id: `enemy-${index}`, letter, hitsRemaining: initialHits, initialHits }
  }),
  startingResolve: 5,
  startingTiles: [...'JOY CHEER GLOO MADS'.replaceAll(' ', '')].map((letter, id) => ({
    id,
    letter,
    type: id === 2 || id === 9 ? 'gem' : 'normal',
    ...(id === 2 ? { gem: 'ward' as const } : id === 9 ? { gem: 'strike' as const } : {}),
  })),
  // One playable route: JOY, MERRY, CHEER, ELATED, MOLD, NAG. Preserve the
  // original Strike L for MOLD; fixed refills also offer counters and bait.
  refillQueue: 'RYE' + 'RELAT' + 'MENDN' + 'JOYSAD' + 'MERRYDELIGHTELATEDNEONSADGLOOMJOY'.repeat(4),
  minimumWordLength: 3,
  tileEffects: {
    strike: { strike: true, preventResolveLoss: false },
    ward: { strike: false, preventResolveLoss: true },
  },
}

export function createLetterStrikeGame(encounter = letterStrikeEncounter): LetterStrikeState {
  const { startingTiles, startingResolve, enemyLetters, tileEffects } = encounter
  if (startingTiles.length !== 16 || new Set(startingTiles.map(tile => tile.id)).size !== 16) {
    throw new Error('An encounter needs 16 tiles with unique IDs.')
  }
  if (startingTiles.some(tile => !Number.isSafeInteger(tile.id) || tile.id < 0 || !/^[a-z]$/i.test(tile.letter)
    || (tile.type === 'gem' && (!tile.gem || !tileEffects[tile.gem])))) {
    throw new Error('Each tile needs a valid ID, letter, and configured special effect.')
  }
  if (!Number.isSafeInteger(startingResolve) || startingResolve < 1) throw new Error('Starting Resolve must be positive.')
  if (!Number.isSafeInteger(encounter.minimumWordLength) || encounter.minimumWordLength < 1) throw new Error('Minimum word length must be positive.')
  if (enemyLetters.length === 0 || new Set(enemyLetters.map(letter => letter.id)).size !== enemyLetters.length
    || enemyLetters.some(letter => !/^[a-z]$/i.test(letter.letter)
      || ![1, 2].includes(letter.initialHits) || letter.hitsRemaining !== letter.initialHits)) {
    throw new Error('Enemy letters need distinct identities and one or two starting hits.')
  }
  const wardTurns = startingTiles.filter(tile => tile.type === 'gem' && tile.gem && tileEffects[tile.gem].preventResolveLoss).length
  if (!/^[a-z]+$/i.test(encounter.refillQueue) || encounter.refillQueue.length < (startingResolve + wardTurns) * 16) {
    throw new Error('Provide enough deterministic refill letters for all possible turns.')
  }
  return {
    encounter,
    tiles: startingTiles.map(tile => ({ ...tile, letter: tile.letter.toUpperCase() })),
    selectedTileIds: [],
    refillIndex: 0,
    nextTileId: Math.max(...startingTiles.map(tile => tile.id)) + 1,
    enemyLetters: enemyLetters.map(letter => ({ ...letter, letter: letter.letter.toUpperCase() })),
    playerResolve: startingResolve,
    playedWords: [],
    status: 'playing',
    error: null,
  }
}

export function toggleLetterStrikeTile(state: LetterStrikeState, id: number): LetterStrikeState {
  if (state.status !== 'playing' || !state.tiles.some(tile => tile.id === id)) return state
  const selectedTileIds = state.selectedTileIds.includes(id)
    ? state.selectedTileIds.filter(selectedId => selectedId !== id)
    : [...state.selectedTileIds, id]
  return { ...state, selectedTileIds, error: null }
}

export function clearLetterStrikeSelection(state: LetterStrikeState): LetterStrikeState {
  return state.status === 'playing' ? { ...state, selectedTileIds: [], error: null } : state
}

// Finish a wounded armoured copy first; ties and untouched copies keep their
// original left-to-right order. Dead slots never participate in targeting.
export function selectEnemyTarget(letters: readonly EnemyLetter[], letter: string): EnemyLetter | undefined {
  const matches = letters.filter(target => target.hitsRemaining > 0 && target.letter === letter.toUpperCase())
  return matches.find(target => target.hitsRemaining < target.initialHits) ?? matches[0]
}

// Pure scoring for already selected tiles. The preview validates real board IDs
// and dictionary membership; the immediate-strike solver can reuse this scorer.
export function evaluateLetterStrike(state: Pick<LetterStrikeState, 'encounter' | 'enemyLetters'>, tiles: readonly LetterStrikeTile[]): LetterStrikeEvaluation {
  const word = normalizeWord(tiles.map(tile => tile.letter).join(''))
  const relation = getSemanticRelation(word, state.encounter.enemy)
  const semanticLabel = relation === 'opposite' ? 'COUNTER' : relation === 'similar' ? 'RESISTED' : 'NEUTRAL'
  const enemyLetters = state.enemyLetters.map(letter => ({ ...letter }))
  const hits: LetterStrikeHit[] = []
  const seenTiles = new Set<number>()
  let neutralStrikeUsed = false
  let resolveCost = 1
  let usesStrike = false
  for (const tile of tiles) {
    // The public scorer also respects physical tile identity if called directly.
    if (seenTiles.has(tile.id)) continue
    seenTiles.add(tile.id)
    const effect = tile.type === 'gem' && tile.gem ? state.encounter.tileEffects[tile.gem] : undefined
    if (effect?.preventResolveLoss) resolveCost = 0
    if (effect?.strike) usesStrike = true
    const normalStrike = semanticLabel === 'COUNTER' || (semanticLabel === 'NEUTRAL' && !neutralStrikeUsed)
    if (!normalStrike && !effect?.strike) continue
    const target = selectEnemyTarget(enemyLetters, tile.letter)
    if (!target) continue
    hits.push({ tileId: tile.id, enemyLetterId: target.id, letter: target.letter, hitsBefore: target.hitsRemaining, hitsAfter: target.hitsRemaining - 1 })
    target.hitsRemaining -= 1
    if (semanticLabel === 'NEUTRAL' && normalStrike) neutralStrikeUsed = true
  }
  return {
    word,
    semanticLabel,
    strikes: hits.length,
    resolveCost,
    effectLabels: [...(usesStrike ? ['STRIKE'] : []), ...(resolveCost === 0 ? ['WARD'] : [])],
    enemyLetters,
    hits,
  }
}

export function previewLetterStrike(state: LetterStrikeState, selectedTileIds: readonly number[] = state.selectedTileIds): LetterStrikePreview {
  const tiles = getSelectedTiles(state, selectedTileIds)
  const evaluation = evaluateLetterStrike(state, tiles)
  const error = state.status !== 'playing' ? 'Encounter finished'
    : new Set(selectedTileIds).size !== selectedTileIds.length ? 'Cannot use the same tile twice'
    : tiles.length !== selectedTileIds.length ? 'Selected tile is not on the board'
    : evaluation.word.length < state.encounter.minimumWordLength ? `Minimum ${state.encounter.minimumWordLength} letters`
    : !isDictionaryWord(evaluation.word) ? 'Not a valid word'
    : null
  return {
    ...evaluation,
    valid: error === null,
    error,
    ...(error !== null ? {
      strikes: 0, resolveCost: 0, effectLabels: [], hits: [],
      enemyLetters: state.enemyLetters.map(letter => ({ ...letter })),
    } : {}),
  }
}

export function submitLetterStrike(state: LetterStrikeState, selectedTileIds: readonly number[] = state.selectedTileIds): LetterStrikeState {
  if (state.status !== 'playing') return state
  const preview = previewLetterStrike(state, selectedTileIds)
  if (!preview.valid) return { ...state, error: preview.error }
  const playerResolve = Math.max(0, state.playerResolve - preview.resolveCost)
  const status = preview.enemyLetters.every(letter => letter.hitsRemaining === 0) ? 'won' : playerResolve === 0 ? 'lost' : 'playing'
  return {
    ...state,
    ...refillBoard(state, selectedTileIds),
    selectedTileIds: [],
    enemyLetters: preview.enemyLetters,
    playerResolve,
    playedWords: [...state.playedWords, {
      word: preview.word,
      strikes: preview.strikes,
      semanticLabel: preview.semanticLabel,
      effectLabels: preview.effectLabels,
      tiles: getSelectedTiles(state, selectedTileIds),
      preview,
    }],
    status,
    error: null,
  }
}
