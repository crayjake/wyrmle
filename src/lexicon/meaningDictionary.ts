/** Browser-safe, definition-backed validity source for new meaning rules. */
import data from './data/meaning-dictionary-v1.json' with { type: 'json' }
import type { PartOfSpeech } from '../game/types.ts'
import { getFunctionWord, getFunctionWords } from './functionWords.ts'

export const MEANING_DICTIONARY_VERSION = 'wyrmle-defined-dictionary-v2' as const
export type DictionaryMeaning = Readonly<{
  word: string
  senseId: string
  definition: string
  lemma: string
  partsOfSpeech: readonly PartOfSpeech[]
  source: 'oewn-2025' | 'wiktionary-en'
}>
const words = data.words as unknown as Record<string, [string, number, string, number]>
const parts: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
const decoded = Object.freeze(Array.from({ length: 16 }, (_, mask) =>
  Object.freeze(parts.filter((_, index) => mask & (1 << index)))))
const definedWords = Object.freeze([...new Set([...Object.keys(words), ...getFunctionWords()])].sort())

/** No source sense means not admitted to the new meaning-backed dictionary. */
export function getDictionaryMeaning(word: string): DictionaryMeaning | undefined {
  const key = word.trim().toUpperCase()
  const entry = words[key]
  if (entry) {
    const [senseId, definition, lemma, posMask] = entry
    // Preserve all previous records and their gameplay meanings verbatim.
    return Object.freeze({ word: key, senseId, definition: data.definitions[definition], lemma,
      partsOfSpeech: decoded[posMask], source: 'oewn-2025' })
  }
  const supplemental = getFunctionWord(key)
  const sense = supplemental?.senses[0]
  if (!sense?.definition.trim()) return undefined
  return Object.freeze({ word: key, senseId: sense.id, definition: sense.definition,
    lemma: supplemental!.lemma, partsOfSpeech: supplemental!.partsOfSpeech, source: 'wiktionary-en' })
}

export function getDefinedDictionaryWords(): readonly string[] { return definedWords }
