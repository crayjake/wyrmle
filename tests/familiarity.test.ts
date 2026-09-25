import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import data from '../src/generator/data/familiarity-v1.json' with { type: 'json' }
import lock from '../scripts/familiarity/wordfreq-lock.json' with { type: 'json' }
import { getDefinedDictionaryWords, MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'
import { getWordCommonness, localLexicalProvider } from '../src/generator/lexicalProvider.ts'
import { meaningLexicalProvider } from '../src/generator/meaningCompiler.ts'
import { GENERATION_COMMONNESS_SOURCE, getGenerationFamiliarVocabulary, getGenerationObservedVocabulary,
  getGenerationWordCommonness, getGenerationWordZipf } from '../src/generator/familiarity.ts'

test('familiarity data queries the exact complete admitted dictionary and preserves corpus provenance', () => {
  const dictionary = [...getDefinedDictionaryWords()].sort()
  const words = data.bins.flatMap(([, words]) => String(words).split(' ').filter(Boolean)).sort()
  assert.deepEqual(words, dictionary)
  assert.equal(new Set(words).size, words.length)
  assert.equal(data.dictionaryVersion, MEANING_DICTIONARY_VERSION)
  assert.equal(data.dictionaryDigest, createHash('sha256').update(`${dictionary.join('\n')}\n`).digest('hex'))
  assert.deepEqual(data.source, lock)
  assert.equal(data.counts.queried, dictionary.length)
  assert.equal(data.counts.observed + data.counts.unobserved, data.counts.queried)
  assert.equal(getGenerationObservedVocabulary().length, data.counts.observed)
  assert.equal(getGenerationFamiliarVocabulary().length, data.counts.familiar)
  for (const word of dictionary) {
    const score = getGenerationWordCommonness(word)
    assert.ok(score !== null && score >= 0 && score <= 1, word)
  }
})

test('corpus familiarity fills ordinary missing vocabulary without promoting rare or unknown spellings', () => {
  // Values from pinned wordfreq 3.1.1's public English corpus, not editorial overrides.
  const measured = { COOL: 5.15, COOLER: 3.96, COHERENT: 3.63, COHERE: 1.99, CONCORD: 3.47,
    COORDINATE: 3.82, HARMONIC: 3.33, CHORD: 3.65, CLOSE: 5.36, COMB: 3.52 }
  for (const [word, zipf] of Object.entries(measured)) {
    assert.equal(getGenerationWordZipf(word), zipf)
    assert.equal(getWordCommonness(word), null, `${word}: archived curated score changed`)
  }
  assert.equal(getGenerationWordZipf(' cooler '), 3.96)
  assert.ok(getGenerationWordCommonness('COOLER')! >= 0.5)
  assert.ok(getGenerationWordCommonness('COHERE')! < 0.5)
  assert.equal(getGenerationWordCommonness('XYZXYZXYZ'), null)
  const unobserved = String(data.bins.find(([score]) => score === 0)![1]).split(' ')
  assert.equal(unobserved.length, data.counts.unobserved)
  for (const word of unobserved) assert.equal(getGenerationWordCommonness(word), 0)
  assert.throws(() => getGenerationFamiliarVocabulary(Number.NaN))
})

test('model-era construction uses the corpus vocabulary while archived generation remains unchanged', () => {
  assert.ok(meaningLexicalProvider.id.includes(GENERATION_COMMONNESS_SOURCE))
  assert.equal(meaningLexicalProvider.vocabulary().length, data.counts.observed)
  assert.equal(meaningLexicalProvider.getEntry('COOL')?.commonnessSource, 'corpus-frequency')
  assert.equal(meaningLexicalProvider.getEntry('COOL')?.commonness, 1)
  assert.equal(localLexicalProvider.getEntry('COOL')?.commonnessSource, 'unknown')
  assert.ok(localLexicalProvider.vocabulary().length < 1000)
  assert.equal(meaningLexicalProvider.getEntry(' cool '), meaningLexicalProvider.getEntry('COOL'))
  assert.equal(meaningLexicalProvider.vocabulary(), meaningLexicalProvider.vocabulary())
  assert.ok(Object.isFrozen(meaningLexicalProvider))
  for (const entry of meaningLexicalProvider.vocabulary()) {
    assert.ok(Object.isFrozen(entry))
    for (const list of [entry.partsOfSpeech, entry.synonyms, entry.counters, entry.related]) assert.ok(Object.isFrozen(list))
  }
})
