import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import { getEncounterWordClassification, validateLexicalRules } from '../game/lexicalRules.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import type { PartOfSpeech, SemanticRelation } from '../game/types.ts'
import { lexiconMetadata } from '../lexicon/index.ts'

type Classification = ReturnType<typeof getEncounterWordClassification>
export type LexicalAuditEntry = Classification & { word: string; openingPlayable: boolean }
export type LexicalAuditCounts = {
  words: number
  singlePartOfSpeechWords: number
  multiplePartsOfSpeechWords: number
  unknownPartOfSpeechWords: number
  /** Memberships overlap when a spelling has several supported categories. */
  partOfSpeechMemberships: Record<PartOfSpeech, number>
  partOfSpeechSources: Record<Classification['partOfSpeechSource'], number>
  semanticRelations: Record<SemanticRelation, number>
  semanticSources: Record<Classification['semanticSource'], number>
  /** Unlisted semantics use the gameplay fallback; they are not proved unrelated. */
  semanticFallbackWords: number
  unknownPartOfSpeechSamples: string[]
  unlistedSemanticSamples: string[]
}
export type LexicalAudit = {
  schemaVersion: 1
  encounterId: string
  lexicalRules: LetterStrikeEncounter['lexicalRules'] | null
  lexicon: { version: string; sourceArchiveSha256: string; metadataFingerprint: string } | null
  dictionary: { package: string; version: string; words: number; fingerprint: string }
  /** Noncryptographic input fingerprint for stale-report detection, not authentication. */
  inputFingerprint: string
  classificationFingerprint: string
  dictionaryWordsScanned: number
  minimumWordLength: number
  maximumWordLength: number
  opening: LexicalAuditCounts & {
    scope: 'all-dictionary-spellings-on-opening-board'
    dictionaryEnumerationComplete: true
  }
  supply: LexicalAuditCounts & {
    scope: 'all-dictionary-spellings-in-full-refill-supply-superset'
    dictionaryEnumerationComplete: true
    reachableBoardsExhaustive: false
    physicalLetterCounts: Record<string, number>
  }
  notes: string[]
  /** One record for every spelling in the supply superset, sorted by spelling. */
  entries?: LexicalAuditEntry[]
}

const AUDIT_SCHEMA_VERSION = 1
const SAMPLE_LIMIT = 20
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function updateFingerprint(hash: number, value: string): number {
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0
  }
  return hash
}
function formatFingerprint(hash: number): string { return `fnv1a32:${hash.toString(16).padStart(8, '0')}` }
function fingerprint(value: string): string { return formatFingerprint(updateFingerprint(0x811c9dc5, value)) }

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

let dictionary: { words: string[]; metadata: LexicalAudit['dictionary'] } | undefined
function auditDictionary() {
  if (!dictionary) {
    // Keep every accepted spelling; punctuation cannot be built from letter tiles.
    const words = [...new Set(englishWords.map(word => word.toUpperCase()))].sort()
    dictionary = { words, metadata: {
      package: 'an-array-of-english-words', version: lexiconMetadata.dictionary.version,
      words: words.length, fingerprint: fingerprint(words.join('\n')),
    } }
  }
  return dictionary
}

function auditInputs(encounter: LetterStrikeEncounter): string {
  return fingerprint(canonicalJson({
    lexicalRules: encounter.lexicalRules ?? null,
    lexiconMetadata: encounter.lexicalRules ? lexiconMetadata : null,
    enemyWord: encounter.enemy.word,
    semanticRelations: encounter.enemy.semanticRelations,
    wordPartsOfSpeech: encounter.wordPartsOfSpeech ?? {},
    minimumWordLength: encounter.minimumWordLength,
    startingLetters: encounter.startingTiles.map(tile => tile.letter.toUpperCase()),
    refillQueue: encounter.refillQueue.toUpperCase(),
  }))
}

function letterCounts(letters: string): Uint32Array {
  const counts = new Uint32Array(26)
  for (const letter of letters.toUpperCase()) {
    const index = letter.charCodeAt(0) - 65
    if (index < 0 || index >= 26) throw new Error('Lexical audit requires alphabetic board and refill letters.')
    counts[index]++
  }
  return counts
}

function emptyCounts(): LexicalAuditCounts {
  return {
    words: 0, singlePartOfSpeechWords: 0, multiplePartsOfSpeechWords: 0, unknownPartOfSpeechWords: 0,
    partOfSpeechMemberships: { noun: 0, verb: 0, adjective: 0, adverb: 0 },
    partOfSpeechSources: { wordnet: 0, morphology: 0, curated: 0, unknown: 0 },
    semanticRelations: { opposite: 0, similar: 0, related: 0, unrelated: 0 },
    semanticSources: { 'curated-or-wordnet': 0, unlisted: 0 },
    semanticFallbackWords: 0, unknownPartOfSpeechSamples: [], unlistedSemanticSamples: [],
  }
}

function record(counts: LexicalAuditCounts, word: string, classification: Classification): void {
  counts.words++
  if (classification.partsOfSpeech.length === 1) counts.singlePartOfSpeechWords++
  else if (classification.partsOfSpeech.length > 1) counts.multiplePartsOfSpeechWords++
  else {
    counts.unknownPartOfSpeechWords++
    if (counts.unknownPartOfSpeechSamples.length < SAMPLE_LIMIT) counts.unknownPartOfSpeechSamples.push(word)
  }
  for (const part of classification.partsOfSpeech) counts.partOfSpeechMemberships[part]++
  counts.partOfSpeechSources[classification.partOfSpeechSource]++
  counts.semanticRelations[classification.relation]++
  counts.semanticSources[classification.semanticSource]++
  if (classification.semanticSource === 'unlisted') {
    counts.semanticFallbackWords++
    if (counts.unlistedSemanticSamples.length < SAMPLE_LIMIT) counts.unlistedSemanticSamples.push(word)
  }
}

