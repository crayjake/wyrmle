import { writeFileSync } from 'node:fs'
import {
  getCoveredMeaningWords, getWordMeanings, WORD_MEANINGS_VERSION, wordMeaningsMetadata,
} from './lib/wordMeanings.ts'

// This export remains the frozen OEWN base. The definition-backed dictionary
// merges the separately versioned function-word source without rewriting it.
const bits: Partial<Record<import('../src/game/types.ts').PartOfSpeech, number>> = { noun: 1, verb: 2, adjective: 4, adverb: 8 }
const words: Record<string, [senseId: string, definition: number, lemma: string, posMask: number]> = {}
const definitions: string[] = []
const indices = new Map<string, number>()
for (const word of getCoveredMeaningWords()) {
  const record = getWordMeanings(word)
  const first = record.senses[0]
  if (!first) throw new Error(`Missing source definition for ${word}`)
  let index = indices.get(first.definition)
  if (index === undefined) {
    index = definitions.length
    definitions.push(first.definition)
    indices.set(first.definition, index)
  }
  words[word] = [first.id, index, first.lemma,
    record.senses.reduce((mask, sense) => {
      const bit = bits[sense.partOfSpeech]
      if (!bit) throw new Error(`Unsupported OEWN category: ${sense.partOfSpeech}`)
      return mask | bit
    }, 0)]
}
const output = {
  version: WORD_MEANINGS_VERSION, source: wordMeaningsMetadata.source,
  policy: 'All accepted spellings have source senses. The first source sense is a display fallback, not semantic classification; offline compilation examines the complete catalog. All attested and documented inferred POS retained.',
  words, definitions,
}
const path = new URL('../src/lexicon/data/meaning-dictionary-v1.json', import.meta.url)
writeFileSync(path, `${JSON.stringify(output)}\n`)
console.log(JSON.stringify({ words: Object.keys(words).length, definitions: definitions.length, path: path.pathname }))
