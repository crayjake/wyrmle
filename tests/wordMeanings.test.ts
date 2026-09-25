import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import {
  getMeaningCoverage, getMeaningSense, getMeaningSynset, getWordMeanings,
  WORD_MEANINGS_VERSION, wordMeaningsMetadata,
} from '../scripts/lib/wordMeanings.ts'

test('meaning catalog preserves exact source senses and ambiguous readings', () => {
  const cheerful = getWordMeanings(' cheerful ')
  assert.equal(cheerful.version, WORD_MEANINGS_VERSION)
  assert.equal(cheerful.status, 'covered')
  assert.equal(cheerful.senses.length, 2)
  assert.equal(cheerful.senses[0].id, 'oewn-cheerful__3.00.00..')
  assert.equal(cheerful.senses[0].definition, 'being full of or promoting cheer; having or showing good spirits')
  assert.equal(cheerful.senses[0].partOfSpeech, 'adjective')
  assert.equal(cheerful.senses[0].form, 'lemma')
  assert.ok(cheerful.senses[0].relations.some(edge => edge.type === 'antonym' && edge.target === 'oewn-depressing__3.00.00..'))
  // The five distinct readings are retained, not flattened into one guess.
  assert.equal(getWordMeanings('CAREFUL').senses.length, 5)
  assert.ok(getWordMeanings('CAREFUL').senses.some(sense => sense.definition === 'full of cares or anxiety'))
  assert.deepEqual([...new Set(getWordMeanings('DIRTY').senses.map(sense => sense.partOfSpeech))].sort(), ['adjective', 'verb'])
})

test('meaning evidence distinguishes source irregulars from inferred forms', () => {
  assert.ok(getWordMeanings('CHILDREN').senses.some(sense => sense.lemma === 'child' && sense.form === 'explicit'))
  assert.ok(getWordMeanings('DIRTIER').senses.some(sense => sense.lemma === 'dirty' && sense.form === 'explicit'))
  assert.ok(getWordMeanings('WORRIES').senses.every(sense => sense.lemma === 'worry' && sense.form === 'morphology'))
  assert.ok(getWordMeanings('WALKED').senses.every(sense => sense.partOfSpeech === 'verb' && sense.form === 'morphology'))
  const readings = getWordMeanings('READING').senses
  assert.ok(readings.some(sense => sense.partOfSpeech === 'noun' && sense.form === 'lemma'))
  assert.ok(readings.some(sense => sense.partOfSpeech === 'verb' && sense.form === 'morphology'))
})

test('uncovered spellings stay explicitly missing; complete coverage reports expose the gap', () => {
  assert.deepEqual(getWordMeanings('AWFY'), {
    word: 'AWFY', version: WORD_MEANINGS_VERSION, status: 'missing', senses: [],
  })
  assert.equal(getWordMeanings('NOTAWORDQQQ').status, 'missing')
  assert.deepEqual(getMeaningCoverage(['careful', 'CAREFUL', ' AWFY ', 'cheerful']), {
    total: 3, covered: 2, missing: ['AWFY'],
  })
  const all = getMeaningCoverage(englishWords)
  assert.equal(all.total, wordMeaningsMetadata.coverage.dictionaryWords)
  assert.equal(all.covered, wordMeaningsMetadata.coverage.coveredWords)
  assert.equal(all.missing.length, wordMeaningsMetadata.coverage.missingWords)
})

test('sense and synset edges resolve across the complete source graph', () => {
  const anger = getMeaningSense('oewn-anger__1.12.00..')!
  assert.equal(anger.definition, 'a strong emotion; a feeling that is oriented toward some real or supposed grievance')
  const synset = getMeaningSynset(anger.synset)!
  assert.ok(synset.senses.includes(anger.id))
  for (const edge of anger.relations) assert.ok(getMeaningSense(edge.target)?.definition, edge.target)
  for (const edge of synset.relations) assert.ok(getMeaningSynset(edge.target)?.definition, edge.target)
  assert.equal(getMeaningSense('missing'), undefined)
  assert.equal(getMeaningSynset('missing'), undefined)
})

test('compressed catalog pins source, complete relation targets and definitions', () => {
  const bytes = readFileSync(new URL('../src/lexicon/data/oewn-2025-meanings-v1.json.gz', import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), wordMeaningsMetadata.catalog.sha256)
  assert.equal(bytes.length, wordMeaningsMetadata.catalog.bytes)
  const decoded = gunzipSync(bytes)
  assert.equal(decoded.length, wordMeaningsMetadata.catalog.uncompressedBytes)
  const catalog = JSON.parse(decoded.toString())
  assert.equal(catalog.version, WORD_MEANINGS_VERSION)
  assert.equal(catalog.senses.length, wordMeaningsMetadata.coverage.senses)
  assert.equal(catalog.synsets.length, wordMeaningsMetadata.coverage.synsets)
  for (const [, entry, synset, edges] of catalog.senses) {
    assert.ok(catalog.entries[entry])
    assert.ok(catalog.synsets[synset])
    for (const [, target] of edges) assert.ok(catalog.senses[target])
  }
  for (const [, , definitions, edges] of catalog.synsets) {
    assert.ok(definitions.length > 0 && definitions.every((definition: string) => definition.length > 0))
    for (const [, target] of edges) assert.ok(catalog.synsets[target])
  }
  assert.equal(wordMeaningsMetadata.source.license, 'CC-BY-4.0')
})

test('meaning consumers cannot mutate shared evidence', () => {
  const meanings = getWordMeanings('CHEERFUL')
  assert.ok(Object.isFrozen(meanings))
  assert.ok(Object.isFrozen(meanings.senses[0].relations))
  assert.ok(Object.isFrozen(getMeaningSynset(meanings.senses[0].synset)?.senses))
  assert.throws(() => (meanings.senses as unknown[]).push({}))
})
