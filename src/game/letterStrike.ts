import { getPartsOfSpeech, isDictionaryWord, normalizeWord } from './dictionary.ts'
import { getSemanticRelation } from './semantic.ts'
import { getSelectedTiles, refillBoard } from './tiles.ts'
import type { EnemyConcept, PartOfSpeech } from './types.ts'

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
  grammarModifiers?: Partial<Record<PartOfSpeech, number>>
  // Only archived encounters opt into the original overlapping Strike rule.
  strikeConsumesAllowance?: boolean
  tileEffects: Record<LetterStrikeGem, { strike: boolean; preventResolveLoss: boolean }>
}
export type LetterStrikeHit = {
  tileId: number
  enemyLetterId: string
  letter: string
  hitsBefore: number
  hitsAfter: number
}
export type LetterStrikeLetterOutcome = {
  enemyLetterId: string
  position: number
  hitsBefore: number
  hitsAfter: number
  armourBroken: boolean
  removed: boolean
}
export type LetterStrikeEvaluation = {
  word: string
  semanticLabel: 'COUNTER' | 'NEUTRAL' | 'RESISTED'
  grammaticalModifier: number
  grammaticalPartOfSpeech: PartOfSpeech | null
  strikes: number
  resolveCost: number
  effectLabels: string[]
  enemyLetters: EnemyLetter[]
  hits: LetterStrikeHit[]
  letterOutcomes: LetterStrikeLetterOutcome[]
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
  grammarModifiers: { adjective: 1 },
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
  if (Object.values(encounter.grammarModifiers ?? {}).some(value => !Number.isSafeInteger(value))) {
    throw new Error('Grammar modifiers must be integer strike allowances.')
  }
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

// A counter already permits all available matching tiles. Positive grammar
// cannot add phantom hits; negative grammar reduces that finite capacity.
// For resisted/neutral words, modifiers change their 0/1 normal-hit budget.
export function getLetterStrikeAllowance(encounter: LetterStrikeEncounter, word: string, matchingCapacity: number): {
  semanticLabel: LetterStrikeEvaluation['semanticLabel']
  grammaticalModifier: number
  grammaticalPartOfSpeech: PartOfSpeech | null
  normalStrikeAllowance: number
} {
  const relation = getSemanticRelation(word, encounter.enemy)
  const semanticLabel = relation === 'opposite' ? 'COUNTER' : relation === 'similar' ? 'RESISTED' : 'NEUTRAL'
  const parts = getPartsOfSpeech(word)
  const partOfSpeech = parts?.length === 1 ? parts[0] : null
  const configuredModifier = partOfSpeech ? encounter.grammarModifiers?.[partOfSpeech] ?? 0 : 0
  const base = semanticLabel === 'COUNTER' ? matchingCapacity : semanticLabel === 'NEUTRAL' ? 1 : 0
  const normalStrikeAllowance = Math.max(0, Math.min(
    semanticLabel === 'COUNTER' ? matchingCapacity : Number.POSITIVE_INFINITY,
    base + configuredModifier,
  ))
  const grammaticalModifier = normalStrikeAllowance - base
  return {
    semanticLabel,
    grammaticalModifier,
    grammaticalPartOfSpeech: grammaticalModifier !== 0 ? partOfSpeech : null,
    normalStrikeAllowance,
  }
}

// One entry per original slot, derived from the actual ordered strikes rather
// than guessed from the encounter's final state. Dead/untouched slots remain.
export function buildLetterStrikeOutcomes(letters: readonly EnemyLetter[], hits: readonly LetterStrikeHit[]): LetterStrikeLetterOutcome[] {
  const finalHits = new Map(hits.map(hit => [hit.enemyLetterId, hit.hitsAfter]))
  const armourBreaks = new Set(hits.filter(hit => hit.hitsBefore > 1 && hit.hitsAfter <= 1).map(hit => hit.enemyLetterId))
  return letters.map((letter, position) => {
    const hitsAfter = finalHits.get(letter.id) ?? letter.hitsRemaining
    return {
      enemyLetterId: letter.id,
      position,
      hitsBefore: letter.hitsRemaining,
      hitsAfter,
      armourBroken: armourBreaks.has(letter.id),
      removed: letter.hitsRemaining > 0 && hitsAfter === 0,
    }
  })
}

// Pure scoring for already selected tiles. The preview validates real board IDs
// and dictionary membership; the immediate-strike solver can reuse this scorer.
export function evaluateLetterStrike(state: Pick<LetterStrikeState, 'encounter' | 'enemyLetters'>, tiles: readonly LetterStrikeTile[]): LetterStrikeEvaluation {
  const word = normalizeWord(tiles.map(tile => tile.letter).join(''))
  const capacityByLetter = new Map<string, number>()
  for (const letter of state.enemyLetters) {
    capacityByLetter.set(letter.letter, (capacityByLetter.get(letter.letter) ?? 0) + letter.hitsRemaining)
  }
  let matchingCapacity = 0
  for (const tile of new Map(tiles.map(tile => [tile.id, tile])).values()) {
    const letter = tile.letter.toUpperCase()
    const capacity = capacityByLetter.get(letter) ?? 0
    if (capacity > 0) {
      matchingCapacity += 1
      capacityByLetter.set(letter, capacity - 1)
    }
  }
  const { semanticLabel, grammaticalModifier, grammaticalPartOfSpeech, normalStrikeAllowance } = getLetterStrikeAllowance(state.encounter, word, matchingCapacity)
  const enemyLetters = state.enemyLetters.map(letter => ({ ...letter }))
  const hits: LetterStrikeHit[] = []
  const seenTiles = new Set<number>()
  let normalStrikesRemaining = normalStrikeAllowance
  let resolveCost = 1
  let usesStrike = false
  for (const tile of tiles) {
    // The public scorer also respects physical tile identity if called directly.
    if (seenTiles.has(tile.id)) continue
    seenTiles.add(tile.id)
    const effect = tile.type === 'gem' && tile.gem ? state.encounter.tileEffects[tile.gem] : undefined
    if (effect?.preventResolveLoss) resolveCost = 0
    const normalStrike = normalStrikesRemaining > 0
    if (!normalStrike && !effect?.strike) continue
    const target = selectEnemyTarget(enemyLetters, tile.letter)
    if (!target) continue
    if (effect?.strike) usesStrike = true
    hits.push({ tileId: tile.id, enemyLetterId: target.id, letter: target.letter, hitsBefore: target.hitsRemaining, hitsAfter: target.hitsRemaining - 1 })
    target.hitsRemaining -= 1
    // Guaranteed tile hits leave semantic/grammar strikes for other tiles.
    // Archived daily versions retain their original overlapping allowance.
    if (normalStrike && (!effect?.strike || state.encounter.strikeConsumesAllowance === true)) {
      normalStrikesRemaining -= 1
    }
  }
  return {
    word,
    semanticLabel,
    grammaticalModifier,
    grammaticalPartOfSpeech,
    strikes: hits.length,
    resolveCost,
    effectLabels: [...(usesStrike ? ['STRIKE'] : []), ...(resolveCost === 0 ? ['WARD'] : [])],
    enemyLetters,
    hits,
    letterOutcomes: buildLetterStrikeOutcomes(state.enemyLetters, hits),
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
      grammaticalModifier: 0, grammaticalPartOfSpeech: null,
      letterOutcomes: buildLetterStrikeOutcomes(state.enemyLetters, []),
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
