import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import type { PartOfSpeech } from './types.ts'

// Reused from bookworm-game: the word list is bundled, with no runtime requests.
const dictionary = new Set(englishWords)

export function normalizeWord(word: string): string {
  return word.trim().toUpperCase()
}

export function isDictionaryWord(word: string): boolean {
  return dictionary.has(normalizeWord(word).toLowerCase())
}

// Optional, deliberately small POS annotations; never a validity whitelist.
// Multiple entries mean ambiguous: grammar adds nothing for those words.
const partsOfSpeech: Readonly<Record<string, readonly PartOfSpeech[]>> = {
  SAD: ['adjective'],
  SADNESS: ['noun'],
  GLOOM: ['noun', 'verb'],
  GRIEF: ['noun'],
  SORROW: ['noun', 'verb'],
  BLUE: ['noun', 'adjective', 'verb'],
  JOY: ['noun', 'verb'],
  CHEER: ['noun', 'verb'],
  HAPPY: ['adjective'],
  DELIGHT: ['noun', 'verb'],
  ELATED: ['adjective', 'verb'],
  TEARS: ['noun', 'verb'],
  CRY: ['noun', 'verb'],
  LONELY: ['adjective'],
  MOOD: ['noun'],
  GLAD: ['adjective'],
  CHEERY: ['adjective'],
  CALM: ['noun', 'verb', 'adjective'],
  QUICKLY: ['adverb'],
  SOFTLY: ['adverb'],
  VERY: ['adjective', 'adverb'],
}

export function getPartsOfSpeech(word: string): readonly PartOfSpeech[] | undefined {
  return partsOfSpeech[normalizeWord(word)]
}
