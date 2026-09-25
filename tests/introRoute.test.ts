import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Point } from '../src/intro/movement.ts'
import { getTileRevealOrder } from '../src/intro/paths.ts'
import { createSmoothRoute } from '../src/intro/route.ts'

function close(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}

function closePoint(actual: Point, expected: Point) {
  close(actual.x, expected.x)
  close(actual.y, expected.y)
}

function angleDifference(a: number, b: number) {
  return Math.abs(((a - b + 180) % 360 + 360) % 360 - 180)
}

const snake = getTileRevealOrder(16).map((index) => ({ x: 40 + (index % 4) * 80, y: 40 + Math.floor(index / 4) * 80 }))

test('continuous reveal route passes every center in order, with clamped endpoints', () => {
  const route = createSmoothRoute(snake)
  assert.equal(route.arrivals.length, snake.length)
  assert.equal(route.arrivals[0], 0)
  assert.equal(route.arrivals.at(-1), 1)
  route.arrivals.forEach((arrival, index) => {
    closePoint(route.sample(arrival), snake[index])
    if (index > 0) assert.ok(arrival > route.arrivals[index - 1])
  })
  closePoint(route.sample(-1), snake[0])
  closePoint(route.sample(2), snake.at(-1)!)
})

test('row turns curl outward and preserve the horizontal tangent at both ends', () => {
  const route = createSmoothRoute(snake)
  for (const [start, side] of [[3, 1], [7, -1], [11, 1]]) {
    const entry = route.sample(route.arrivals[start])
    const exit = route.sample(route.arrivals[start + 1])
    const middle = route.sample((route.arrivals[start] + route.arrivals[start + 1]) / 2)
    assert.ok((middle.x - snake[start].x) * side > 20)
    close(middle.y, (snake[start].y + snake[start + 1].y) / 2)
    close(angleDifference(entry.angle, side === 1 ? 0 : 180), 0)
    close(angleDifference(exit.angle, side === 1 ? 180 : 0), 0)
    close(angleDifference(middle.angle, 90), 0)
  }
})

test('facing and speed stay continuous as the wyrm crosses tile centers and row turns', () => {
  const route = createSmoothRoute(snake)
  const delta = 0.1 / route.length
  for (const arrival of route.arrivals.slice(1, -1)) {
    const before = route.sample(arrival - delta)
    const at = route.sample(arrival)
    const after = route.sample(arrival + delta)
    assert.ok(angleDifference(before.angle, after.angle) < 1)
    close(Math.hypot(at.x - before.x, at.y - before.y), 0.1, 0.003)
    close(Math.hypot(after.x - at.x, after.y - at.y), 0.1, 0.003)
  }
  // Sample the whole route by equal distance, including the curved row joins.
  const steps = 2000
  const expected = route.length / steps
  let previous = route.sample(0)
  for (let step = 1; step <= steps; step += 1) {
    const current = route.sample(step / steps)
    close(Math.hypot(current.x - previous.x, current.y - previous.y), expected, expected * 0.03)
    previous = current
  }
})

test('optional endpoint headings support a horizontal arrival at the life meter', () => {
  const route = createSmoothRoute([{ x: 10, y: 100 }, { x: 80, y: 20 }, { x: 140, y: 10 }], 180, 0)
  close(angleDifference(route.sample(0).angle, 180), 0)
  close(angleDifference(route.sample(1).angle, 0), 0)
  closePoint(route.sample(1), { x: 140, y: 10 })
  const finalApproach = route.sample(0.999)
  assert.ok(finalApproach.x < 140)
  assert.ok(angleDifference(finalApproach.angle, 0) < 1)
})

test('partial and shuffled boards retain all arrivals and finite poses', () => {
  for (const count of [2, 3, 7, 13, 16]) {
    for (const mode of ['snake', 'shuffle'] as const) {
      const points = getTileRevealOrder(count, mode).map((index) => ({ x: (index % 4) * 80, y: Math.floor(index / 4) * 80 }))
      const route = createSmoothRoute(points)
      route.arrivals.forEach((arrival, index) => closePoint(route.sample(arrival), points[index]))
      for (let step = 0; step <= 100; step += 1) {
        const pose = route.sample(step / 100)
        assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.y) && Number.isFinite(pose.angle))
      }
    }
  }
})

test('empty, stationary, duplicate, and reversing routes are safe and do not mutate their inputs', () => {
  const empty = createSmoothRoute([])
  assert.equal(empty.length, 0)
  assert.deepEqual(empty.arrivals, [])
  assert.deepEqual(empty.sample(0.5), { x: 0, y: 0, angle: 0 })
  const single = createSmoothRoute([{ x: 7, y: 8 }], 30)
  assert.deepEqual(single.sample(1), { x: 7, y: 8, angle: 30 })
  const points = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 50, y: 0 }),
    Object.freeze({ x: 50, y: 0 }),
    Object.freeze({ x: 0, y: 0 }),
  ])
  const snapshot = structuredClone(points)
  const route = createSmoothRoute(points)
  assert.deepEqual(points, snapshot)
  assert.equal(route.arrivals[0], route.arrivals[1])
  assert.equal(route.arrivals[2], route.arrivals[3])
  route.arrivals.forEach((arrival, index) => closePoint(route.sample(arrival), points[index]))
  const turn = route.arrivals[2]
  assert.ok(angleDifference(route.sample(turn - 0.00001).angle, route.sample(turn + 0.00001).angle) < 1)
  assert.deepEqual(createSmoothRoute([{ x: 2, y: 3 }, { x: 2, y: 3 }]).arrivals, [0, 0])
})
