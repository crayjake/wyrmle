/** Browser-safe, definition-backed validity source for new meaning rules. */
import data from './data/meaning-dictionary-v1.json' with { type: 'json' }
import type { PartOfSpeech } from '../game/types.ts'

export const MEANING_DICTIONARY_VERSION = 'oewn-2025-meanings-v1' as const
export type DictionaryMeaning = Readonly<{
  word: string
  senseId: string
  definition: string
  lemma: string
  partsOfSpeech: readonly PartOfSpeech[]
}>
const words = data.words as unknown as Record<string, [string, number, string, number]>
const parts: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
const decoded = Object.freeze(Array.from({ length: 16 }, (_, mask) =>
  Object.freeze(parts.filter((_, index) => mask & (1 << index)))))
const definedWords = Object.freeze(Object.keys(words).sort())

/** No source sense means not admitted to the new meaning-backed dictionary. */
export function getDictionaryMeaning(word: string): DictionaryMeaning | undefined {
  const key = word.trim().toUpperCase()
  const entry = words[key]
  if (!entry) return undefined
  const [senseId, definition, lemma, posMask] = entry
  return Object.freeze({ word: key, senseId, definition: data.definitions[definition], lemma,
    partsOfSpeech: decoded[posMask] })
}

export function getDefinedDictionaryWords(): readonly string[] { return definedWords }
