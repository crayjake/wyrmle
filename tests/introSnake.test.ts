import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Point } from '../src/intro/movement.ts'
import { getTileRevealOrder } from '../src/intro/paths.ts'
import { createGridRoute, sampleSnake } from '../src/intro/snake.ts'

function close(actual: number, expected: number, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}

function closePoint(actual: Point, expected: Point) {
  close(actual.x, expected.x)
  close(actual.y, expected.y)
}

test('grid route reaches every original waypoint along orthogonal legs', () => {
  const points = [{ x: 10, y: 20 }, { x: 50, y: 60 }, { x: 10, y: 100 }]
  const route = createGridRoute(points)
  assert.equal(route.length, 160)
  assert.deepEqual(route.arrivals, [0, 0.5, 1])
  route.arrivals.forEach((arrival, index) => closePoint(route.sample(arrival * route.length), points[index]))
  assert.deepEqual(route.sample(20), { x: 30, y: 20, angle: 0 })
  assert.deepEqual(route.sample(40), { x: 50, y: 20, angle: 90 })
  assert.deepEqual(route.sample(60), { x: 50, y: 40, angle: 90 })
  assert.deepEqual(route.sample(80), { x: 50, y: 60, angle: 180 })
  assert.deepEqual(route.sample(120), { x: 10, y: 60, angle: 90 })
})

test('equal distance samples keep a constant speed before, through, and after corners', () => {
  const route = createGridRoute([{ x: 0, y: 0 }, { x: 51, y: 0 }, { x: 51, y: 39 }, { x: -30, y: 39 }])
  let previous = route.sample(-20)
  for (let distance = -19.75; distance <= route.length + 20; distance += 0.25) {
    const current = route.sample(distance)
    close(Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y), 0.25)
    assert.ok([0, 90, 180, -90].includes(current.angle))
    previous = current
  }
  closePoint(route.sample(50.9), { x: 50.9, y: 0 })
  closePoint(route.sample(51.1), { x: 51, y: 0.1 })
})

test('the head and body turn individually at the same corner rather than rotating together', () => {
  const route = createGridRoute([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
  const offsets = [0, 16, 30, 44, 56.5]
  const atFirstTurn = sampleSnake(route, 108, offsets)
  assert.deepEqual(atFirstTurn, [
    { x: 100, y: 8, angle: 90 },
    { x: 92, y: 0, angle: 0 },
    { x: 78, y: 0, angle: 0 },
    { x: 64, y: 0, angle: 0 },
    { x: 51.5, y: 0, angle: 0 },
  ])
  const bodyFollowing = sampleSnake(route, 138, offsets)
  assert.deepEqual(bodyFollowing.map((pose) => pose.angle), [90, 90, 90, 0, 0])
  assert.deepEqual(sampleSnake(route, 160, offsets).map((pose) => pose.angle), [90, 90, 90, 90, 90])
})

test('a horizontal docking approach exactly recreates the life meter piece positions', () => {
  const route = createGridRoute([{ x: 4, y: 100 }, { x: 4, y: 20 }, { x: 60.5, y: 20 }])
  const pieces = sampleSnake(route, route.length, [56.5, 44, 30, 16, 0])
  assert.deepEqual(pieces, [
    { x: 4, y: 20, angle: 0 },
    { x: 16.5, y: 20, angle: 0 },
    { x: 30.5, y: 20, angle: 0 },
    { x: 44.5, y: 20, angle: 0 },
    { x: 60.5, y: 20, angle: 0 },
  ])
  // Tail 8px, three body pieces 11px, head 15px, with a 3px gap.
  const widths = [8, 11, 11, 11, 15]
  for (let index = 1; index < pieces.length; index += 1) {
    close(pieces[index].x - widths[index] / 2 - (pieces[index - 1].x + widths[index - 1] / 2), 3)
  }
})

test('entry and exit extensions keep trailing pieces spaced outside the route', () => {
  const route = createGridRoute([{ x: 20, y: 40 }, { x: 20, y: 10 }, { x: 50, y: 10 }])
  assert.deepEqual(route.sample(-16), { x: 20, y: 56, angle: -90 })
  assert.deepEqual(route.sample(route.length + 16), { x: 66, y: 10, angle: 0 })
  assert.deepEqual(sampleSnake(route, 0, [0, 16, 30]), [
    { x: 20, y: 40, angle: -90 },
    { x: 20, y: 56, angle: -90 },
    { x: 20, y: 70, angle: -90 },
  ])
})

test('partial, shuffled, and reversed paths preserve all reveal arrivals', () => {
  for (const count of [0, 1, 2, 3, 7, 13, 16, 20]) {
    for (const mode of ['snake', 'shuffle'] as const) {
      const points = getTileRevealOrder(count, mode).map((index) => ({ x: (index % 4) * 80, y: Math.floor(index / 4) * 80 }))
      const route = createGridRoute(points)
      assert.equal(route.arrivals.length, points.length)
      route.arrivals.forEach((arrival, index) => {
        closePoint(route.sample(arrival * route.length), points[index])
        if (index) assert.ok(arrival >= route.arrivals[index - 1])
      })
      for (let step = -10; step <= 110; step += 1) {
        const pose = route.sample(route.length * step / 100)
        assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.y) && Number.isFinite(pose.angle))
      }
    }
  }
  const reversed = createGridRoute([{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 0, y: 0 }])
  assert.deepEqual(reversed.sample(80), { x: 80, y: 0, angle: 180 })
  assert.deepEqual(reversed.sample(100), { x: 60, y: 0, angle: 180 })
})

test('duplicate and stationary routes remain safe without mutating their inputs', () => {
  const points = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 30, y: 20 }),
    Object.freeze({ x: 30, y: 20 }),
  ])
  const snapshot = structuredClone(points)
  const duplicate = createGridRoute(points)
  assert.deepEqual(points, snapshot)
  assert.deepEqual(duplicate.arrivals, [0, 0, 1, 1])
  const empty = createGridRoute([])
  assert.equal(empty.length, 0)
  assert.deepEqual(empty.arrivals, [])
  assert.deepEqual(empty.sample(0), { x: 0, y: 0, angle: 0 })
  const stationary = createGridRoute([{ x: 7, y: 8 }, { x: 7, y: 8 }])
  assert.equal(stationary.length, 0)
  assert.deepEqual(stationary.arrivals, [0, 0])
  assert.deepEqual(stationary.sample(Number.NaN), { x: 7, y: 8, angle: 0 })
  assert.deepEqual(stationary.sample(Number.POSITIVE_INFINITY), { x: 7, y: 8, angle: 0 })
  assert.deepEqual(sampleSnake(stationary, 0, [0, 16]), [
    { x: 7, y: 8, angle: 0 },
    { x: -9, y: 8, angle: 0 },
  ])
})
