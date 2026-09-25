import data from './data/function-words-v1.json' with { type: 'json' }
import type { PartOfSpeech } from '../game/types.ts'

export type FunctionWordSense = Readonly<{
  id: string
  sourceSenseId?: string
  partOfSpeech: PartOfSpeech
  definition: string
  glosses: readonly string[]
  tags: readonly string[]
  sourceUrl: string
}>
export type FunctionWord = Readonly<{
  lemma: string
  partsOfSpeech: readonly PartOfSpeech[]
  senses: readonly FunctionWordSense[]
}>

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}

const words = freezeDeep(data.words) as unknown as Readonly<Record<string, FunctionWord>>
const coveredWords = Object.freeze(Object.keys(words).sort())
export const FUNCTION_WORDS_VERSION = data.version

/** Stored licensed senses, never a runtime word-specific acceptance exception. */
export function getFunctionWord(word: string): FunctionWord | undefined {
  return words[word.trim().toUpperCase()]
}

export function getFunctionWords(): readonly string[] { return coveredWords }
