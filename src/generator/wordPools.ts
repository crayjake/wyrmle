import { isDictionaryWord, normalizeWord } from '../game/dictionary.ts'
import type { EnemyConcept, PartOfSpeech } from '../game/types.ts'
import { localLexicalProvider } from './lexicalProvider.ts'
import type { LexicalEntry, LexicalProvider } from './lexicalProvider.ts'

export type WordPools = {
  enemyWord: string
  providerId: string
  counters: LexicalEntry[]
  resisted: LexicalEntry[]
  related: LexicalEntry[]
  neutral: LexicalEntry[]
  grammar: LexicalEntry[]
  ward: LexicalEntry[]
  strike: LexicalEntry[]
  clutch: LexicalEntry[]
  decoys: LexicalEntry[]
  all: LexicalEntry[]
  semanticRelations: EnemyConcept['semanticRelations']
  wordPartsOfSpeech: Record<string, readonly PartOfSpeech[]>
  wordCommonness: Record<string, number | null>
}

export type WordPoolOptions = {
  minimumCommonness?: number
  maximumLength?: number
  grammarPartOfSpeech?: PartOfSpeech
  grammarPolicy?: 'single' | 'any-recognized'
}

/** Potential matching tiles, including repeated enemy letters, without any combat assumptions. */
export function matchingLetterCount(word: string, enemyWord: string): number {
  const counts = new Map<string, number>()
  for (const letter of normalizeWord(enemyWord)) counts.set(letter, (counts.get(letter) ?? 0) + 1)
  let total = 0
  for (const letter of normalizeWord(word)) {
    const available = counts.get(letter) ?? 0
    if (available > 0) { total += 1; counts.set(letter, available - 1) }
  }
  return total
}

export function buildWordPools(enemyWord: string, provider: LexicalProvider = localLexicalProvider, options: WordPoolOptions = {}): WordPools {
  const normalizedEnemy = normalizeWord(enemyWord)
  const enemy = provider.getEntry(normalizedEnemy)
  const maximumLength = Math.min(16, options.maximumLength ?? 12)
  const minimumCommonness = options.minimumCommonness ?? 0.5
  const matchCounts = new Map<string, number>()
  const matches = (word: string): number => {
    let count = matchCounts.get(word)
    if (count === undefined) {
      count = matchingLetterCount(word, normalizedEnemy)
      matchCounts.set(word, count)
    }
    return count
  }
  const allowed = (entry: LexicalEntry) => entry.word.length >= 3 && entry.word.length <= maximumLength
    && /^[A-Z]+$/.test(entry.word) && isDictionaryWord(entry.word) && !entry.properNoun
    && entry.commonness !== null && entry.commonness >= minimumCommonness
  const rank = (a: LexicalEntry, b: LexicalEntry) => matches(b.word) - matches(a.word)
    || (b.commonness ?? 0) - (a.commonness ?? 0) || a.word.length - b.word.length || a.word.localeCompare(b.word)
  const resolve = (words: readonly string[]) => [...new Set(words.map(normalizeWord))]
    .map(word => provider.getSubmittedWordEntry ? provider.getSubmittedWordEntry(word) : provider.getEntry(word))
    .filter((entry): entry is LexicalEntry => Boolean(entry && allowed(entry))).sort(rank)
  const counters = resolve(enemy?.counters ?? [])
  const counterSet = new Set(counters.map(entry => entry.word))
  const resisted = resolve(enemy?.synonyms ?? []).filter(entry => !counterSet.has(entry.word))
  const resistedSet = new Set(resisted.map(entry => entry.word))
  const related = resolve(enemy?.related ?? []).filter(entry => !counterSet.has(entry.word) && !resistedSet.has(entry.word))
  const all = [...new Map([...provider.vocabulary(), ...counters, ...resisted, ...related]
    .filter(allowed).map(entry => [entry.word, entry])).values()].sort(rank)
  const neutral = all.filter(entry => !counterSet.has(entry.word) && !resistedSet.has(entry.word))
  const grammar = all.filter(entry => (options.grammarPolicy === 'any-recognized' || entry.partsOfSpeech.length === 1)
    && entry.partsOfSpeech.includes(options.grammarPartOfSpeech ?? 'adjective'))
  const ward = neutral.filter(entry => entry.word.length <= 5 && matches(entry.word) > 0)
  const strike = resisted.filter(entry => matches(entry.word) > 0)
  const clutch = counters.filter(entry => entry.word.length >= 6 && entry.word.length <= 10 && (entry.commonness ?? 0) >= 0.65)
  const decoys = [...resisted, ...neutral.filter(entry => entry.word.length >= 5 && matches(entry.word) <= 2)].sort(rank)
  return {
    enemyWord: normalizedEnemy, providerId: provider.id,
    counters, resisted, related, neutral, grammar, ward, strike, clutch, decoys, all,
    // Serialize the complete known relation lists, even for words outside the
    // construction pool. Gameplay meaning must not depend on a pool cutoff.
    semanticRelations: {
      opposite: [...new Set(enemy?.counters.map(normalizeWord) ?? [])].filter(isDictionaryWord),
      similar: [...new Set(enemy?.synonyms.map(normalizeWord) ?? [])].filter(isDictionaryWord),
      related: [...new Set(enemy?.related.map(normalizeWord) ?? [])].filter(isDictionaryWord),
    },
    wordPartsOfSpeech: Object.fromEntries([...provider.vocabulary(), ...all].filter(entry => entry.partsOfSpeech.length).map(entry => [entry.word, entry.partsOfSpeech])),
    wordCommonness: Object.fromEntries(all.map(entry => [entry.word, entry.commonness])),
  }
}
