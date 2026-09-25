import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import { meaningSupply } from '../game/meaningLexicon.ts'
import type { PuzzleWordMeaning } from '../game/meaningLexicon.ts'
import { getDictionaryMeaning } from '../lexicon/meaningDictionary.ts'
import type { DictionaryMeaning } from '../lexicon/meaningDictionary.ts'

type MeaningInspection = {
  word: string
  kind: 'stored'
  meaning: PuzzleWordMeaning
} | {
  word: string
  kind: 'outside-supply' | 'outside-length' | 'missing-record'
  meaning: DictionaryMeaning
  message: string
} | {
  word: string
  kind: 'undefined'
  message: string
}

/** DEV inspection distinguishes source gaps from this puzzle's physical limits. */
export function inspectPuzzleMeaning(encounter: LetterStrikeEncounter, query: string): MeaningInspection | null {
  const word = query.trim().toUpperCase()
  if (!word) return null
  const stored = encounter.meaningLexicon?.words[word]
  if (stored) return { word, kind: 'stored', meaning: stored }
  const meaning = getDictionaryMeaning(word)
  if (!meaning) return { word, kind: 'undefined',
    message: 'No source definition is stored for this spelling in the generator’s current dictionary. It is not accepted.' }
  if (word.length < encounter.minimumWordLength || word.length > encounter.startingTiles.length) {
    return { word, kind: 'outside-length', meaning,
      message: `Defined in the source dictionary, but outside this puzzle’s ${encounter.minimumWordLength}–${encounter.startingTiles.length} letter limit.` }
  }
  const letters = new Map<string, number>()
  for (const letter of meaningSupply(encounter)) letters.set(letter, (letters.get(letter) ?? 0) + 1)
  for (const letter of word) {
    const remaining = letters.get(letter) ?? 0
    if (remaining === 0) return { word, kind: 'outside-supply', meaning,
      message: 'Defined in the source dictionary, but cannot be spelled from this puzzle’s complete starting and refill letters. It does not need a puzzle meaning record.' }
    letters.set(letter, remaining - 1)
  }
  return { word, kind: 'missing-record', meaning,
    message: 'Defined in the current source dictionary and fits this puzzle’s supply, but missing from its frozen table. This publication needs recompiling before the word can be played.' }
}
