import assert from 'node:assert/strict'
import { test } from 'node:test'
import before from './fixtures/refill-planning-before-frequency-cache.json' with { type: 'json' }
import { dailyEncounterV4 } from '../src/daily/catalog.ts'
import { constructRefill } from '../src/generator/constructRefill.ts'
import { localLexicalProvider } from '../src/generator/lexicalProvider.ts'
import { createRandom } from '../src/generator/random.ts'

// Captured using the former full-vocabulary scan. Check complete refill plans,
// physical selections and random ordering, including repeated letters/entries.
test('cached letter rarity preserves exact unlimited and finite refill plans', () => {
  const vocabulary = [...localLexicalProvider.vocabulary().map(entry => ({ word: entry.word, commonness: entry.commonness })),
    { word: 'CHEER', commonness: 0.8 }, { word: 'CHEERY', commonness: 0.8 }]
  for (const fixture of before) {
    const actual = constructRefill(dailyEncounterV4, vocabulary, createRandom(fixture.seed), 5, fixture.limit ?? undefined)
    assert.deepEqual(actual, fixture.output, fixture.seed)
  }
})

test('refill planning does not freeze or mutate caller-owned semantic lists', () => {
  const encounter = structuredClone(dailyEncounterV4)
  const original = structuredClone(encounter)
  const vocabulary = localLexicalProvider.vocabulary().map(entry => ({ word: entry.word, commonness: entry.commonness }))
  constructRefill(encounter, vocabulary, createRandom('mutable-refill-planning'), 5, 12)
  assert.deepEqual(encounter, original)
  assert.equal(Object.isFrozen(encounter.enemy.semanticRelations), false)
  for (const entries of Object.values(encounter.enemy.semanticRelations)) assert.equal(Object.isFrozen(entries), false)
  ;(encounter.enemy.semanticRelations.opposite as string[]).push('ANOTHER')
  assert.equal(encounter.enemy.semanticRelations.opposite.at(-1), 'ANOTHER')
})
