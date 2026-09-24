import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultRevealSeed } from '../src/intro/config.ts'
import { sampleSineTravel, sampleTravel, unwrapAngle } from '../src/intro/movement.ts'
import { getTileRevealOrder } from '../src/intro/paths.ts'

test('snake reveal alternates direction across each board row', () => {
  assert.deepEqual(getTileRevealOrder(16, 'snake'), [
    0, 1, 2, 3,
    7, 6, 5, 4,
    8, 9, 10, 11,
    15, 14, 13, 12,
  ])
  assert.deepEqual(getTileRevealOrder(8, 'snake', undefined, 3), [0, 1, 2, 5, 4, 3, 6, 7])
  assert.deepEqual(getTileRevealOrder(16), getTileRevealOrder(16, 'snake'))
})

test('optional shuffle uses a stable visual seed instead of board order', () => {
  const order = getTileRevealOrder(16, 'shuffle')
  assert.deepEqual(order, [1, 2, 7, 13, 11, 15, 4, 5, 6, 10, 8, 12, 14, 0, 9, 3])
  assert.deepEqual(order, getTileRevealOrder(16, 'shuffle', defaultRevealSeed))
  assert.notDeepEqual(order, Array.from({ length: 16 }, (_, index) => index))
})

test('a puzzle seed makes shuffle repeatable and different seeds change the route', () => {
  const first = getTileRevealOrder(16, 'shuffle', 'daily-2026-09-24')
  const second = getTileRevealOrder(16, 'shuffle', 'daily-2026-09-25')
  assert.notDeepEqual(first, second)
  assert.deepEqual(first, getTileRevealOrder(16, 'shuffle', 'daily-2026-09-24'))
  assert.deepEqual(getTileRevealOrder(16, 'shuffle', 0), getTileRevealOrder(16, 'shuffle', 0))
  assert.notDeepEqual(getTileRevealOrder(16, 'shuffle', 0), getTileRevealOrder(16, 'shuffle', 1))
})

test('both routes visit every tile position exactly once, including partial boards', () => {
  for (const mode of ['snake', 'shuffle'] as const) {
    for (const count of [0, 1, 4, 7, 16, 20]) {
      const order = getTileRevealOrder(count, mode)
      assert.equal(order.length, count)
      assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index))
    }
  }
})

test('reveal routes have no shared state and cannot reorder the gameplay tiles', () => {
  const tiles = Object.freeze([
    Object.freeze({ id: 2, letter: 'E', gem: 'power' }),
    Object.freeze({ id: 9, letter: 'E' }),
    Object.freeze({ id: 5, letter: 'Y', gem: 'ward' }),
  ])
  const snapshot = structuredClone(tiles)
  const route = getTileRevealOrder(tiles.length)
  const originalRoute = [...route]
  const visitedIds = route.map((index) => tiles[index].id)
  assert.deepEqual([...visitedIds].sort((a, b) => a - b), [2, 5, 9])
  route.reverse()
  route.push(99)
  assert.deepEqual(tiles, snapshot)
  assert.deepEqual(getTileRevealOrder(tiles.length), originalRoute)
})

test('enemy sine wave crosses the letter centerline and reaches equal peaks on both sides', () => {
  const start = { x: 20, y: 50 }
  const target = { x: 220, y: 50 }
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const point = sampleSineTravel(start, target, progress, 10)
    assert.equal(point.x, start.x + 200 * progress)
    assert.ok(Math.abs(point.y - 50) < 0.0001)
  }
  for (const [progress, y] of [[0.125, 60], [0.375, 40], [0.625, 60], [0.875, 40]]) {
    const point = sampleSineTravel(start, target, progress, 10)
    assert.ok(Math.abs(point.y - y) < 0.0001)
    assert.ok(Math.abs(point.angle) < 0.0001)
  }
})

test('sine travel faces its actual tangent without flattening between letters', () => {
  const start = { x: 20, y: 50 }
  const target = { x: 220, y: 70 }
  for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const point = sampleSineTravel(start, target, progress, 10)
    const before = sampleSineTravel(start, target, progress - 0.00001, 10)
    const after = sampleSineTravel(start, target, progress + 0.00001, 10)
    const tangent = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI
    assert.ok(Math.abs(point.angle - tangent) < 0.0001)
  }
  assert.ok(sampleSineTravel(start, target, 0.25, 10).angle < 0)
  assert.ok(sampleSineTravel(start, target, 0.5, 10).angle > 0)
  assert.ok(Math.abs(sampleSineTravel(start, target, 0.25, 10, 1).y - 65) < 0.0001)
})

test('board turns curl around the row edge and face their direction of travel', () => {
  const start = { x: 100, y: 50 }
  const target = { x: 100, y: 110 }
  for (const [curve, side] of [['turn-right', 1], ['turn-left', -1]] as const) {
    const entry = sampleTravel(start, target, 0, curve, 20)
    const middle = sampleTravel(start, target, 0.5, curve, 20)
    const exit = sampleTravel(start, target, 1, curve, 20)
    assert.deepEqual({ x: entry.x, y: entry.y }, start)
    assert.deepEqual({ x: exit.x, y: exit.y }, target)
    assert.equal(middle.x, start.x + side * 20)
    assert.ok(Math.abs(middle.angle - 90) < 0.0001)
    assert.equal(entry.angle, side === 1 ? 0 : 180)
    assert.equal(exit.angle, side === 1 ? 180 : 0)
  }
})

test('facing follows the shortest rotation across the angle boundary', () => {
  assert.equal(unwrapAngle(175, -175), 185)
  assert.equal(unwrapAngle(-175, 175), -185)
})
