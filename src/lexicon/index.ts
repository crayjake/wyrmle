import posData from './data/oewn-2025-pos-v1.json' with { type: 'json' }
import relationData from './data/oewn-2025-relations-v1.json' with { type: 'json' }
import metadata from './data/oewn-2025-metadata-v1.json' with { type: 'json' }
import type { PartOfSpeech } from '../game/types.ts'

/** Never silently replace this data for encounters pinned to an older version. */
export const LEXICON_VERSION = 'oewn-2025-pos-v1' as const
export type LexicalPosSource = 'wordnet' | 'morphology' | 'unknown'
export type LexicalRelations = {
  similar: readonly string[]
  opposite: readonly string[]
  related: readonly string[]
  provenance: {
    source: string
    sense: string
    synset: string
    definition: string
  }
}

const parts: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
const decoded: readonly (readonly PartOfSpeech[])[] = Object.freeze(Array.from({ length: 16 }, (_, mask) =>
  Object.freeze(parts.filter((_, index) => mask & (1 << index)))))
function unpack(groups: Readonly<Record<string, string>>): Map<string, number> {
  const result = new Map<string, number>()
  for (const [mask, words] of Object.entries(groups)) {
    for (const word of words.split(' ')) if (word) result.set(word, Number(mask))
  }
  return result
}
const wordnet = unpack(posData.wordnet)
const morphology = unpack(posData.morphology)
const normalize = (word: string) => word.trim().toUpperCase()

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}
export const lexiconMetadata = freezeDeep(metadata)
const relations = freezeDeep(relationData) as Readonly<Record<string, LexicalRelations>>

/** Union of all attested categories and documented regular inflections. */
export function getLexicalPartsOfSpeech(word: string): readonly PartOfSpeech[] | undefined {
  const key = normalize(word)
  const mask = (wordnet.get(key) ?? 0) | (morphology.get(key) ?? 0)
  return mask ? decoded[mask] : undefined
}

/** A directly attested spelling takes precedence; extra inferred POS is auditable below. */
export function getLexicalPosSource(word: string): LexicalPosSource {
  const key = normalize(word)
  return wordnet.has(key) ? 'wordnet' : morphology.has(key) ? 'morphology' : 'unknown'
}

export function getLexicalPosEvidence(word: string): {
  wordnet: readonly PartOfSpeech[]
  morphology: readonly PartOfSpeech[]
} {
  const key = normalize(word)
  return { wordnet: decoded[wordnet.get(key) ?? 0], morphology: decoded[morphology.get(key) ?? 0] }
}

/** Absence is unknown. These sparse links are not a classifier of all meanings. */
export function getLexicalRelations(enemy: string): LexicalRelations | undefined {
  return relations[normalize(enemy)]
}