/**
 * Complete spelling enumeration, independent of move/selection/search budgets.
 * The opening multiset is exact because selection does not require adjacency.
 * Pooling the opening and entire refill is only a safe future-word superset:
 * it ignores draw order, consumed tiles and turns, so it cannot prove reachability.
 */
export function auditEncounterLexicon(encounter: LetterStrikeEncounter, options: { includeEntries?: boolean } = {}): LexicalAudit {
  validateLexicalRules(encounter)
  if (!Number.isSafeInteger(encounter.minimumWordLength) || encounter.minimumWordLength < 1) {
    throw new Error('Lexical audit requires a positive minimum word length.')
  }
  const source = auditDictionary()
  const openingLetters = encounter.startingTiles.map(tile => tile.letter).join('')
  const openingCounts = letterCounts(openingLetters)
  const supplyCounts = letterCounts(openingLetters + encounter.refillQueue)
  const opening = emptyCounts()
  const supply = emptyCounts()
  const entries: LexicalAuditEntry[] | undefined = options.includeEntries ? [] : undefined
  const used = new Uint32Array(26)
  let classificationHash = 0x811c9dc5
  for (const word of source.words) {
    if (word.length < encounter.minimumWordLength || word.length > encounter.startingTiles.length || !/^[A-Z]+$/.test(word)) continue
    used.fill(0)
    let supplied = true
    let openingPlayable = true
    for (let index = 0; index < word.length; index++) {
      const letter = word.charCodeAt(index) - 65
      used[letter]++
      if (used[letter] > supplyCounts[letter]) { supplied = false; break }
      if (used[letter] > openingCounts[letter]) openingPlayable = false
    }
    if (!supplied) continue
    const classification = getEncounterWordClassification(encounter, word)
    record(supply, word, classification)
    if (openingPlayable) record(opening, word, classification)
    const entry = { word, openingPlayable, ...classification }
    classificationHash = updateFingerprint(classificationHash, `${JSON.stringify(entry)}\n`)
    if (entries) entries.push({ ...entry, partsOfSpeech: [...entry.partsOfSpeech] })
  }
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION, encounterId: encounter.id,
    lexicalRules: encounter.lexicalRules ? { ...encounter.lexicalRules } : null,
    lexicon: encounter.lexicalRules ? {
      version: lexiconMetadata.version, sourceArchiveSha256: lexiconMetadata.source.sha256,
      metadataFingerprint: fingerprint(canonicalJson(lexiconMetadata)),
    } : null,
    dictionary: { ...source.metadata }, inputFingerprint: auditInputs(encounter),
    classificationFingerprint: formatFingerprint(classificationHash), dictionaryWordsScanned: source.words.length,
    minimumWordLength: encounter.minimumWordLength, maximumWordLength: encounter.startingTiles.length,
    opening: { ...opening, scope: 'all-dictionary-spellings-on-opening-board', dictionaryEnumerationComplete: true },
    supply: { ...supply, scope: 'all-dictionary-spellings-in-full-refill-supply-superset',
      dictionaryEnumerationComplete: true, reachableBoardsExhaustive: false,
      physicalLetterCounts: Object.fromEntries([...alphabet].map((letter, index) => [letter, supplyCounts[index]])),
    },
    notes: [
      'Every bundled dictionary spelling that fits the opening letter multiset is classified before solver search; no move, selection, vocabulary or state budget limits this audit.',
      'The full opening-plus-refill multiset is an optimistic future spelling superset, not an enumeration of reachable boards. Refill order, consumed letters and remaining turns can make included words unreachable.',
      'Unknown POS remains unknown and receives no inferred category. Unlisted semantics use the neutral gameplay fallback; absence from semantic lists does not establish unrelated meaning.',
      'Counts describe distinct spellings, not physical tile selections. Single and multiple POS counts partition known spellings; POS membership counts can overlap.',
      'FNV-1a fingerprints detect ordinary stale reports and are not cryptographic authenticity checks. Versioned lexical metadata records the source archive SHA-256.',
    ],
    ...(entries ? { entries } : {}),
  }
}

/** Validates provenance/completeness; unknown annotations are reported separately. */
export function isLexicalAuditCurrent(encounter: LetterStrikeEncounter, audit: LexicalAudit): boolean {
  if (!audit || !audit.dictionary || !audit.opening || !audit.supply) return false
  const source = auditDictionary()
  return audit.schemaVersion === AUDIT_SCHEMA_VERSION
    && audit.encounterId === encounter.id
    && canonicalJson(audit.lexicalRules) === canonicalJson(encounter.lexicalRules ?? null)
    && audit.inputFingerprint === auditInputs(encounter)
    && audit.dictionary.fingerprint === source.metadata.fingerprint
    && audit.dictionaryWordsScanned === source.words.length
    && audit.dictionary.words === source.words.length
    && audit.opening.dictionaryEnumerationComplete === true
    && audit.opening.scope === 'all-dictionary-spellings-on-opening-board'
    && audit.supply.dictionaryEnumerationComplete === true
    && audit.supply.scope === 'all-dictionary-spellings-in-full-refill-supply-superset'
    && audit.supply.reachableBoardsExhaustive === false
    && (!encounter.lexicalRules || (audit.lexicon?.version === lexiconMetadata.version
      && audit.lexicon.metadataFingerprint === fingerprint(canonicalJson(lexiconMetadata))))
}
