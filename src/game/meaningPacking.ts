import { MEANING_LEXICON_VERSION } from './meaningLexicon.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from './meaningLexicon.ts'
import type { PartOfSpeech, SemanticRelation } from './types.ts'
import { PARTS_OF_SPEECH } from './types.ts'
import { readSemanticAssessmentMetadata, readWordSemanticAssessment } from './semanticAssessment.ts'
import type { WordSemanticAssessment } from './semanticAssessment.ts'

/** Lossless transport only. No meaning, scoring or validity is inferred here. */
export const MEANING_PACKING_VERSION = 'wyrmle-packed-meanings-1' as const
export const MEANING_ASSESSMENT_PACKING_VERSION = 'wyrmle-packed-meanings-2' as const
type MeaningHeader = Omit<PuzzleMeaningLexicon, 'words'>
type LegacyPackedMeaningRecord = readonly [
  definition: number, lemma: number, senseId: number, partsOfSpeech: number,
  relation: number, reason: number, source: number, evidence: number,
]
type PackedMeaningRecord = LegacyPackedMeaningRecord | readonly [...LegacyPackedMeaningRecord, assessment: number]
export type PackedMeaningLexicon = Readonly<{
  packingVersion: typeof MEANING_PACKING_VERSION | typeof MEANING_ASSESSMENT_PACKING_VERSION
  lexicon: Readonly<MeaningHeader>
  strings: readonly string[]
  partsOfSpeech: readonly (readonly PartOfSpeech[])[]
  records: readonly PackedMeaningRecord[]
  words: Readonly<Record<string, number>>
  assessments?: readonly WordSemanticAssessment[]
}>

const parts = new Set<PartOfSpeech>(PARTS_OF_SPEECH)
const relations = new Set<SemanticRelation>(['opposite', 'similar', 'related', 'unrelated'])
const evidenceKinds = new Set<PuzzleWordMeaning['evidence']>([
  'reviewed-profile', 'lexical-expansion', 'defined-neutral', 'model-assessed',
])
const headerKeys = new Set([
  'version', 'dictionaryVersion', 'profileVersion', 'policy', 'enemyWord',
  'letterSupply', 'minimumWordLength', 'maximumWordLength', 'assessment',
])
const fail = (detail: string): never => { throw new Error(`Invalid packed puzzle meanings: ${detail}.`) }

/** Preserve record fields, POS ordering and word order while sharing repeats. */
export function packMeaningLexicon(lexicon: PuzzleMeaningLexicon): PackedMeaningLexicon {
  const { words, ...originalHeader } = lexicon
  const assessed = Object.hasOwn(lexicon, 'assessment')
  const header = readHeader(originalHeader, assessed)
  const strings: string[] = []
  const stringIndices = new Map<string, number>()
  const partLists: (readonly PartOfSpeech[])[] = []
  const partIndices = new Map<string, number>()
  const records: PackedMeaningRecord[] = []
  const recordIndices = new Map<string, number>()
  const wordIndices: Record<string, number> = {}
  const assessments: WordSemanticAssessment[] = []
  const assessmentIndices = new Map<string, number>()
  const stringIndex = (value: string): number => {
    if (typeof value !== 'string') fail('record field is not a string')
    let index = stringIndices.get(value)
    if (index === undefined) {
      index = strings.length
      strings.push(value)
      stringIndices.set(value, index)
    }
    return index
  }
  for (const [word, record] of Object.entries(words)) {
    let assessmentIndex: number | undefined
    if (assessed) {
      if (record.evidence !== 'model-assessed') fail(`missing model assessment for ${word}`)
      const assessment = readAssessment(record.assessment)
      if (assessment.sensesEvaluated > header.assessment!.assessedSenses) fail(`invalid assessed sense count for ${word}`)
      const key = JSON.stringify(assessment)
      assessmentIndex = assessmentIndices.get(key)
      if (assessmentIndex === undefined) {
        assessmentIndex = assessments.length
        assessments.push(assessment)
        assessmentIndices.set(key, assessmentIndex)
      }
    } else if (Object.hasOwn(record, 'assessment') || record.evidence === 'model-assessed') {
      fail(`model assessment for ${word} has no metadata`)
    }
    const partKey = JSON.stringify(record.partsOfSpeech)
    let partIndex = partIndices.get(partKey)
    if (partIndex === undefined) {
      partIndex = partLists.length
      partLists.push(Object.freeze([...record.partsOfSpeech]))
      partIndices.set(partKey, partIndex)
    }
    const legacyRow: LegacyPackedMeaningRecord = [
      stringIndex(record.definition), stringIndex(record.lemma), stringIndex(record.senseId), partIndex,
      stringIndex(record.relation), stringIndex(record.reason), stringIndex(record.source), stringIndex(record.evidence),
    ]
    const row: PackedMeaningRecord = Object.freeze(assessed ? [...legacyRow, assessmentIndex!] : legacyRow)
    const key = JSON.stringify(row)
    let recordIndex = recordIndices.get(key)
    if (recordIndex === undefined) {
      recordIndex = records.length
      records.push(row)
      recordIndices.set(key, recordIndex)
    }
    wordIndices[word] = recordIndex
  }
  if (assessed && header.assessment!.assessedWords < Object.keys(words).length) fail('vocabulary exceeds assessed coverage')
  return Object.freeze({
    packingVersion: assessed ? MEANING_ASSESSMENT_PACKING_VERSION : MEANING_PACKING_VERSION, lexicon: Object.freeze(header),
    strings: Object.freeze(strings), partsOfSpeech: Object.freeze(partLists),
    records: Object.freeze(records), words: Object.freeze(wordIndices),
    ...(assessed ? { assessments: Object.freeze(assessments) } : {}),
  })
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)

