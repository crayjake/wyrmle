import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import { getPartsOfSpeech, isDictionaryWord, normalizeWord } from '../game/dictionary.ts'
import { submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEvaluation, LetterStrikeState, LetterStrikeTile } from '../game/letterStrike.ts'
import type { PartOfSpeech } from '../game/types.ts'

export type SolverMoveSummary = {
  word: string
  tileIds: number[]
  semanticLabel: LetterStrikeEvaluation['semanticLabel']
  partsOfSpeech: readonly PartOfSpeech[]
  grammarModifier: number
  longWordModifier: number
  wardUsed: boolean
  strikeUsed: boolean
  strikes: number
  resolveCost: number
  hits: LetterStrikeEvaluation['hits']
  letterOutcomes: LetterStrikeEvaluation['letterOutcomes']
}

export type SolverMove = SolverMoveSummary & { resultingState: LetterStrikeState }
export type MoveDiscoveryOptions = {
  /** Omit to search the entire bundled game dictionary. A subset never proves impossibility. */
  vocabulary?: readonly string[]
  maxMoves?: number
  maxSelections?: number
  wordCommonness?: (word: string) => number
}
export type MoveDiscovery = {
  moves: SolverMove[]
  complete: boolean
  vocabularyComplete: boolean
  legalSelectionsExamined: number
}

let dictionaryMasks: Uint32Array | undefined
const playableCache = new Map<string, string[]>()

function getDictionaryMasks(): Uint32Array {
  if (dictionaryMasks) return dictionaryMasks
  dictionaryMasks = new Uint32Array(englishWords.length)
  for (let wordIndex = 0; wordIndex < englishWords.length; wordIndex += 1) {
    let mask = 0
    for (const letter of englishWords[wordIndex]) {
      const index = letter.charCodeAt(0) - 97
      if (index < 0 || index >= 26) { mask = 0x80000000; break }
      mask |= 1 << index
    }
    dictionaryMasks[wordIndex] = mask
  }
  return dictionaryMasks
}

/** Anagrams share this inexpensive dictionary query; physical IDs are handled below. */
export function findPlayableWords(state: LetterStrikeState, vocabulary?: readonly string[]): string[] {
  if (state.status !== 'playing') return []
  const counts = new Uint8Array(26)
  let mask = 0
  for (const tile of state.tiles) {
    const index = tile.letter.toUpperCase().charCodeAt(0) - 65
    counts[index] += 1
    mask |= 1 << index
  }
  if (vocabulary) {
    return [...new Set(vocabulary.map(normalizeWord))].filter(word => {
      if (word.length < state.encounter.minimumWordLength || word.length > state.tiles.length || !isDictionaryWord(word)) return false
      const used = new Uint8Array(26)
      for (const letter of word) {
        const index = letter.charCodeAt(0) - 65
        used[index] += 1
        if (used[index] > counts[index]) return false
      }
      return true
    }).sort()
  }
  const key = `${state.encounter.minimumWordLength}:${[...counts].join(',')}`
  const cached = playableCache.get(key)
  if (cached) return [...cached]
  const words: string[] = []
  const masks = getDictionaryMasks()
  const used = new Uint8Array(26)
  for (let wordIndex = 0; wordIndex < englishWords.length; wordIndex += 1) {
    const entry = englishWords[wordIndex]
    if (entry.length < state.encounter.minimumWordLength || entry.length > state.tiles.length || (masks[wordIndex] & ~mask) !== 0) continue
    used.fill(0)
    let feasible = true
    for (let position = 0; position < entry.length; position += 1) {
      const index = entry.charCodeAt(position) - 97
      used[index] += 1
      if (used[index] > counts[index]) { feasible = false; break }
    }
    if (feasible) words.push(entry.toUpperCase())
  }
  if (playableCache.size >= 512) playableCache.delete(playableCache.keys().next().value!)
  playableCache.set(key, words)
  return words
}

export function moveSummary(move: SolverMove): SolverMoveSummary {
  const { resultingState: _state, ...summary } = move
  return summary
}

/** This defines a sampling preference, never legality or a pruning proof. */
export function scoreImmediateMove(move: SolverMoveSummary, commonness?: (word: string) => number): number {
  const removed = move.letterOutcomes.filter(outcome => outcome.removed).length
  return move.strikes * 100 + removed * 12 + (move.wardUsed ? 35 : 0)
    + (commonness?.(move.word) ?? 0) * 10 + (move.semanticLabel === 'COUNTER' ? 5 : 0)
    - move.word.length * 0.01
}

