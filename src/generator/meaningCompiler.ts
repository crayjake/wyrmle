import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../lexicon/meaningDictionary.ts'
import { MEANING_LEXICON_VERSION, meaningSupply } from '../game/meaningLexicon.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from '../game/meaningLexicon.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import { semanticAssessmentProvider } from './semanticAssessments.ts'
import { currentLexicalProvider } from './lexicalProvider.ts'
import type { LexicalEntry, LexicalProvider } from './lexicalProvider.ts'
import { GENERATION_COMMONNESS_SOURCE, getGenerationObservedVocabulary, getGenerationWordCommonness } from './familiarity.ts'
import { semanticRefinementProvider } from './semanticRefinement.ts'
import { readSemanticAssessmentMetadata } from '../game/semanticAssessment.ts'

let generationVocabulary: readonly LexicalEntry[] | undefined
const generationEntries = new Map<string, LexicalEntry>()
const generationEnemies = Object.freeze([...semanticAssessmentProvider.enemyWords()])
const generationEnemySet = new Set(generationEnemies)
const emptyRelations: readonly string[] = Object.freeze([])

export const meaningLexicalProvider: LexicalProvider = Object.freeze({
  id: `wyrmle-offline-model-semantics-1+${GENERATION_COMMONNESS_SOURCE}`,
  getEntry(word: string) {
    const normalized = word.trim().toUpperCase()
    const cached = generationEntries.get(normalized)
    if (cached) return cached
    const source = getDictionaryMeaning(normalized)
    if (!source) return undefined
    const isEnemy = generationEnemySet.has(normalized)
    const previous = isEnemy ? currentLexicalProvider.getEntry(normalized) : undefined
    const relations = isEnemy ? semanticAssessmentProvider.relations(normalized) : undefined
    const entry: LexicalEntry = Object.freeze({
      word: normalized, partsOfSpeech: isEnemy ? previous?.partsOfSpeech ?? source.partsOfSpeech : source.partsOfSpeech,
      definition: isEnemy ? semanticAssessmentProvider.definition(normalized) : source.definition,
      synonyms: relations?.similar ?? emptyRelations, counters: relations?.opposite ?? emptyRelations,
      related: relations?.related ?? emptyRelations,
      commonness: getGenerationWordCommonness(normalized), commonnessSource: 'corpus-frequency',
      semanticSource: isEnemy ? 'offline-model' : 'dictionary-only', semanticConfidence: isEnemy ? 0.9 : 0,
    })
    generationEntries.set(normalized, entry)
    return entry
  },
  getSubmittedWordEntry(word: string) { return meaningLexicalProvider.getEntry(word) },
  enemyWords: () => generationEnemies,
  vocabulary: () => generationVocabulary ??= Object.freeze(getGenerationObservedVocabulary()
    .map(word => meaningLexicalProvider.getEntry(word)).filter((entry): entry is LexicalEntry => Boolean(entry))),
})

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
  const assessment = semanticAssessmentProvider.metadata(enemyWord)
  const letterSupply = meaningSupply(encounter)
  const counts = new Uint16Array(26)
  for (const letter of letterSupply) counts[letter.charCodeAt(0) - 65]++
  const words: Record<string, PuzzleWordMeaning> = {}
  for (const word of getDefinedDictionaryWords()) {
    if (!fits(word, counts, encounter.minimumWordLength, encounter.startingTiles.length)) continue
    words[word] = semanticAssessmentProvider.word(enemyWord, word)
  }
  const refined = semanticRefinementProvider.refine(enemyWord, words)
  const metadata = refined.metadata ? readSemanticAssessmentMetadata({ ...assessment, refinement: refined.metadata }) : assessment
  return Object.freeze({ version: MEANING_LEXICON_VERSION, dictionaryVersion: MEANING_DICTIONARY_VERSION,
    profileVersion: assessment.version, policy: 'defined-only', enemyWord, letterSupply, assessment: metadata,
    minimumWordLength: encounter.minimumWordLength, maximumWordLength: encounter.startingTiles.length, words: Object.freeze(refined.words) })
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
  if (!encounter.meaningLexicon?.assessment) return false
  const expected = compilePuzzleMeanings(encounter)
  const actual = encounter.meaningLexicon
  if (actual.version !== expected.version || actual.dictionaryVersion !== expected.dictionaryVersion
    || actual.profileVersion !== expected.profileVersion || actual.letterSupply !== expected.letterSupply
    || actual.enemyWord !== expected.enemyWord || actual.policy !== 'defined-only'
    || actual.minimumWordLength !== expected.minimumWordLength || actual.maximumWordLength !== expected.maximumWordLength
    || Object.keys(actual.words).length !== Object.keys(expected.words).length
    || JSON.stringify(actual.assessment) !== JSON.stringify(expected.assessment)) return false
  return Object.entries(expected.words).every(([word, meaning]) => {
    const stored = actual.words[word]
    return stored && meaning.definition === stored.definition && meaning.senseId === stored.senseId
      && meaning.lemma === stored.lemma && meaning.relation === stored.relation && meaning.reason === stored.reason
      && meaning.source === stored.source && meaning.evidence === stored.evidence
      && JSON.stringify(meaning.assessment) === JSON.stringify(stored.assessment)
      && JSON.stringify(meaning.partsOfSpeech) === JSON.stringify(stored.partsOfSpeech)
  })
}

/** Draft generation is allowed; publication additionally needs complete current LLM review. */
export function isMeaningPublicationReady(encounter: LetterStrikeEncounter): boolean {
  if (!isMeaningCompilationCurrent(encounter)) return false
  const refinement = encounter.meaningLexicon?.assessment?.refinement
  if (!refinement || refinement.eligibleWords !== refinement.reviewedWords) return false
  const baseline = Object.fromEntries(Object.keys(encounter.meaningLexicon!.words)
    .map(word => [word, semanticAssessmentProvider.word(encounter.enemy.word.toUpperCase(), word)]))
  return semanticRefinementProvider.refine(encounter.enemy.word.toUpperCase(), baseline).ready
}

export function assertMeaningPublicationReady(encounter: LetterStrikeEncounter): void {
  if (!isMeaningPublicationReady(encounter)) throw new Error('Publication requires complete current offline LLM refinement of every eligible inventory word.')
}
