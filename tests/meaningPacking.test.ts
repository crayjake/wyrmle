import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MEANING_LEXICON_VERSION } from '../src/game/meaningLexicon.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import { packMeaningLexicon, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'

const neutral: PuzzleWordMeaning = {
  definition: 'A retained display definition.', lemma: 'example', senseId: 'source-example-sense',
  partsOfSpeech: ['verb', 'noun'], relation: 'unrelated', reason: 'No meaning bonus under the reviewed profile.',
  source: 'oewn-2025', evidence: 'defined-neutral',
}
const lexicon: PuzzleMeaningLexicon = {
  version: MEANING_LEXICON_VERSION, dictionaryVersion: 'dictionary-pinned-1', profileVersion: 'profile-pinned-2',
  policy: 'defined-only', enemyWord: 'ANGER', letterSupply: 'AABCCDEEEFGHHILLMNOPRSTUVY',
  minimumWordLength: 3, maximumWordLength: 16,
  words: {
    CARE: neutral,
    CARES: { ...neutral },
    HAPPY: { ...neutral, definition: 'Joyful — a café example with Unicode.', lemma: 'happy', senseId: 'happy-sense',
      partsOfSpeech: ['adjective'], relation: 'opposite', reason: 'Good spirits counter anger.', evidence: 'lexical-expansion' },
    ANGRY: { ...neutral, definition: 'Feeling anger.', lemma: 'angry', senseId: 'angry-sense',
      partsOfSpeech: ['adjective'], relation: 'similar', reason: 'Expresses anger.', evidence: 'reviewed-profile' },
    GRIEF: { ...neutral, definition: 'Sorrow.', lemma: 'grief', senseId: 'grief-sense', partsOfSpeech: ['noun'],
      relation: 'related', reason: 'Associated feeling.', evidence: 'lexical-expansion' },
  },
}

test('packed publication round-trip preserves every header and record field exactly', () => {
  const packed = packMeaningLexicon(lexicon)
  const decoded = unpackMeaningLexicon(JSON.parse(JSON.stringify(packed)))
  assert.deepEqual(decoded, lexicon)
  assert.equal(JSON.stringify(decoded), JSON.stringify(lexicon))
  assert.deepEqual(Object.keys(decoded.words), Object.keys(lexicon.words))
  assert.deepEqual(decoded.words.CARE.partsOfSpeech, ['verb', 'noun'])
  assert.deepEqual(packMeaningLexicon(decoded), packed)
  // Only byte-identical meanings share a record; no classification is inferred.
  assert.equal(packed.words.CARE, packed.words.CARES)
  assert.notEqual(packed.words.CARE, packed.words.HAPPY)
  assert.equal(packed.records.length, 4)
})

test('decoded records and shared POS lists are immutable and independent of transport', () => {
  const transport = JSON.parse(JSON.stringify(packMeaningLexicon(lexicon)))
  const decoded = unpackMeaningLexicon(transport)
  assert.ok(Object.isFrozen(decoded))
  assert.ok(Object.isFrozen(decoded.words))
  assert.ok(Object.isFrozen(decoded.words.CARE))
  assert.ok(Object.isFrozen(decoded.words.CARE.partsOfSpeech))
  assert.equal(decoded.words.CARE, decoded.words.CARES)
  transport.partsOfSpeech[0][0] = 'adverb'
  transport.strings[0] = 'Changed externally'
  assert.deepEqual(decoded.words.CARE.partsOfSpeech, ['verb', 'noun'])
  assert.equal(decoded.words.CARE.definition, neutral.definition)
  assert.throws(() => (decoded.words.CARE.partsOfSpeech as string[]).push('adverb'))
})

test('packing leaves the input untouched and works for an empty word table', () => {
  const before = structuredClone(lexicon)
  const packed = packMeaningLexicon(lexicon)
  assert.deepEqual(lexicon, before)
  assert.ok(!Object.isFrozen(lexicon))
  assert.ok(!Object.isFrozen(lexicon.words.CARE.partsOfSpeech))
  assert.ok(Object.isFrozen(packed.records[0]))
  const empty = { ...lexicon, words: {} }
  assert.deepEqual(unpackMeaningLexicon(packMeaningLexicon(empty)), empty)
})

test('decoder rejects corrupted indices, tuples, vocabulary and unsupported versions', () => {
  const corruptions: ((data: ReturnType<typeof JSON.parse>) => void)[] = [
    data => { data.packingVersion = 'future-version' },
    data => { data.lexicon.version = 'unsupported-rules' },
    data => { data.lexicon.maximumWordLength = -1 },
    data => { data.words.CARE = 999_999 },
    data => { data.words.CARE = -1 },
    data => { data.words.CARE = 0.5 },
    data => { data.words['NOT A WORD'] = 0 },
    data => { data.records[0].pop() },
    data => { data.records[0][0] = 999_999 },
    data => { data.records[0][3] = 999_999 },
    data => { data.partsOfSpeech[0][0] = 'invented-category' },
    data => { data.strings[data.records[0][4]] = 'invented-relation' },
    data => { data.strings[data.records[0][6]] = 'unattributed-source' },
    data => { data.strings[data.records[0][7]] = 'invented-evidence' },
  ]
  for (const corrupt of corruptions) {
    const packed = JSON.parse(JSON.stringify(packMeaningLexicon(lexicon)))
    corrupt(packed)
    assert.throws(() => unpackMeaningLexicon(packed), /Invalid packed puzzle meanings/)
  }
})