function buildMove(state: LetterStrikeState, tileIds: number[]): SolverMove | null {
  // The real game validates, scores, consumes, refills, and resolves victory.
  const resultingState = submitLetterStrike(state, tileIds)
  if (resultingState.playedWords.length !== state.playedWords.length + 1) return null
  const preview = resultingState.playedWords[resultingState.playedWords.length - 1].preview
  return {
    word: preview.word,
    tileIds: [...tileIds],
    semanticLabel: preview.semanticLabel,
    partsOfSpeech: state.encounter.wordPartsOfSpeech?.[preview.word] ?? getPartsOfSpeech(preview.word) ?? [],
    grammarModifier: preview.grammaticalModifier,
    longWordModifier: preview.longWordModifier,
    wardUsed: preview.resolveCost === 0,
    strikeUsed: preview.effectLabels.includes('STRIKE'),
    strikes: preview.strikes,
    resolveCost: preview.resolveCost,
    hits: preview.hits,
    letterOutcomes: preview.letterOutcomes,
    resultingState,
  }
}

/**
 * Enumerates physical choices, including the order of same-letter specials.
 * Permuting identical normal (or same-gem) copies within the SAME selected set
 * is the sole symmetry removed: effects and board-slot refill are unchanged.
 * Choosing different consumed slots is always kept, even for normal duplicates.
 */
export function discoverValidMoves(state: LetterStrikeState, options: MoveDiscoveryOptions = {}): MoveDiscovery {
  const vocabularyComplete = options.vocabulary === undefined
  if (state.status !== 'playing') return { moves: [], complete: true, vocabularyComplete, legalSelectionsExamined: 0 }
  const maxMoves = options.maxMoves ?? Number.POSITIVE_INFINITY
  const maxSelections = options.maxSelections ?? Number.POSITIVE_INFINITY
  if (maxMoves < 1 || maxSelections < 1) return { moves: [], complete: false, vocabularyComplete, legalSelectionsExamined: 0 }
  const byLetter = new Map<string, LetterStrikeTile[]>()
  for (const tile of state.tiles) {
    const letter = tile.letter.toUpperCase()
    const bucket = byLetter.get(letter) ?? []
    bucket.push(tile)
    byLetter.set(letter, bucket)
  }
  const words = findPlayableWords(state, options.vocabulary)
  // Prioritize familiar semantic anchors before a selection budget can run out.
  const counters = new Set(state.encounter.enemy.semanticRelations.opposite.map(normalizeWord))
  const wordPriority = (word: string) => (counters.has(word) ? 100 : 0) + (options.wordCommonness?.(word) ?? 0) * 50
  const orderedWords = [...words].sort((a, b) => wordPriority(b) - wordPriority(a) || a.localeCompare(b))
  const moves: SolverMove[] = []
  const selected: number[] = []
  const used = new Set<number>()
  const lastEquivalent = new Map<string, number>()
  let complete = true
  let legalSelectionsExamined = 0
  function visit(word: string, position: number): boolean {
    if (position === word.length) {
      if (legalSelectionsExamined >= maxSelections) return false
      const move = buildMove(state, selected)
      legalSelectionsExamined += 1
      if (move) moves.push(move)
      return true
    }
    for (const tile of byLetter.get(word[position]) ?? []) {
      if (used.has(tile.id)) continue
      const equivalent = `${word[position]}:${tile.type}:${tile.gem ?? ''}`
      const previous = lastEquivalent.get(equivalent)
      if (previous !== undefined && tile.id <= previous) continue
      used.add(tile.id)
      selected.push(tile.id)
      lastEquivalent.set(equivalent, tile.id)
      const completed = visit(word, position + 1)
      if (previous === undefined) lastEquivalent.delete(equivalent)
      else lastEquivalent.set(equivalent, previous)
      selected.pop()
      used.delete(tile.id)
      if (!completed) return false
    }
    return true
  }
  for (const word of orderedWords) {
    if (!visit(word, 0)) { complete = false; break }
  }
  moves.sort((a, b) => scoreImmediateMove(b, options.wordCommonness) - scoreImmediateMove(a, options.wordCommonness)
    || a.word.localeCompare(b.word) || a.tileIds.join(',').localeCompare(b.tileIds.join(',')))
  if (moves.length > maxMoves) {
    complete = false
    // A bounded sample should expose different words rather than spending its
    // entire budget on normal-ID variants of one high-scoring spelling.
    const perWord = Math.max(2, Math.ceil(maxMoves / 12))
    const counts = new Map<string, number>()
    const chosen = new Set<SolverMove>()
    for (const move of moves) {
      if ((counts.get(move.word) ?? 0) >= perWord) continue
      chosen.add(move)
      counts.set(move.word, (counts.get(move.word) ?? 0) + 1)
      if (chosen.size >= maxMoves) break
    }
    for (const move of moves) {
      if (chosen.size >= maxMoves) break
      chosen.add(move)
    }
    return { moves: moves.filter(move => chosen.has(move)), complete, vocabularyComplete, legalSelectionsExamined }
  }
  return { moves, complete, vocabularyComplete, legalSelectionsExamined }
}

/** For completeness/cutoff metadata use discoverValidMoves. */
export function findValidMoves(state: LetterStrikeState, options: MoveDiscoveryOptions = {}): SolverMove[] {
  return discoverValidMoves(state, options).moves
}
