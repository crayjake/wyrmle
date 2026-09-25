import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import { getPartsOfSpeech, isDictionaryWord } from '../src/game/dictionary.ts'
import {
  getLexicalPartsOfSpeech, getLexicalPosEvidence, getLexicalPosSource,
  getLexicalRelations, lexiconMetadata, LEXICON_VERSION,
} from '../src/lexicon/index.ts'

test('broad source preserves every recognized category instead of dropping ambiguous adjectives', () => {
  assert.deepEqual(getLexicalPartsOfSpeech(' dirty '), ['verb', 'adjective'])
  assert.deepEqual(getLexicalPartsOfSpeech('FAIR'), ['noun', 'verb', 'adjective', 'adverb'])
  assert.deepEqual(getLexicalPartsOfSpeech('WORRY'), ['noun', 'verb'])
  assert.deepEqual(getLexicalPartsOfSpeech('WORRIED'), ['verb', 'adjective'])
  for (const word of ['DIRE', 'DRY', 'AIRY', 'DAFT', 'DEAD', 'FAIR', 'FRAIL', 'FROSTY', 'READY', 'ROSY', 'SHADY', 'SORRY', 'TIRED', 'WEARY', 'WILD']) {
    assert.ok(getLexicalPartsOfSpeech(word)?.includes('adjective'), word)
  }
})

test('explicit irregular forms and conservative regular inflections keep source evidence', () => {
  assert.deepEqual(getLexicalPartsOfSpeech('DIRTIER'), ['adjective'])
  assert.deepEqual(getLexicalPartsOfSpeech('CHILDREN'), ['noun'])
  assert.equal(getLexicalPosSource('DIRTIER'), 'wordnet')
  assert.equal(getLexicalPosSource('CHILDREN'), 'wordnet')
  assert.deepEqual(getLexicalPartsOfSpeech('WORRIES'), ['noun', 'verb'])
  assert.equal(getLexicalPosSource('WORRIES'), 'morphology')
  assert.deepEqual(getLexicalPartsOfSpeech('NICEST'), ['adjective'])
  assert.equal(getLexicalPosSource('NICEST'), 'morphology')
  assert.deepEqual(getLexicalPosEvidence('READING'), { wordnet: ['noun'], morphology: ['verb'] })
  // A valid participle is not evidence of a separate adjective sense.
  assert.deepEqual(getLexicalPartsOfSpeech('WALKED'), ['verb'])
})

test('missing lexical metadata stays unknown without invalidating dictionary words or rewriting legacy POS', () => {
  assert.equal(isDictionaryWord('AWFY'), true)
  assert.equal(getLexicalPartsOfSpeech('AWFY'), undefined)
  assert.equal(getLexicalPosSource('AWFY'), 'unknown')
  assert.equal(getLexicalPartsOfSpeech('NOTAWORDQQQ'), undefined)
  assert.equal(getPartsOfSpeech('DIRTY'), undefined)
  assert.deepEqual(getPartsOfSpeech('CALM'), ['noun', 'verb', 'adjective'])
})

test('source and dictionary fingerprints make the versioned coverage report reproducible', () => {
  assert.equal(lexiconMetadata.version, LEXICON_VERSION)
  assert.equal(lexiconMetadata.source.license, 'CC-BY-4.0')
  assert.match(lexiconMetadata.source.sha256, /^[a-f0-9]{64}$/)
  const dictionary = readFileSync(new URL('../node_modules/an-array-of-english-words/index.json', import.meta.url))
  assert.equal(createHash('sha256').update(dictionary).digest('hex'), lexiconMetadata.dictionary.sha256)
  const covered = englishWords.filter(word => getLexicalPartsOfSpeech(word))
  assert.equal(covered.length, lexiconMetadata.coverage.coveredWords)
  assert.equal(covered.length + lexiconMetadata.coverage.unknownWords, englishWords.length)
  assert.ok(covered.length > 100_000)
  assert.equal(covered.filter(word => getLexicalPosSource(word) === 'wordnet').length, lexiconMetadata.coverage.wordnetWords)
  assert.equal(covered.filter(word => getLexicalPosSource(word) === 'morphology').length, lexiconMetadata.coverage.morphologyOnlyWords)
})

test('semantic relations preserve exact enemy sense scope and explicit antonyms', () => {
  const despair = getLexicalRelations(' despair ')!
  assert.equal(despair.provenance.sense, 'oewn-despair__1.12.00..')
  assert.ok(despair.opposite.includes('HOPE'))
  assert.ok(despair.opposite.includes('HOPES'))
  assert.ok(despair.related.includes('DESPAIRING'))
  assert.ok(!despair.similar.includes('WORRY'))
  assert.ok(!despair.opposite.includes('WORRY'))
  assert.equal(getLexicalRelations('UNSUPPORTED'), undefined)
  assert.equal(getLexicalRelations('CHAOS')?.provenance.sense, 'oewn-chaos__1.26.00..')
  assert.equal(getLexicalRelations('FEAR')?.provenance.sense, 'oewn-fear__1.12.00..')
  for (const enemy of ['ANGER', 'CHAOS', 'CRUELTY', 'DESPAIR', 'FEAR', 'MELANCHOLY']) {
    const relations = getLexicalRelations(enemy)!
    const all = [...relations.similar, ...relations.opposite, ...relations.related]
    assert.equal(new Set(all).size, all.length, enemy)
    assert.ok(all.every(isDictionaryWord), enemy)
  }
})

test('consumers cannot mutate versioned lexical records or relation lists', () => {
  assert.equal(Object.isFrozen(getLexicalPartsOfSpeech('DIRTY')), true)
  assert.equal(Object.isFrozen(lexiconMetadata.coverage), true)
  assert.equal(Object.isFrozen(getLexicalRelations('DESPAIR')?.opposite), true)
  assert.throws(() => (getLexicalPartsOfSpeech('DIRTY') as string[]).push('noun'))
})
