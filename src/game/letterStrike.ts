import { canSpellDictionaryWord, isDictionaryWord, normalizeWord, prototypeWordPartsOfSpeech } from './dictionary.ts'
import { getSemanticRelation } from './semantic.ts'
import { getSelectedTiles, refillBoard } from './tiles.ts'
import type { EnemyConcept, PartOfSpeech } from './types.ts'
import { getEncounterPartsOfSpeech, validateLexicalRules } from './lexicalRules.ts'
import type { LexicalRules } from './lexicalRules.ts'

export type LetterStrikeGem = 'strike' | 'ward' | 'regen'
export type LetterStrikeTileEffect = { strike: boolean; preventResolveLoss: boolean; regenerate?: boolean }
export type LetterStrikeTile = {
  id: number
  letter: string
  type: 'normal' | 'gem'
  gem?: LetterStrikeGem
}
export type EnemyLetter = { id: string; letter: string; hitsRemaining: number; initialHits: number; armourGained?: true }
export type LetterStrikeEncounter = {
  id: string
  enemy: Pick<EnemyConcept, 'word' | 'definition' | 'partOfSpeech' | 'semanticRelations'>
  enemyLetters: readonly EnemyLetter[]
  startingResolve: number
  startingTiles: readonly LetterStrikeTile[]
  refillQueue: string
  // Exhausted supply leaves inert empty cells; omission preserves archived rules.
  finiteRefills?: true
  minimumWordLength: number
  grammarModifiers?: Partial<Record<PartOfSpeech, number>>
  wordPartsOfSpeech?: Readonly<Record<string, readonly PartOfSpeech[]>>
  // Omission preserves the exact sparse, single-POS rules of archived saves.
  lexicalRules?: LexicalRules
  longWordRule?: { minimumLength: number; bonusStrikes: number }
  // Only archived encounters opt into the original overlapping Strike rule.
  strikeConsumesAllowance?: boolean
  // REGEN is opt-in so archived encounters and their saved previews stay exact.
  tileEffects: Record<'strike' | 'ward', LetterStrikeTileEffect> & { regen?: LetterStrikeTileEffect }
}
export type LetterStrikeHit = {
  tileId: number
  enemyLetterId: string
  letter: string
  hitsBefore: number
  hitsAfter: number
}
export type LetterStrikeRecovery = {
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
  regenerated?: true
  recoveryCount?: number
}
export type LetterStrikeEvaluation = {
  word: string
  semanticLabel: 'COUNTER' | 'NEUTRAL' | 'RESISTED'
  longWordModifier: number
  grammaticalModifier: number
  grammaticalPartOfSpeech: PartOfSpeech | null
  strikes: number
  resolveCost: number
  effectLabels: string[]
  enemyLetters: EnemyLetter[]
  hits: LetterStrikeHit[]
  recoveries?: LetterStrikeRecovery[]
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
  id: 'prototype-melancholy-letter-strike-v4',
  enemy: {
    word: 'MELANCHOLY',
    definition: 'a feeling of pensive sadness, typically with no obvious cause',
    partOfSpeech: 'noun',
    semanticRelations: {
      opposite: ['JOY', 'CHEER', 'GLAD', 'GAY', 'HAPPY', 'DELIGHT', 'ELATED', 'MERRY'],
      similar: ['SAD', 'SADNESS', 'GLOOM', 'GLOOMY', 'GRIEF', 'SORROW', 'BLUE'],
      related: ['TEARS', 'CRY', 'LONELY', 'MOOD'],
    },
  },
  enemyLetters: [...'MELANCHOLY'].map((letter, index) => {
    const initialHits = index === 0 || letter === 'Y' ? 2 : 1
    return { id: `enemy-${index}`, letter, hitsRemaining: initialHits, initialHits }
  }),
  startingResolve: 5,
  startingTiles: [...'JOYT CHER GLOM SADE'.replaceAll(' ', '')].map((letter, id) => ({
    id,
    letter,
    type: id === 15 || id === 9 ? 'gem' : 'normal',
    ...(id === 15 ? { gem: 'ward' as const } : id === 9 ? { gem: 'strike' as const } : {}),
  })),
  // Early R/E/Y keep counters available; N arrives for remaining enemy letters.
  // Later PPY supports HAPPY; long-neutral anchors alternate with counters/bait.
  refillQueue: 'RYE' + 'RELAT' + 'MENDN' + 'JOYSAD' + 'PPY' + 'MERRY' + 'DELIGHT'
    + 'LEMONS' + 'CLOSET' + 'THREAD' + 'HAPPY' + 'NEAR' + 'ELATED' + 'SAD'
    + 'GLOOM' + 'MERRY' + 'LEMONS' + 'THREAD' + 'CLOSET' + 'NEAR' + 'JOY',
  minimumWordLength: 3,
  grammarModifiers: { adjective: 1 },
  wordPartsOfSpeech: prototypeWordPartsOfSpeech,
  longWordRule: { minimumLength: 6, bonusStrikes: 1 },
  tileEffects: {
    strike: { strike: true, preventResolveLoss: false },
    ward: { strike: false, preventResolveLoss: true },
  },
}

