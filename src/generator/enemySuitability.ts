import { isDictionaryWord, normalizeWord } from '../game/dictionary.ts'
import { localLexicalProvider } from './lexicalProvider.ts'
import type { LexicalEntry, LexicalProvider } from './lexicalProvider.ts'

export type EnemySuitability = {
  word: string
  commonness: number | null
  commonnessSource: LexicalEntry['commonnessSource']
  definitionQuality: number
  partOfSpeechClarity: number
  counterCount: number
  resistedCount: number
  relatedCount: number
  letterPlayability: number
  counterLetterCoverage: number
  lengthScore: number
  semanticConfidence: number
  overallScore: number
  eligible: boolean
  rejectionReasons: string[]
}

export const enemySuitabilityConfig = Object.freeze({
  minimumLength: 4, maximumLength: 11, minimumCommonness: 0.5,
  minimumCounters: 6, minimumResisted: 4, minimumRelated: 4,
  minimumCounterLetterCoverage: 0.55, minimumScore: 0.62,
  weights: Object.freeze({ commonness: 0.2, definition: 0.1, partOfSpeech: 0.05,
    counters: 0.18, resisted: 0.1, related: 0.07, letters: 0.15, length: 0.1, confidence: 0.05 }),
})

// Conventional approximate English letter proportions. Used only to avoid
// awkward letter inventories, never as word-frequency evidence.
const letterFrequency: Readonly<Record<string, number>> = {
  A: 8.2, B: 1.5, C: 2.8, D: 4.3, E: 12.7, F: 2.2, G: 2, H: 6.1,
  I: 7, J: 0.15, K: 0.77, L: 4, M: 2.4, N: 6.7, O: 7.5, P: 1.9,
  Q: 0.1, R: 6, S: 6.3, T: 9.1, U: 2.8, V: 0.98, W: 2.4, X: 0.15, Y: 2, Z: 0.07,
}
const unit = (value: number) => Math.max(0, Math.min(1, value))
const round = (value: number) => Math.round(value * 1000) / 1000
const validWords = (words: readonly string[]) => [...new Set(words.map(normalizeWord))]
  .filter(word => /^[A-Z]{3,16}$/.test(word) && isDictionaryWord(word))

export function analyseEnemySuitability(enemyWord: string, provider: LexicalProvider = localLexicalProvider): EnemySuitability {
  const word = normalizeWord(enemyWord)
  const entry = provider.getEntry(word)
  const config = enemySuitabilityConfig
  const counters = validWords(entry?.counters ?? [])
  const resisted = validWords(entry?.synonyms ?? [])
  const related = validWords(entry?.related ?? [])
  const counterLetters = new Set(counters.join(''))
  const counterLetterCoverage = word.length ? [...word].filter(letter => counterLetters.has(letter)).length / word.length : 0
  const ordinaryLetters = word.length ? [...word].reduce((sum, letter) => sum + Math.sqrt((letterFrequency[letter] ?? 0) / 12.7), 0) / word.length : 0
  const letterPlayability = 0.45 * ordinaryLetters + 0.55 * counterLetterCoverage
  const definitionQuality = entry?.definition.trim() ? unit(entry.definition.trim().split(/\s+/).length / 7) : 0
  const partOfSpeechClarity = entry?.partsOfSpeech.length === 1 ? 1 : entry?.partsOfSpeech.length ? 0.5 : 0
  const lengthScore = word.length >= 6 && word.length <= 9 ? 1
    : word.length === 5 || word.length === 10 ? 0.85
      : word.length === 4 || word.length === 11 ? 0.55 : 0
  const weights = config.weights
  // Model assessment distinguishes counter, resisted and neutral meanings.
  // A separate related-but-neutral class is an archived profile requirement.
  const modelAssessed = entry?.semanticSource === 'offline-model'
  const overallScore = round(
    ((entry?.commonness ?? 0) * weights.commonness + definitionQuality * weights.definition
    + partOfSpeechClarity * weights.partOfSpeech + unit(counters.length / 12) * weights.counters
    + unit(resisted.length / 8) * weights.resisted + (modelAssessed ? 0 : unit(related.length / 8) * weights.related)
    + letterPlayability * weights.letters + lengthScore * weights.length
    + (entry?.semanticConfidence ?? 0) * weights.confidence) / (modelAssessed ? 1 - weights.related : 1),
  )
  const rejectionReasons: string[] = []
  if (!/^[A-Z]+$/.test(word) || !isDictionaryWord(word)) rejectionReasons.push('Enemy is not a valid local dictionary word.')
  if (word.length < config.minimumLength) rejectionReasons.push(`Too short: at least ${config.minimumLength} enemy letters are needed.`)
  if (word.length > config.maximumLength) rejectionReasons.push(`Too long: at most ${config.maximumLength} enemy letters are supported.`)
  if (entry?.properNoun) rejectionReasons.push('Proper nouns are unsuitable enemy concepts.')
  if (entry?.commonness == null) rejectionReasons.push('Familiarity is unknown in the local lexical provider.')
  else if (entry.commonness < config.minimumCommonness) rejectionReasons.push('Low familiarity: this enemy is too obscure.')
  if (definitionQuality < 0.5) rejectionReasons.push('Missing or inadequate definition for the intended enemy sense.')
  if (partOfSpeechClarity !== 1) rejectionReasons.push('No clear part of speech for the intended enemy sense.')
  if (counters.length < config.minimumCounters) rejectionReasons.push(`Insufficient counter vocabulary (${counters.length}/${config.minimumCounters}).`)
  if (resisted.length < config.minimumResisted) rejectionReasons.push(`Poor semantic neighbourhood: insufficient resisted vocabulary (${resisted.length}/${config.minimumResisted}).`)
  if (!modelAssessed && related.length < config.minimumRelated) rejectionReasons.push(`Insufficient related vocabulary (${related.length}/${config.minimumRelated}).`)
  if (counterLetterCoverage < config.minimumCounterLetterCoverage) rejectionReasons.push('Counter words cover too few enemy letters.')
  if (overallScore < config.minimumScore) rejectionReasons.push(`Overall suitability is below ${config.minimumScore}.`)
  return {
    word, commonness: entry?.commonness ?? null, commonnessSource: entry?.commonnessSource ?? 'unknown',
    definitionQuality: round(definitionQuality), partOfSpeechClarity, counterCount: counters.length,
    resistedCount: resisted.length, relatedCount: related.length, letterPlayability: round(letterPlayability),
    counterLetterCoverage: round(counterLetterCoverage), lengthScore,
    semanticConfidence: entry?.semanticConfidence ?? 0, overallScore,
    eligible: rejectionReasons.length === 0, rejectionReasons,
  }
}

export const analyzeEnemySuitability = analyseEnemySuitability
