import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyseEnemySuitability } from '../src/generator/enemySuitability.ts'
import { localLexicalProvider } from '../src/generator/lexicalProvider.ts'
import type { LexicalEntry, LexicalProvider } from '../src/generator/lexicalProvider.ts'

const original = localLexicalProvider.getEntry('CHAOS')!
function provider(patch: Partial<LexicalEntry>): LexicalProvider {
  return { ...localLexicalProvider, getEntry: word => word.trim().toUpperCase() === 'CHAOS'
    ? { ...original, ...patch } : localLexicalProvider.getEntry(word) }
}

test('a complete model classification needs counters and resisted words without inventing a related-neutral class', () => {
  const entry = { semanticSource: 'offline-model' as const, related: [] }
  const assessed = analyseEnemySuitability('CHAOS', provider(entry))
  assert.equal(assessed.eligible, true)
  assert.deepEqual(assessed.rejectionReasons, [])
  assert.equal(assessed.relatedCount, 0)
  assert.equal(assessed.counterCount, original.counters.length)
  assert.equal(assessed.resistedCount, original.synonyms.length)
  assert.deepEqual(entry.related, [], 'Suitability must not fabricate semantic labels.')
  const withRelated = analyseEnemySuitability('CHAOS', provider({ ...entry, related: original.related }))
  assert.equal(withRelated.overallScore, assessed.overallScore, 'Related labels have no score weight for the model schema.')
  assert.equal(assessed.overallScore, 0.936, 'The remaining model score weights are normalized to sum to one.')
})

test('archived provider scores and related-vocabulary requirements are unchanged', () => {
  const existing = analyseEnemySuitability('CHAOS', localLexicalProvider)
  assert.equal(existing.overallScore, 0.941)
  assert.equal(existing.eligible, true)
  const noRelated = analyseEnemySuitability('CHAOS', provider({ related: [] }))
  assert.equal(noRelated.overallScore, 0.871)
  assert.equal(noRelated.eligible, false)
  assert.deepEqual(noRelated.rejectionReasons, ['Insufficient related vocabulary (0/4).'])
})

test('model providers retain counter, resistance, familiarity, source-definition and enemy-sense gates', () => {
  const cases: [Partial<LexicalEntry>, RegExp][] = [
    [{ counters: ['CALM'] }, /counter vocabulary/],
    [{ synonyms: ['CHAOTIC'] }, /resisted vocabulary/],
    [{ commonness: null }, /Familiarity is unknown/],
    [{ commonness: 0.1 }, /Low familiarity/],
    [{ definition: '' }, /inadequate definition/],
    [{ partsOfSpeech: ['noun', 'verb'] }, /clear part of speech/],
    [{ properNoun: true }, /Proper nouns/],
    [{ counters: ['TIDY', 'TIDIED', 'TIDIER', 'TIDIEST', 'TIDILY', 'TIDYING'] }, /cover too few enemy letters/],
  ]
  for (const [patch, reason] of cases) {
    const result = analyseEnemySuitability('CHAOS', provider({ semanticSource: 'offline-model', related: [], ...patch }))
    assert.equal(result.eligible, false)
    assert.ok(result.rejectionReasons.some(value => reason.test(value)), String(reason))
    assert.ok(!result.rejectionReasons.some(value => /related vocabulary/.test(value)))
  }
})
