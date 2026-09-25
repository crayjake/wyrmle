/**
 * Complete, licensed sense evidence for OFFLINE puzzle authoring and validation.
 *
 * This module is deliberately separate from index.ts: Node reads the compressed
 * catalog lazily; the browser should receive only a puzzle's reviewed records.
 * Definitions are evidence, not an automatic judgement of semantic opposition.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import metadata from '../../src/lexicon/data/oewn-2025-meanings-v1-metadata.json' with { type: 'json' }
import type { PartOfSpeech } from '../../src/game/types.ts'

export const WORD_MEANINGS_VERSION = 'oewn-2025-meanings-v1' as const
type EncodedEdge = [type: string, target: number, qualifier?: string]
type EncodedEntry = [id: string, lemma: string, pos: string, senses: number[]]
type EncodedSense = [id: string, entry: number, synset: number, relations: EncodedEdge[]]
type EncodedSynset = [id: string, pos: string, definitions: string[], relations: EncodedEdge[]]
type Catalog = {
  version: typeof WORD_MEANINGS_VERSION
  words: Record<string, [entry: number, form: number][]>
  entries: EncodedEntry[]
  senses: EncodedSense[]
  synsets: EncodedSynset[]
}

export type MeaningRelation = Readonly<{ type: string; target: string; qualifier?: string }>
export type MeaningSense = Readonly<{
  id: string
  synset: string
  lemma: string
  partOfSpeech: PartOfSpeech
  definition: string
  definitions: readonly string[]
  relations: readonly MeaningRelation[]
}>
export type WordMeaningSense = MeaningSense & Readonly<{ form: 'lemma' | 'explicit' | 'morphology' }>
export type WordMeanings = Readonly<{
  word: string
  version: typeof WORD_MEANINGS_VERSION
  status: 'covered' | 'missing'
  senses: readonly WordMeaningSense[]
}>
export type MeaningSynset = Readonly<{
  id: string
  partOfSpeech: PartOfSpeech
  definition: string
  definitions: readonly string[]
  senses: readonly string[]
  relations: readonly MeaningRelation[]
}>

const parts: Record<string, PartOfSpeech> = {
  n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb',
}
const formNames = ['lemma', 'explicit', 'morphology'] as const
const normalize = (word: string) => word.trim().toUpperCase()
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}
export const wordMeaningsMetadata = freezeDeep(metadata)
let catalog: Catalog | undefined
let senseIndices: Map<string, number>
let synsetIndices: Map<string, number>
let synsetSenses: Map<number, string[]>
const senseCache = new Map<string, MeaningSense>()
const synsetCache = new Map<string, MeaningSynset>()
const wordCache = new Map<string, WordMeanings>()
let coveredWords: readonly string[] | undefined

function loadCatalog(): Catalog {
  if (!catalog) {
    const bytes = readFileSync(new URL('../../src/lexicon/data/oewn-2025-meanings-v1.json.gz', import.meta.url))
    if (createHash('sha256').update(bytes).digest('hex') !== metadata.catalog.sha256) {
      throw new Error('Word meaning catalog checksum mismatch')
    }
    const data = JSON.parse(gunzipSync(bytes).toString('utf8')) as Catalog
    if (data.version !== WORD_MEANINGS_VERSION) throw new Error('Word meaning catalog version mismatch')
    senseIndices = new Map(data.senses.map(([id], index) => [id, index]))
    synsetIndices = new Map(data.synsets.map(([id], index) => [id, index]))
    synsetSenses = new Map()
    for (const [id, , synset] of data.senses) {
      const members = synsetSenses.get(synset) ?? []
      members.push(id)
      synsetSenses.set(synset, members)
    }
    catalog = data
  }
  return catalog
}

function relation(edge: EncodedEdge, targets: readonly (EncodedSense | EncodedSynset)[]): MeaningRelation {
  const [type, target, qualifier] = edge
  return { type, target: targets[target][0], ...(qualifier ? { qualifier } : {}) }
}

/** Includes non-game intermediate senses so exact source graph paths resolve. */
export function getMeaningSense(id: string): MeaningSense | undefined {
  const data = loadCatalog()
  const cached = senseCache.get(id)
  if (cached) return cached
  const index = senseIndices.get(id)
  if (index === undefined) return undefined
  const [, entryIndex, synsetIndex, edges] = data.senses[index]
  const [, lemma, pos] = data.entries[entryIndex]
  const [synset, , definitions] = data.synsets[synsetIndex]
  const result = freezeDeep({ id, synset, lemma, partOfSpeech: parts[pos],
    definition: definitions[0], definitions, relations: edges.map(edge => relation(edge, data.senses)) })
  senseCache.set(id, result)
  return result
}

export function getMeaningSynset(id: string): MeaningSynset | undefined {
  const data = loadCatalog()
  const cached = synsetCache.get(id)
  if (cached) return cached
  const index = synsetIndices.get(id)
  if (index === undefined) return undefined
  const [, pos, definitions, edges] = data.synsets[index]
  const result = freezeDeep({ id, partOfSpeech: parts[pos], definition: definitions[0], definitions,
    senses: synsetSenses.get(index) ?? [], relations: edges.map(edge => relation(edge, data.synsets)) })
  synsetCache.set(id, result)
  return result
}

/** All senses, including ambiguity; uncovered words have an explicit status. */
export function getWordMeanings(word: string): WordMeanings {
  const key = normalize(word)
  const cached = wordCache.get(key)
  if (cached) return cached
  const data = loadCatalog()
  const senses = new Map<string, WordMeaningSense>()
  for (const [entryIndex, form] of data.words[key] ?? []) {
    for (const senseIndex of data.entries[entryIndex][3]) {
      const sense = getMeaningSense(data.senses[senseIndex][0])!
      const previous = senses.get(sense.id)
      if (!previous || formNames.indexOf(previous.form) > form) {
        senses.set(sense.id, { ...sense, form: formNames[form] })
      }
    }
  }
  const result = freezeDeep({ word: key, version: WORD_MEANINGS_VERSION,
    status: senses.size ? 'covered' as const : 'missing' as const, senses: [...senses.values()] })
  wordCache.set(key, result)
  return result
}

/** Report the exact gap; absence must never silently become neutral meaning. */
export function getMeaningCoverage(words: Iterable<string>): {
  total: number; covered: number; missing: readonly string[]
} {
  const unique = [...new Set([...words].map(normalize))].sort()
  const data = loadCatalog()
  const missing = unique.filter(word => !data.words[word]?.length)
  return { total: unique.length, covered: unique.length - missing.length, missing }
}

/** Alphabetical, complete list of dictionary spellings backed by source senses. */
export function getCoveredMeaningWords(): readonly string[] {
  coveredWords ??= Object.freeze(Object.keys(loadCatalog().words))
  return coveredWords
}