function readAssessment(value: unknown): WordSemanticAssessment {
  try { return readWordSemanticAssessment(value) } catch (error) {
    return fail(error instanceof Error ? error.message : 'invalid assessment')
  }
}

function readHeader(value: unknown, assessed: boolean): MeaningHeader {
  if (!object(value) || value.version !== MEANING_LEXICON_VERSION || value.policy !== 'defined-only') {
    return fail('unsupported meaning header')
  }
  for (const key of ['dictionaryVersion', 'profileVersion', 'enemyWord', 'letterSupply']) {
    if (typeof value[key] !== 'string') fail(`header ${key} is not a string`)
  }
  if (Object.keys(value).some(key => !headerKeys.has(key))) return fail('unsupported header field')
  if (Object.hasOwn(value, 'assessment') !== assessed) return fail('assessment metadata does not match packing version')
  if (!integer(value.minimumWordLength) || value.minimumWordLength < 1
    || !integer(value.maximumWordLength) || value.maximumWordLength < value.minimumWordLength) {
    return fail('invalid word length bounds')
  }
  // Keep the publication's original property order: encounter certificates use
  // JSON serialization as part of their fingerprint, not just deep equality.
  if (!assessed) return { ...value } as MeaningHeader
  try { return { ...value, assessment: readSemanticAssessmentMetadata(value.assessment) } as MeaningHeader } catch (error) {
    return fail(error instanceof Error ? error.message : 'invalid assessment metadata')
  }
}

/** Decode only stored values; corrupt or unsupported transport fails closed. */
export function unpackMeaningLexicon(packed: unknown): PuzzleMeaningLexicon {
  if (!object(packed) || (packed.packingVersion !== MEANING_PACKING_VERSION
    && packed.packingVersion !== MEANING_ASSESSMENT_PACKING_VERSION)) {
    return fail('unsupported packing version')
  }
  const assessed = packed.packingVersion === MEANING_ASSESSMENT_PACKING_VERSION
  const header = readHeader(packed.lexicon, assessed)
  if (Object.hasOwn(packed, 'assessments') !== assessed || (assessed && !Array.isArray(packed.assessments))) {
    return fail('assessment table does not match packing version')
  }
  const assessments = assessed ? Object.freeze((packed.assessments as unknown[]).map(readAssessment)) : []
  if (!Array.isArray(packed.strings) || !packed.strings.every(value => typeof value === 'string')) {
    return fail('invalid string table')
  }
  const strings: readonly string[] = packed.strings
  const readString = (index: unknown): string => {
    if (!integer(index) || index < 0 || index >= strings.length) return fail('string index out of range')
    return strings[index]
  }
  if (!Array.isArray(packed.partsOfSpeech)) return fail('invalid part-of-speech table')
  const partLists: readonly (readonly PartOfSpeech[])[] = Object.freeze(packed.partsOfSpeech.map(value => {
    if (!Array.isArray(value) || !value.every(part => parts.has(part))) return fail('unsupported part of speech')
    return Object.freeze([...value]) as readonly PartOfSpeech[]
  }))
  if (!Array.isArray(packed.records)) return fail('invalid record table')
  const records: readonly PuzzleWordMeaning[] = Object.freeze(packed.records.map(row => {
    if (!Array.isArray(row) || row.length !== (assessed ? 9 : 8)) return fail('invalid record tuple')
    const [definition, lemma, senseId, posIndex, relation, reason, source, evidence, assessmentIndex] = row
    if (!integer(posIndex) || posIndex < 0 || posIndex >= partLists.length) return fail('part-of-speech index out of range')
    const relationValue = readString(relation) as SemanticRelation
    const evidenceValue = readString(evidence) as PuzzleWordMeaning['evidence']
    const sourceValue = readString(source)
    if (!relations.has(relationValue) || !evidenceKinds.has(evidenceValue)
      || (sourceValue !== 'oewn-2025' && sourceValue !== 'wiktionary-en')) {
      return fail('unsupported record classification or source')
    }
    if ((evidenceValue === 'model-assessed') !== assessed) return fail('model evidence does not match packing version')
    let assessment: WordSemanticAssessment | undefined
    if (assessed) {
      if (!integer(assessmentIndex) || assessmentIndex < 0 || assessmentIndex >= assessments.length) {
        return fail('assessment index out of range')
      }
      assessment = assessments[assessmentIndex]
      if (assessment.sensesEvaluated > header.assessment!.assessedSenses) return fail('invalid assessed sense count')
    }
    return Object.freeze({
      definition: readString(definition), lemma: readString(lemma), senseId: readString(senseId),
      partsOfSpeech: partLists[posIndex], relation: relationValue, reason: readString(reason),
      source: sourceValue, evidence: evidenceValue,
      ...(assessment ? { assessment } : {}),
    })
  }))
  if (!object(packed.words)) return fail('invalid word index')
  const words: Record<string, PuzzleWordMeaning> = {}
  for (const [word, index] of Object.entries(packed.words)) {
    if (!/^[A-Z]+$/.test(word) || word.length < header.minimumWordLength || word.length > header.maximumWordLength) {
      fail('invalid word spelling or length')
    }
    if (!integer(index) || index < 0 || index >= records.length) fail('record index out of range')
    words[word] = records[index as number]
  }
  if (assessed && header.assessment!.assessedWords < Object.keys(words).length) return fail('vocabulary exceeds assessed coverage')
  return Object.freeze({ ...header, words: Object.freeze(words) })
}
