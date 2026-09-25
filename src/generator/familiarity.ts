/** Corpus-backed authoring estimates. Legacy curated familiarity stays unchanged. */
import data from './data/familiarity-v1.json' with { type: 'json' }

export const GENERATION_COMMONNESS_SOURCE = `${data.version}:zipf-minus1-div4:${data.dictionaryDigest}`
export const GENERATION_FAMILIARITY_METADATA = Object.freeze({
  version: data.version, source: Object.freeze(data.source), dictionaryVersion: data.dictionaryVersion,
  dictionaryDigest: data.dictionaryDigest, scale: Object.freeze(data.scale), counts: Object.freeze(data.counts),
})

const frequencies = new Map<string, number>()
for (const [score, words] of data.bins as [number, string][]) {
  for (const word of words.split(' ')) if (word) frequencies.set(word, score / 100)
}
const vocabulary = Object.freeze([...frequencies.keys()].sort())
const observedVocabulary = Object.freeze(vocabulary.filter(word => frequencies.get(word)! > 0))
const familiarCache = new Map<number, readonly string[]>()

/** Every admitted spelling represented in the corpus, before a construction cutoff. */
export function getGenerationObservedVocabulary(): readonly string[] { return observedVocabulary }

/** Zero means below corpus coverage; null means outside the admitted dictionary. */
export function getGenerationWordZipf(word: string): number | null {
  return frequencies.get(word.trim().toUpperCase()) ?? null
}

/** Frequency is a familiarity proxy, not a semantic judgement or player survey. */
export function getGenerationWordCommonness(word: string): number | null {
  const zipf = getGenerationWordZipf(word)
  return zipf === null ? null : Math.max(0, Math.min(1, (zipf - 1) / 4))
}

export function getGenerationFamiliarVocabulary(minimum = 0.5): readonly string[] {
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) throw new Error('Familiarity minimum must be within [0, 1].')
  let words = familiarCache.get(minimum)
  if (!words) {
    words = Object.freeze(vocabulary.filter(word => getGenerationWordCommonness(word)! >= minimum))
    familiarCache.set(minimum, words)
  }
  return words
}
