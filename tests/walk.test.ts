import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWalkRoute, sampleWalkingPiece, smoothTravelDistance } from '../src/intro/walk.ts'
import type { WalkPoint } from '../src/intro/walk.ts'

function close(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}

function closePoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  close(actual.x, expected.x)
  close(actual.y, expected.y)
}

const tour: WalkPoint[] = [
  { x: 73.78125, y: 65, angle: 0 },
  { x: 113, y: 83 },
  { x: 70, y: 117.5 }, { x: 128, y: 117.5 }, { x: 186, y: 117.5 },
  { x: 244, y: 117.5 }, { x: 302, y: 117.5 },
  { x: 348, y: 117.5 }, { x: 357, y: 65 },
  { x: 341, y: 65 }, { x: 317, y: 65 }, { x: 293, y: 65 },
  { x: 269, y: 65 }, { x: 245, y: 65 }, { x: 221, y: 65 },
  { x: 154, y: 65 }, { x: 24, y: 95 }, { x: 13, y: 224, angle: Math.PI / 2 },
  { x: 50, y: 270 }, { x: 141, y: 270 }, { x: 232, y: 270 }, { x: 323, y: 270 },
  { x: 346, y: 315 },
  { x: 323, y: 360 }, { x: 232, y: 360 }, { x: 141, y: 360 }, { x: 50, y: 360 },
  { x: 17, y: 405 },
  { x: 50, y: 450 }, { x: 141, y: 450 }, { x: 232, y: 450 }, { x: 323, y: 450 },
  { x: 346, y: 495 },
  { x: 323, y: 540 }, { x: 232, y: 540 }, { x: 141, y: 540 }, { x: 50, y: 540 },
  { x: 13, y: 540 }, { x: 13, y: 225 }, { x: 13, y: 108 },
  { x: 12, y: 65, angle: 0 }, { x: 73.78125, y: 65, angle: 0 },
]

test('one walk reaches enemy, refills, tiles and the dock without missing a waypoint', () => {
  const route = createWalkRoute(tour, 375)
  assert.equal(route.arrivals.length, tour.length)
  assert.equal(route.arrivals[0], 0)
  assert.equal(route.arrivals.at(-1), route.length)
  route.arrivals.forEach((distance, index) => {
    closePoint(route.sample(distance), tour[index])
    if (index > 0) assert.ok(distance > route.arrivals[index - 1])
  })
  closePoint(route.sample(route.length + 500), tour[0])
  close(route.sample(0).angle, 0)
  close(route.sample(route.length).angle % 360, 0)
})

test('the tail starts and finishes at its actual life-meter center', () => {
  const route = createWalkRoute(tour, 375)
  const offsets = [56.5, 44, 30, 16, 0]
  offsets.forEach((offset, index) => {
    const pose = sampleWalkingPiece(route, 0, offset, 0, 0, index)
    closePoint(pose, { x: tour[0].x - offset, y: tour[0].y })
    assert.equal(pose.angle, 0)
    assert.equal(pose.scaleX, 1)
    assert.equal(pose.scaleY, 1)
    const docked = sampleWalkingPiece(route, route.length, offset, 12, 0, index)
    closePoint(docked, pose)
    close(docked.angle % 360, 0)
    assert.equal(docked.scaleX, 1)
    assert.equal(docked.scaleY, 1)
  })
})

test('travel and head turns stay continuous through every reveal waypoint', () => {
  const route = createWalkRoute(tour, 375)
  for (const distance of route.arrivals.slice(1, -1)) {
    const before = route.sample(distance - 0.001)
    const at = route.sample(distance)
    const after = route.sample(distance + 0.001)
    close(Math.hypot(before.x - at.x, before.y - at.y), 0.001, 1e-6)
    close(Math.hypot(after.x - at.x, after.y - at.y), 0.001, 1e-6)
    assert.ok(Math.abs(after.angle - before.angle) < 1)
  }
  let previous = route.sample(0)
  for (let distance = 0.25; distance <= route.length; distance += 0.25) {
    const next = route.sample(distance)
    assert.ok(Math.hypot(next.x - previous.x, next.y - previous.y) <= 0.250001)
    // The angle is unwrapped rather than jumping at the +/-180 degree seam.
    const justBefore = route.sample(distance - 0.0001)
    assert.ok(Math.abs(next.angle - justBefore.angle) < 0.1)
    assert.ok(next.x >= 11 && next.x <= 364)
    previous = next
  }
})

