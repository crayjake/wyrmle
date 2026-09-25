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

let spellableSignatures: ReadonlyMap<number, ReadonlySet<string>> | undefined
const spellableCache = new Map<string, boolean>()

/** Exact tile-multiset existence check. Empty cells supply no letter. */
export function canSpellDictionaryWord(letters: readonly string[], minimumLength = 3): boolean {
  const available = letters.filter(letter => /^[a-z]$/i.test(letter)).map(letter => letter.toUpperCase()).sort()
  if (available.length < minimumLength) return false
  const cacheKey = `${minimumLength}:${available.join('')}`
  const cached = spellableCache.get(cacheKey)
  if (cached !== undefined) return cached
  if (!spellableSignatures) {
    const signatures = new Map<number, Set<string>>()
    for (const word of englishWords) {
      // Letter Strike has sixteen cells and accepts alphabetic tile words only.
      if (word.length > 16 || !/^[a-z]+$/i.test(word)) continue
      let bucket = signatures.get(word.length)
      if (!bucket) signatures.set(word.length, bucket = new Set())
      bucket.add([...word.toUpperCase()].sort().join(''))
    }
    spellableSignatures = signatures
  }
  // Enumerate combinations, not permutations: each physical letter can occur
  // once. Short words are tried first; repeated-letter choices are identical.
  const matches = (bucket: ReadonlySet<string>, length: number, from = 0, prefix = ''): boolean => {
    if (length === 0) return bucket.has(prefix)
    for (let index = from; index <= available.length - length; index++) {
      if (index > from && available[index] === available[index - 1]) continue
      if (matches(bucket, length - 1, index + 1, prefix + available[index])) return true
    }
    return false
  }
  let result = false
  for (let length = minimumLength; length <= available.length; length++) {
    const bucket = spellableSignatures.get(length)
    if (bucket && matches(bucket, length)) { result = true; break }
  }
  // Bound this runtime optimization even during a long offline solver search.
  if (spellableCache.size >= 1024) spellableCache.delete(spellableCache.keys().next().value!)
  spellableCache.set(cacheKey, result)
  return result
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

// Authored encounter annotations are opt-in. Keep the original lookup stable
// so adding prototype vocabulary cannot rewrite archived daily results.
export const prototypeWordPartsOfSpeech: Readonly<Record<string, readonly PartOfSpeech[]>> = {
  SAD: ['adjective'],
  GLAD: ['adjective'],
  SANDY: ['adjective'],
  GAY: ['adjective'],
  GLOOMY: ['adjective'],
  COMELY: ['adjective'],
  HOMELY: ['adjective'],
  STEADY: ['adjective'],
  STORMY: ['adjective'],
  DREAMY: ['adjective'],
  HEARTY: ['adjective'],
  LOAMY: ['adjective'],
  MERRY: ['adjective'],
  GLOOM: ['noun'],
  JOY: ['noun'],
  CHEER: ['noun', 'verb'],
  CLOSET: ['noun'],
  THREAD: ['noun', 'verb'],
}
