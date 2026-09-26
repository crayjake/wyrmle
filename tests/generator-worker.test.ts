import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateGeneratorRequest } from '../src/generator/workerMessages.ts'

test('generator worker accepts and normalizes a bounded manual or automatic request', () => {
  const request = { id: 1, seed: 'review-seed', enemy: ' melancholy ', candidateCount: 8 }
  assert.deepEqual(validateGeneratorRequest(request), { ...request, enemy: 'MELANCHOLY' })
  assert.equal(validateGeneratorRequest({ ...request, enemy: null }).enemy, null)
  assert.equal(request.enemy, ' melancholy ')
})

test('generator worker rejects invalid counts instead of running unbounded or empty batches', () => {
  const request = { id: 1, seed: 'review-seed', enemy: 'MELANCHOLY', candidateCount: 8 }
  for (const count of [0, -1, 101, Number.POSITIVE_INFINITY, Number.NaN, 1.5]) {
    assert.throws(() => validateGeneratorRequest({ ...request, candidateCount: count }), /between 1 and 100/)
  }
})

test('generator worker reports malformed enemy, seed and message values before generation', () => {
  const request = { id: 1, seed: 'review-seed', enemy: 'MELANCHOLY', candidateCount: 8 }
  assert.throws(() => validateGeneratorRequest(null), /Invalid/)
  assert.throws(() => validateGeneratorRequest({ ...request, enemy: '' }), /only letters/)
  assert.throws(() => validateGeneratorRequest({ ...request, enemy: 'MELAN-CHOLY' }), /only letters/)
  assert.throws(() => validateGeneratorRequest({ ...request, seed: '  ' }), /Seed/)
  assert.throws(() => validateGeneratorRequest({ ...request, seed: 'X'.repeat(129) }), /Seed/)
  assert.throws(() => validateGeneratorRequest({ ...request, id: 0 }), /Request ID/)
})

test('generator worker preserves finite zero and bounded refill choices without changing omitted defaults', () => {
  const request = { id: 1, seed: 'finite-review', enemy: 'ANGER', candidateCount: 2, includeRegenTile: true }
  assert.equal(Object.hasOwn(validateGeneratorRequest(request), 'refillLimit'), false)
  for (const refillLimit of [0, 12, 18, 24, 96]) {
    assert.deepEqual(validateGeneratorRequest({ ...request, refillLimit }), { ...request, refillLimit })
  }
  for (const refillLimit of [-1, 97, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '12', null]) {
    assert.throws(() => validateGeneratorRequest({ ...request, refillLimit }), /between 0 and 96/)
  }
})

test('generator worker preserves explicit Revive counts and rejects malformed values', () => {
  const request = { id: 1, seed: 'revive-count', enemy: 'CHAOS', candidateCount: 2, includeRegenTile: true }
  assert.equal(Object.hasOwn(validateGeneratorRequest(request), 'regenTileCount'), false)
  for (const regenTileCount of [0, 1, 2, 3]) assert.equal(validateGeneratorRequest({ ...request, regenTileCount }).regenTileCount, regenTileCount)
  for (const regenTileCount of [-1, 4, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2', null]) {
    assert.throws(() => validateGeneratorRequest({ ...request, regenTileCount }), /between 0 and 3/)
  }
})