test('wide turns stay inside both a 320px and 375px viewport', () => {
  for (const width of [320, 375]) {
    const points = [
      { x: 50, y: 50, angle: 0 }, { x: width - 20, y: 50, angle: 0 },
      { x: width - 20, y: 120, angle: Math.PI }, { x: 20, y: 120, angle: Math.PI },
      { x: 20, y: 190, angle: 0 }, { x: width - 50, y: 190, angle: 0 },
    ]
    const route = createWalkRoute(points, width)
    for (let distance = 0; distance <= route.length; distance += 0.5) {
      const pose = route.sample(distance)
      assert.ok(pose.x >= 11 && pose.x <= width - 11)
    }
  }
})

test('the footless ripple remains small, periodic and optional for a resting life meter', () => {
  const route = createWalkRoute([{ x: 50, y: 65, angle: 0 }, { x: 300, y: 65, angle: 0 }], 375)
  const base = route.sample(120)
  for (let index = 0; index < 5; index += 1) {
    for (let tick = 0; tick <= 120; tick += 1) {
      const time = tick / 60
      const pose = sampleWalkingPiece(route, 120, 0, time, 1, index)
      assert.ok(Math.abs(pose.x - base.x) <= 0.320001)
      assert.ok(Math.abs(pose.y - base.y) <= 0.850001)
      assert.ok(pose.scaleX >= 0.982 && pose.scaleX <= 1.018)
      close(pose.scaleX + pose.scaleY, 2)
      const repeat = sampleWalkingPiece(route, 120, 0, time + 1 / 1.65, 1, index)
      closePoint(repeat, pose)
      close(repeat.scaleX, pose.scaleX)
      const rest = sampleWalkingPiece(route, 120, 0, time, 0, index)
      assert.deepEqual(rest, { ...base, scaleX: 1, scaleY: 1 })
    }
  }
  assert.notDeepEqual(sampleWalkingPiece(route, 120, 0, 0.2, 1, 0), sampleWalkingPiece(route, 120, 0, 0.2, 1, 1))
})

test('departure and arrival accelerate smoothly while the middle has constant speed', () => {
  const duration = 10.2
  const length = 2000
  const distance = (time: number) => smoothTravelDistance(time, duration, length)
  assert.equal(distance(-1), 0)
  assert.equal(distance(0), 0)
  assert.equal(distance(duration), length)
  assert.equal(distance(duration + 1), length)
  assert.ok(distance(0.001) < 0.00001)
  assert.ok(length - distance(duration - 0.001) < 0.00001)
  for (let time = 0.5; time < duration - 0.6; time += 0.1) {
    close(distance(time + 0.1) - distance(time), length * 0.1 / (duration - 0.5))
  }
  for (let time = 0; time <= duration; time += 0.01) {
    close(distance(time) + distance(duration - time), length)
    assert.ok(distance(time + 0.01) >= distance(time))
  }
  // A short layout still has a valid ramp; it never reverses or divides by zero.
  for (const shortDuration of [0.1, 0.5, 1]) {
    let previous = 0
    for (let tick = 0; tick <= 100; tick += 1) {
      const next = smoothTravelDistance(shortDuration * tick / 100, shortDuration, length)
      assert.ok(Number.isFinite(next) && next >= previous && next <= length)
      previous = next
    }
    assert.equal(previous, length)
  }
})

test('missing or duplicate layout points remain finite and preserve their input', () => {
  const empty = createWalkRoute([], 375)
  assert.deepEqual(empty.arrivals, [])
  assert.deepEqual(empty.sample(0), { x: 0, y: 0, angle: 0 })
  const stationary = createWalkRoute([{ x: 50, y: 65, angle: 0 }, { x: 50, y: 65, angle: 0 }], 375)
  assert.deepEqual(stationary.arrivals, [0, 0])
  assert.deepEqual(stationary.sample(-16), { x: 34, y: 65, angle: 0 })
  const points = Object.freeze([
    Object.freeze({ x: 50, y: 65, angle: 0 }), Object.freeze({ x: 50, y: 65, angle: 0 }),
    Object.freeze({ x: 120, y: 100 }), Object.freeze({ x: 120, y: 100 }), Object.freeze({ x: 50, y: 65, angle: 0 }),
  ])
  const before = structuredClone(points)
  const route = createWalkRoute(points, 375)
  assert.deepEqual(before, points)
  assert.equal(route.arrivals[0], route.arrivals[1])
  assert.equal(route.arrivals[2], route.arrivals[3])
  route.arrivals.forEach((distance, index) => closePoint(route.sample(distance), points[index]))
  assert.deepEqual(route.sample(Number.NaN), route.sample(0))
})