export function createLetterStrikeGame(encounter = letterStrikeEncounter): LetterStrikeState {
  validateLexicalRules(encounter)
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
  if (encounter.longWordRule && (!Number.isSafeInteger(encounter.longWordRule.minimumLength)
    || encounter.longWordRule.minimumLength < 1 || !Number.isSafeInteger(encounter.longWordRule.bonusStrikes)
    || encounter.longWordRule.bonusStrikes < 0)) {
    throw new Error('Long-word rules need a positive minimum length and a nonnegative integer bonus.')
  }
  if (enemyLetters.length === 0 || new Set(enemyLetters.map(letter => letter.id)).size !== enemyLetters.length
    || enemyLetters.some(letter => !/^[a-z]$/i.test(letter.letter)
      || ![1, 2].includes(letter.initialHits) || letter.hitsRemaining !== letter.initialHits)) {
    throw new Error('Enemy letters need distinct identities and one or two starting hits.')
  }
  const wardTurns = startingTiles.filter(tile => tile.type === 'gem' && tile.gem && tileEffects[tile.gem]?.preventResolveLoss).length
  if (encounter.finiteRefills ? !/^[a-z]*$/i.test(encounter.refillQueue)
    : !/^[a-z]+$/i.test(encounter.refillQueue) || encounter.refillQueue.length < (startingResolve + wardTurns) * 16) {
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
    status: encounter.finiteRefills && !canSpellDictionaryWord(startingTiles.map(tile => tile.letter), encounter.minimumWordLength)
      ? 'lost' : 'playing',
    error: null,
  }
}

export function toggleLetterStrikeTile(state: LetterStrikeState, id: number): LetterStrikeState {
  if (state.status !== 'playing' || !state.tiles.some(tile => tile.id === id && tile.letter !== '')) return state
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
  return matches.find(target => target.hitsRemaining < target.initialHits
    || (target.armourGained && target.hitsRemaining === 1)) ?? matches[0]
}

// Recover a dead copy before adding armour to a living copy. Array order is
// the stable enemy-slot order; already armoured and unrelated slots never heal.
export function selectEnemyRecoveryTarget(letters: readonly EnemyLetter[], letter: string): EnemyLetter | undefined {
  const matches = letters.filter(target => target.letter === letter.toUpperCase())
  return matches.find(target => target.hitsRemaining === 0) ?? matches.find(target => target.hitsRemaining === 1)
}

// A counter already permits all available matching tiles. Positive grammar
// cannot add phantom hits; negative grammar reduces that finite capacity.
// Only neutral words can gain LONG. Grammar then modifies the resulting budget.
export function getLetterStrikeAllowance(encounter: LetterStrikeEncounter, word: string, matchingCapacity: number): {
  semanticLabel: LetterStrikeEvaluation['semanticLabel']
  longWordModifier: number
  grammaticalModifier: number
  grammaticalPartOfSpeech: PartOfSpeech | null
  normalStrikeAllowance: number
} {
  const relation = getSemanticRelation(word, encounter.enemy)
  const semanticLabel = relation === 'opposite' ? 'COUNTER' : relation === 'similar' ? 'RESISTED' : 'NEUTRAL'
  const parts = getEncounterPartsOfSpeech(encounter, word)
  // A submitted word has no sentence to disambiguate its use. Under new rules,
  // any recognized use qualifies; choose one best modifier, never stack types.
  const partOfSpeech = encounter.lexicalRules && parts?.length
    ? [...parts].sort((a, b) => (encounter.grammarModifiers?.[b] ?? 0) - (encounter.grammarModifiers?.[a] ?? 0))[0]
    : parts?.length === 1 ? parts[0] : null
  const configuredModifier = partOfSpeech ? encounter.grammarModifiers?.[partOfSpeech] ?? 0 : 0
  const base = semanticLabel === 'COUNTER' ? matchingCapacity : semanticLabel === 'NEUTRAL' ? 1 : 0
  const longWordModifier = semanticLabel === 'NEUTRAL' && encounter.longWordRule
    && normalizeWord(word).length >= encounter.longWordRule.minimumLength ? encounter.longWordRule.bonusStrikes : 0
  const allowanceBeforeGrammar = base + longWordModifier
  const normalStrikeAllowance = Math.max(0, Math.min(
    semanticLabel === 'COUNTER' ? matchingCapacity : Number.POSITIVE_INFINITY,
    allowanceBeforeGrammar + configuredModifier,
  ))
  const grammaticalModifier = normalStrikeAllowance - allowanceBeforeGrammar
  return {
    semanticLabel,
    longWordModifier,
    grammaticalModifier,
    grammaticalPartOfSpeech: grammaticalModifier !== 0 ? partOfSpeech : null,
    normalStrikeAllowance,
  }
}

