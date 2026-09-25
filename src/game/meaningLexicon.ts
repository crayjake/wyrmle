import { canSpellDictionaryWord, isDictionaryWord, normalizeWord } from './dictionary.ts'
import { getSemanticRelation } from './semantic.ts'
import type { LetterStrikeEncounter } from './letterStrike.ts'
import type { PartOfSpeech, SemanticRelation } from './types.ts'

export const MEANING_LEXICON_VERSION = 'wyrmle-puzzle-meanings-1' as const

export type PuzzleWordMeaning = {
  definition: string
  lemma: string
  senseId: string
  partsOfSpeech: readonly PartOfSpeech[]
  relation: SemanticRelation
  reason: string
  source: 'oewn-2025'
  evidence: 'reviewed-profile' | 'lexical-expansion' | 'defined-neutral'
}

/** Generated before solving; this same frozen table decides validity and hits. */
export type PuzzleMeaningLexicon = {
  version: typeof MEANING_LEXICON_VERSION
  dictionaryVersion: string
  profileVersion: string
  policy: 'defined-only'
  enemyWord: string
  /** Sorted physical multiset, including the complete finite refill queue. */
  letterSupply: string
  minimumWordLength: number
  maximumWordLength: number
  words: Readonly<Record<string, PuzzleWordMeaning>>
}

export function meaningSupply(encounter: Pick<LetterStrikeEncounter, 'startingTiles' | 'refillQueue'>): string {
  return [...encounter.startingTiles.map(tile => tile.letter).join('') + encounter.refillQueue].map(letter => letter.toUpperCase()).sort().join('')
}

export function getStoredWordMeaning(encounter: LetterStrikeEncounter, word: string): PuzzleWordMeaning | undefined {
  return encounter.meaningLexicon?.words[normalizeWord(word)]
}

export function isEncounterWord(encounter: LetterStrikeEncounter, word: string): boolean {
  return encounter.meaningLexicon ? Boolean(getStoredWordMeaning(encounter, word)?.definition.trim()) : isDictionaryWord(word)
}

export function getEncounterSemanticRelation(encounter: LetterStrikeEncounter, word: string): SemanticRelation {
  return encounter.meaningLexicon ? getStoredWordMeaning(encounter, word)?.relation ?? 'unrelated'
    : getSemanticRelation(word, encounter.enemy)
}

type Signature = readonly (readonly [index: number, count: number])[]
const spellingIndices = new WeakMap<PuzzleMeaningLexicon, readonly Signature[]>()
const spellingCaches = new WeakMap<PuzzleMeaningLexicon, Map<string, boolean>>()

/** Terminal detection uses the puzzle dictionary too, including exhausted boards. */
export function canSpellEncounterWord(encounter: LetterStrikeEncounter, letters: readonly string[]): boolean {
  const lexicon = encounter.meaningLexicon
  if (!lexicon) return canSpellDictionaryWord(letters, encounter.minimumWordLength)
  const available = new Uint8Array(26)
  for (const letter of letters) {
    if (/^[a-z]$/i.test(letter)) available[letter.toUpperCase().charCodeAt(0) - 65]++
  }
  const key = [...available].join(',')
  let cache = spellingCaches.get(lexicon)
  if (!cache) spellingCaches.set(lexicon, cache = new Map())
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  let signatures = spellingIndices.get(lexicon)
  if (!signatures) {
    const seen = new Set<string>()
    signatures = Object.keys(lexicon.words).sort((a, b) => a.length - b.length || a.localeCompare(b)).flatMap(word => {
      if (word.length < encounter.minimumWordLength) return []
      const counts = new Uint8Array(26)
      for (const letter of word) counts[letter.charCodeAt(0) - 65]++
      const signature = [...counts].join(',')
      if (seen.has(signature)) return []
      seen.add(signature)
      return [[...counts.entries()].filter(([, count]) => count > 0)]
    })
    spellingIndices.set(lexicon, signatures)
  }
  const result = signatures.some(signature => signature.every(([index, count]) => count <= available[index]))
  if (cache.size >= 1024) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}

export function validateMeaningLexicon(encounter: LetterStrikeEncounter): void {
  const lexicon = encounter.meaningLexicon
  if (!lexicon) return
  if (lexicon.version !== MEANING_LEXICON_VERSION || lexicon.policy !== 'defined-only'
    || lexicon.enemyWord !== normalizeWord(encounter.enemy.word)
    || lexicon.letterSupply !== meaningSupply(encounter)
    || lexicon.minimumWordLength !== encounter.minimumWordLength
    || lexicon.maximumWordLength !== encounter.startingTiles.length) {
    throw new Error('Puzzle meaning data is missing, unsupported, or stale. Recompile it before solving.')
  }
  if (Object.values(encounter.grammarModifiers ?? {}).some(value => value !== 0) || encounter.longWordRule) {
    throw new Error('Meaning-only puzzles cannot award word-type or long-word bonuses.')
  }
  for (const [word, entry] of Object.entries(lexicon.words)) {
    if (!/^[A-Z]+$/.test(word) || word.length < lexicon.minimumWordLength || word.length > lexicon.maximumWordLength
      || !entry.definition?.trim() || !entry.senseId || !entry.lemma || !entry.reason
      || entry.source !== 'oewn-2025' || !['opposite', 'similar', 'related', 'unrelated'].includes(entry.relation)) {
      throw new Error(`Missing definition or semantic evidence for ${word}.`)
    }
  }
}
