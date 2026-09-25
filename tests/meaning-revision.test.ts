import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { packMeaningRevision, unpackMeaningRevision } from '../src/game/meaningRevision.ts'
import { sha256 } from '../src/generator/sha256.ts'

const published = getDailyPuzzle('2026-09-25').encounter
const base = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-7', 10).encounter

test('stored meaning revisions preserve complete encounter bytes and proof fingerprints with only changed records', () => {
  const meanings = published.meaningLexicon!
  const revision = packMeaningRevision(base, meanings)
  assert.equal(revision.meaningBase, base.id)
  assert.equal(Object.keys(revision.packedMeanings.words).length, 116)
  assert.ok(JSON.stringify(revision).length < 100_000, 'Do not duplicate the full archived dictionary in v11.')
  const restored = unpackMeaningRevision(base, revision.meaningBase, JSON.parse(JSON.stringify(revision.packedMeanings)))
  assert.equal(JSON.stringify(restored), JSON.stringify(meanings))
  const materialized = { ...published, meaningLexicon: restored }
  assert.equal(JSON.stringify(materialized), JSON.stringify(published))
  assert.equal(sha256(JSON.stringify(materialized)), sha256(JSON.stringify(published)))
  assert.equal(restored.words.BAR, base.meaningLexicon!.words.BAR, 'Unchanged immutable records can be shared.')
  assert.notEqual(restored.words.CALM, base.meaningLexicon!.words.CALM)
  assert.equal(restored.words.CALM.relation, 'opposite')
  assert.equal(restored.words.AND.source, 'wiktionary-en')
  assert.ok(Object.isFrozen(restored))
  assert.ok(Object.isFrozen(restored.words))
  assert.ok(Object.isFrozen(restored.words.AND))
})

test('meaning revision transport rejects unsupported bases, mismatched supply and unversioned profiles', () => {
  const revision = packMeaningRevision(base, published.meaningLexicon!)
  assert.throws(() => unpackMeaningRevision(base, 'another-base', revision.packedMeanings), /unsupported base/)
  assert.throws(() => unpackMeaningRevision({ ...base, id: 'another-base' }, base.id, revision.packedMeanings), /unsupported base/)
  assert.throws(() => unpackMeaningRevision({ ...base, meaningLexicon: {
    ...base.meaningLexicon!, dictionaryVersion: 'unknown',
  } }, base.id, revision.packedMeanings), /unsupported base meaning version/)
  for (const patch of [
    { enemyWord: 'FEAR' }, { letterSupply: 'ABC' }, { minimumWordLength: 4 }, { maximumWordLength: 20 },
    { dictionaryVersion: 'unknown' }, { profileVersion: 'semantic-profiles-v1' },
  ]) {
    assert.throws(() => unpackMeaningRevision(base, base.id, {
      ...revision.packedMeanings, lexicon: { ...revision.packedMeanings.lexicon, ...patch },
    }), /mismatched|unsupported|invalid word spelling/i)
  }
})

test('meaning revision packing cannot drop old words or silently reorder a reviewed compilation', () => {
  const meanings = published.meaningLexicon!
  const missing = { ...meanings.words }
  delete missing.BAR
  assert.throws(() => packMeaningRevision(base, { ...meanings, words: missing }), /cannot remove base word BAR/)
  const reordered = Object.fromEntries(Object.entries(meanings.words).reverse())
  assert.throws(() => packMeaningRevision(base, { ...meanings, words: reordered }), /noncanonical compilation order/)
})