// One entry per original slot. Strikes resolve first, then recoveries; the
// visible outcome must describe the final state, including a revived letter.
export function buildLetterStrikeOutcomes(
  letters: readonly EnemyLetter[], hits: readonly LetterStrikeHit[], recoveries: readonly LetterStrikeRecovery[] = [],
): LetterStrikeLetterOutcome[] {
  const finalHits = new Map([...hits, ...recoveries].map(event => [event.enemyLetterId, event.hitsAfter]))
  const armourBreaks = new Set(hits.filter(hit => hit.hitsBefore > 1 && hit.hitsAfter <= 1).map(hit => hit.enemyLetterId))
  return letters.map((letter, position) => {
    const hitsAfter = finalHits.get(letter.id) ?? letter.hitsRemaining
    const recoveryCount = recoveries.filter(event => event.enemyLetterId === letter.id).length
    return {
      enemyLetterId: letter.id,
      position,
      hitsBefore: letter.hitsRemaining,
      hitsAfter,
      armourBroken: armourBreaks.has(letter.id) && hitsAfter < 2,
      removed: letter.hitsRemaining > 0 && hitsAfter === 0,
      ...(recoveryCount ? { regenerated: true as const, recoveryCount } : {}),
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
  const { semanticLabel, longWordModifier, grammaticalModifier, grammaticalPartOfSpeech, normalStrikeAllowance } = getLetterStrikeAllowance(state.encounter, word, matchingCapacity)
  const enemyLetters = state.enemyLetters.map(letter => ({ ...letter }))
  const hits: LetterStrikeHit[] = []
  const seenTiles = new Set<number>()
  let normalStrikesRemaining = normalStrikeAllowance
  let resolveCost = 1
  let usesStrike = false
  const regenTiles: LetterStrikeTile[] = []
  for (const tile of tiles) {
    // The public scorer also respects physical tile identity if called directly.
    if (seenTiles.has(tile.id)) continue
    seenTiles.add(tile.id)
    const effect = tile.type === 'gem' && tile.gem ? state.encounter.tileEffects[tile.gem] : undefined
    if (effect?.preventResolveLoss) resolveCost = 0
    if (effect?.regenerate) regenTiles.push(tile)
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
  const recoveries: LetterStrikeRecovery[] = []
  for (const tile of regenTiles) {
    const target = selectEnemyRecoveryTarget(enemyLetters, tile.letter)
    if (!target) continue
    recoveries.push({ tileId: tile.id, enemyLetterId: target.id, letter: target.letter,
      hitsBefore: target.hitsRemaining, hitsAfter: target.hitsRemaining + 1 })
    target.hitsRemaining += 1
    // Preserve the original authored HP while remembering that a later wound
    // belongs to armour, so duplicate targeting still finishes wounded armour.
    if (target.hitsRemaining === 2 && target.initialHits === 1) target.armourGained = true
  }
  return {
    word,
    semanticLabel,
    longWordModifier,
    grammaticalModifier,
    grammaticalPartOfSpeech,
    strikes: hits.length,
    resolveCost,
    effectLabels: [...(usesStrike ? ['STRIKE'] : []), ...(resolveCost === 0 ? ['WARD'] : []), ...(regenTiles.length ? ['REGEN'] : [])],
    enemyLetters,
    hits,
    ...(regenTiles.length ? { recoveries } : {}),
    letterOutcomes: buildLetterStrikeOutcomes(state.enemyLetters, hits, recoveries),
  }
}

export function previewLetterStrike(state: LetterStrikeState, selectedTileIds: readonly number[] = state.selectedTileIds): LetterStrikePreview {
  const tiles = getSelectedTiles(state, selectedTileIds)
  const evaluation = evaluateLetterStrike(state, tiles)
  const error = state.status !== 'playing' ? 'Encounter finished'
    : new Set(selectedTileIds).size !== selectedTileIds.length ? 'Cannot use the same tile twice'
    : tiles.length !== selectedTileIds.length ? 'Selected tile is not on the board'
    : tiles.some(tile => tile.letter === '') ? 'Empty cells cannot be selected'
    : evaluation.word.length < state.encounter.minimumWordLength ? `Minimum ${state.encounter.minimumWordLength} letters`
    : !isDictionaryWord(evaluation.word) ? 'Not a valid word'
    : null
  return {
    ...evaluation,
    valid: error === null,
    error,
    ...(error !== null ? {
      strikes: 0, resolveCost: 0, effectLabels: [], hits: [],
      ...(evaluation.recoveries ? { recoveries: [] } : {}),
      longWordModifier: 0, grammaticalModifier: 0, grammaticalPartOfSpeech: null,
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
  const refilled = refillBoard(state, selectedTileIds)
  const status = preview.enemyLetters.every(letter => letter.hitsRemaining === 0) ? 'won'
    : playerResolve === 0 || (state.encounter.finiteRefills
      && !canSpellDictionaryWord(refilled.tiles.map(tile => tile.letter), state.encounter.minimumWordLength)) ? 'lost' : 'playing'
  return {
    ...state,
    ...refilled,
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
