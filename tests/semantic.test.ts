import assert from 'node:assert/strict'
import test from 'node:test'
import { getSemanticRelation } from '../src/game/semantic.ts'
import type { EnemyConcept } from '../src/game/types.ts'

test('immutable relation lookup preserves normalization and overlapping-group precedence', () => {
  const enemy = { semanticRelations: {
    opposite: Object.freeze([' calm ', 'Peace', 'SHARED']),
    similar: Object.freeze([' anger ', 'shared']), related: Object.freeze(['WORRY', 'ANGER']),
  } }
  for (let repeat = 0; repeat < 3; repeat++) {
    for (const [word, relation] of [[' CALM ', 'opposite'], ['peace', 'opposite'], ['shared', 'opposite'],
      ['anger', 'similar'], ['worry', 'related'], ['cat', 'unrelated']] as const) {
      assert.equal(getSemanticRelation(word, enemy), relation)
    }
  }
})

test('mutable relations and replacement arrays cannot reuse a stale semantic index', () => {
  const opposite = ['CALM']
  const enemy: Pick<EnemyConcept, 'semanticRelations'> = { semanticRelations: {
    opposite, similar: Object.freeze(['ANGER']), related: [],
  } }
  assert.equal(getSemanticRelation('CALM', enemy), 'opposite')
  opposite.splice(0, 1, 'PEACE')
  assert.equal(getSemanticRelation('CALM', enemy), 'unrelated')
  assert.equal(getSemanticRelation('PEACE', enemy), 'opposite')
  Object.freeze(opposite)
  assert.equal(getSemanticRelation('PEACE', enemy), 'opposite')
  enemy.semanticRelations.opposite = Object.freeze(['CALM'])
  assert.equal(getSemanticRelation('PEACE', enemy), 'unrelated')
  assert.equal(getSemanticRelation('CALM', enemy), 'opposite')
  assert.equal(getSemanticRelation('ANGER', enemy), 'similar')
})
