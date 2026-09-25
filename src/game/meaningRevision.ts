import type { LetterStrikeEncounter } from './letterStrike.ts'
import { validateMeaningLexicon } from './meaningLexicon.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from './meaningLexicon.ts'
import { packMeaningLexicon, unpackMeaningLexicon } from './meaningPacking.ts'
import type { PackedMeaningLexicon } from './meaningPacking.ts'

export type PackedMeaningRevision = Readonly<{
  meaningBase: string
  packedMeanings: PackedMeaningLexicon
}>

const baseId = 'generated-chaos-meaning1-meaning-review-20260925%3A2%3A0-finite18-spare-ca'
const fail = (detail: string): never => { throw new Error(`Invalid puzzle meaning revision: ${detail}.`) }

function readBase(encounter: LetterStrikeEncounter, reference: unknown): PuzzleMeaningLexicon {
  if (reference !== baseId || encounter.id !== baseId) return fail('unsupported base encounter')
  const meanings = encounter.meaningLexicon
  if (!meanings || meanings.dictionaryVersion !== 'oewn-2025-meanings-v1'
    || meanings.profileVersion !== 'semantic-profiles-v1') return fail('unsupported base meaning version')
  validateMeaningLexicon(encounter)
  return meanings
}

function assertSameSupply(base: PuzzleMeaningLexicon, revised: PuzzleMeaningLexicon): void {
  for (const field of ['version', 'policy', 'enemyWord', 'letterSupply', 'minimumWordLength', 'maximumWordLength'] as const) {
    if (base[field] !== revised[field]) fail(`mismatched ${field}`)
  }
  if (revised.dictionaryVersion !== 'wyrmle-defined-dictionary-v2'
    || revised.profileVersion !== 'semantic-profiles-v2-chaos') fail('unsupported revised meaning version')
}

function sameMeaning(left: PuzzleWordMeaning, right: PuzzleWordMeaning): boolean {
  return left.definition === right.definition && left.lemma === right.lemma && left.senseId === right.senseId
    && left.relation === right.relation && left.reason === right.reason && left.source === right.source
    && left.evidence === right.evidence && left.partsOfSpeech.length === right.partsOfSpeech.length
    && left.partsOfSpeech.every((part, index) => part === right.partsOfSpeech[index])
}

/** Store only explicit additions/overrides; no meanings are derived at load time. */
export function packMeaningRevision(baseEncounter: LetterStrikeEncounter, revised: PuzzleMeaningLexicon): PackedMeaningRevision {
  const base = readBase(baseEncounter, baseEncounter.id)
  assertSameSupply(base, revised)
  for (const word of Object.keys(base.words)) {
    if (!Object.hasOwn(revised.words, word)) fail(`cannot remove base word ${word}`)
  }
  const changes: Record<string, PuzzleWordMeaning> = {}
  for (const [word, meaning] of Object.entries(revised.words)) {
    if (!Object.hasOwn(base.words, word) || !sameMeaning(base.words[word], meaning)) changes[word] = meaning
  }
  const revision = Object.freeze({ meaningBase: baseEncounter.id,
    packedMeanings: packMeaningLexicon({ ...revised, words: Object.freeze(changes) }) })
  // Certificate hashes include field and word order. Refuse a transport that
  // would change any serialized value or order from the reviewed compilation.
  const restored = unpackMeaningRevision(baseEncounter, revision.meaningBase, revision.packedMeanings)
  if (JSON.stringify(restored) !== JSON.stringify(revised)) fail('noncanonical compilation order or unsupported record fields')
  return revision
}

/** Materialize a complete immutable table from two stored publication records. */
export function unpackMeaningRevision(
  baseEncounter: LetterStrikeEncounter, meaningBase: unknown, packedMeanings: unknown,
): PuzzleMeaningLexicon {
  const base = readBase(baseEncounter, meaningBase)
  const { words: changes, ...header } = unpackMeaningLexicon(packedMeanings)
  assertSameSupply(base, { ...header, words: changes })
  const combined = { ...base.words, ...changes }
  const words: Record<string, PuzzleWordMeaning> = {}
  for (const word of Object.keys(combined).sort()) words[word] = combined[word]
  return Object.freeze({ ...header, words: Object.freeze(words) })
}
