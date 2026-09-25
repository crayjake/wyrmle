import profilesData from '../lexicon/data/semantic-profiles-v1.json' with { type: 'json' }
import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../lexicon/meaningDictionary.ts'
import { MEANING_LEXICON_VERSION, meaningSupply } from '../game/meaningLexicon.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from '../game/meaningLexicon.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import type { SemanticRelation } from '../game/types.ts'
import { currentLexicalProvider } from './lexicalProvider.ts'
import type { LexicalEntry, LexicalProvider } from './lexicalProvider.ts'

type ProfileEntry = {
  relation: Exclude<SemanticRelation, 'unrelated'>
  senseId: string
  definition: string
  lemma?: string
  reason: string
  confidence: 'reviewed-profile' | 'lexical-expansion'
}
type SemanticProfile = { version: string; definition: string; relations: Record<string, ProfileEntry> }
const profiles = profilesData as unknown as Readonly<Record<string, SemanticProfile>>

export const meaningLexicalProvider: LexicalProvider = {
  id: 'wyrmle-definition-backed-semantics-1',
  getEntry(word) {
    const normalized = word.trim().toUpperCase()
    const source = getDictionaryMeaning(normalized)
    if (!source) return undefined
    const previous = currentLexicalProvider.getEntry(normalized)
    const profile = profiles[normalized]
    return {
      word: normalized, partsOfSpeech: profile ? previous?.partsOfSpeech ?? source.partsOfSpeech : source.partsOfSpeech,
      definition: profile?.definition ?? source.definition,
      synonyms: profile ? Object.keys(profile.relations).filter(word => profile.relations[word].relation === 'similar') : [],
      counters: profile ? Object.keys(profile.relations).filter(word => profile.relations[word].relation === 'opposite') : [],
      related: profile ? Object.keys(profile.relations).filter(word => profile.relations[word].relation === 'related') : [],
      commonness: previous?.commonness ?? null, commonnessSource: previous?.commonnessSource ?? 'unknown',
      semanticSource: profile ? 'curated-and-wordnet' : 'dictionary-only', semanticConfidence: profile ? 0.9 : 0,
    }
  },
  getSubmittedWordEntry(word) { return meaningLexicalProvider.getEntry(word) },
  enemyWords: () => Object.keys(profiles).sort(),
  vocabulary: () => currentLexicalProvider.vocabulary().map(entry => meaningLexicalProvider.getEntry(entry.word))
    .filter((entry): entry is LexicalEntry => Boolean(entry)),
}

function fits(word: string, counts: Uint16Array, minimum: number, maximum: number): boolean {
  if (word.length < minimum || word.length > maximum || !/^[A-Z]+$/.test(word)) return false
  const used = new Uint16Array(26)
  for (const letter of word) {
    const index = letter.charCodeAt(0) - 65
    if (++used[index] > counts[index]) return false
  }
  return true
}

/** Exhausts the dictionary before search; solver budgets never limit coverage. */
export function compilePuzzleMeanings(encounter: LetterStrikeEncounter): PuzzleMeaningLexicon {
  const enemyWord = encounter.enemy.word.toUpperCase()
  const profile = profiles[enemyWord]
  if (!profile) throw new Error(`No reviewed semantic profile for ${enemyWord}.`)
  const letterSupply = meaningSupply(encounter)
  const counts = new Uint16Array(26)
  for (const letter of letterSupply) counts[letter.charCodeAt(0) - 65]++
  const words: Record<string, PuzzleWordMeaning> = {}
  for (const word of getDefinedDictionaryWords()) {
    if (!fits(word, counts, encounter.minimumWordLength, encounter.startingTiles.length)) continue
    const source = getDictionaryMeaning(word)!
    const classification = profile.relations[word]
    words[word] = Object.freeze({
      definition: classification?.definition ?? source.definition,
      lemma: classification?.lemma ?? source.lemma, senseId: classification?.senseId ?? source.senseId,
      partsOfSpeech: Object.freeze([...source.partsOfSpeech]), relation: classification?.relation ?? 'unrelated',
      reason: classification?.reason ?? `This defined word does not match a counter or reinforcing sense in the reviewed ${enemyWord.toLowerCase()} profile.`,
      source: 'oewn-2025', evidence: classification?.confidence ?? 'defined-neutral',
    })
  }
  return Object.freeze({ version: MEANING_LEXICON_VERSION, dictionaryVersion: MEANING_DICTIONARY_VERSION,
    profileVersion: profile.version, policy: 'defined-only', enemyWord, letterSupply,
    minimumWordLength: encounter.minimumWordLength, maximumWordLength: encounter.startingTiles.length, words: Object.freeze(words) })
}

export function withCompiledMeanings(encounter: LetterStrikeEncounter): LetterStrikeEncounter {
  const copy = { ...encounter, grammarModifiers: {}, longWordRule: undefined }
  delete copy.longWordRule
  const meaningLexicon = compilePuzzleMeanings(copy)
  const words = Object.keys(meaningLexicon.words)
  return { ...copy, meaningLexicon, enemy: { ...copy.enemy, semanticRelations: {
    opposite: words.filter(word => meaningLexicon.words[word].relation === 'opposite'),
    similar: words.filter(word => meaningLexicon.words[word].relation === 'similar'),
    related: words.filter(word => meaningLexicon.words[word].relation === 'related'),
  } } }
}

/** Recompilation detects omitted words, incorrect senses and stale classification. */
export function isMeaningCompilationCurrent(encounter: LetterStrikeEncounter): boolean {
  if (!encounter.meaningLexicon) return false
  const expected = compilePuzzleMeanings(encounter)
  const actual = encounter.meaningLexicon
  if (actual.version !== expected.version || actual.dictionaryVersion !== expected.dictionaryVersion
    || actual.profileVersion !== expected.profileVersion || actual.letterSupply !== expected.letterSupply
    || actual.enemyWord !== expected.enemyWord || actual.policy !== 'defined-only'
    || actual.minimumWordLength !== expected.minimumWordLength || actual.maximumWordLength !== expected.maximumWordLength
    || Object.keys(actual.words).length !== Object.keys(expected.words).length) return false
  return Object.entries(expected.words).every(([word, meaning]) => {
    const stored = actual.words[word]
    return stored && meaning.definition === stored.definition && meaning.senseId === stored.senseId
      && meaning.lemma === stored.lemma && meaning.relation === stored.relation && meaning.reason === stored.reason
      && meaning.source === stored.source && meaning.evidence === stored.evidence
      && JSON.stringify(meaning.partsOfSpeech) === JSON.stringify(stored.partsOfSpeech)
  })
}
