import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTileRevealOrder } from '../src/intro/paths.ts'
import { createDecodeTour } from '../src/intro/tour.ts'
import { sampleWalkingPiece, smoothTravelDistance } from '../src/intro/walk.ts'
import { wheelLayout } from '../src/components/wheelLayout.ts'

function close(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}

function closePoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  close(actual.x, expected.x)
  close(actual.y, expected.y)
}

// The 375px fixture uses the preview's measured centers. The narrow fixture
// keeps 20px reserve tiles and the life-meter dimensions while reducing space.
function layout(width: number, refillCount = 6, tileCount = 16) {
  const height = width === 375 ? 629 : 568
  const pitch = 76.640625 * width / 375
  return {
    width,
    dock: { x: 73.78125, y: 65 },
    enemies: Array.from({ length: 5 }, (_, index) => ({ x: width / 2 + (index - 2) * 48.28125 * width / 375, y: 117.5 * height / 629 })),
    refills: Array.from({ length: refillCount }, (_, index) => ({ x: width - 23.28125 - (refillCount - index - 1) * 24, y: 65 })),
    tiles: Array.from({ length: tileCount }, (_, index) => ({
      x: (width - pitch * 3) / 2 + index % 4 * pitch,
      y: 304.6953125 * height / 629 + Math.floor(index / 4) * pitch,
    })),
    order: getTileRevealOrder(tileCount),
  }
}

test('decode tour visits enemy, then refills, then every tile exactly once at 320px and 375px', () => {
  for (const width of [320, 375]) {
    for (const refillCount of [0, 1, 6]) {
      const input = layout(width, refillCount)
      const { route, events } = createDecodeTour(input)
      const expected = [
        ...input.enemies.map((_, index) => ({ kind: 'enemy', index })),
        ...input.refills.map((_, index) => ({ kind: 'refills', index })).reverse(),
        ...input.order.map(index => ({ kind: 'tiles', index })),
      ]
      assert.deepEqual(events.map(({ kind, index }) => ({ kind, index })), expected)
      assert.equal(new Set(events.map(event => `${event.kind}:${event.index}`)).size, events.length)
      events.forEach((event, index) => {
        const group = event.kind === 'enemy' ? input.enemies : event.kind === 'refills' ? input.refills : input.tiles
        closePoint(route.sample(event.distance), group[event.index])
        if (index) assert.ok(event.distance > events[index - 1].distance)
      })
    }
  }
})

test('the continuous tour starts and ends as the exact life meter, including with no reserves', () => {
  const offsets = [56.5, 44, 30, 16, 0]
  for (const width of [320, 375]) {
    for (const refillCount of [0, 6]) {
      const input = layout(width, refillCount)
      const { route } = createDecodeTour(input)
      closePoint(route.sample(0), input.dock)
      closePoint(route.sample(route.length), input.dock)
      for (const distance of [0, route.length]) {
        offsets.forEach((offset, index) => {
          const pose = sampleWalkingPiece(route, distance, offset, 12, 0, index)
          closePoint(pose, { x: input.dock.x - offset, y: input.dock.y })
          close(pose.angle % 360, 0)
          assert.equal(pose.scaleX, 1)
          assert.equal(pose.scaleY, 1)
        })
      }
    }
  }
})

test('the whole wyrm stays visible throughout narrow and mini-phone decode tours', () => {
  const offsets = [56.5, 44, 30, 16, 0]
  const halfWidths = [4, 5.5, 5.5, 5.5, 7.5]
  const halfHeights = [4, 6, 6, 6, 7.5]
  for (const width of [320, 375]) {
    for (const refillCount of [0, 6]) {
      const input = layout(width, refillCount)
      const height = width === 375 ? 629 : 568
      const { route } = createDecodeTour(input)
      for (let frame = 0; frame <= 612; frame += 1) {
        const time = frame / 60
        const distance = smoothTravelDistance(time, 10.2, route.length)
        offsets.forEach((offset, index) => {
          const pose = sampleWalkingPiece(route, distance, offset, time, 1, index)
          // Body squares remain upright; only the square head follows the bend.
          const radians = index === 4 ? pose.angle * Math.PI / 180 : 0
          const halfWidth = Math.abs(Math.cos(radians)) * halfWidths[index] * pose.scaleX
            + Math.abs(Math.sin(radians)) * halfHeights[index] * pose.scaleY
          const halfHeight = Math.abs(Math.sin(radians)) * halfWidths[index] * pose.scaleX
            + Math.abs(Math.cos(radians)) * halfHeights[index] * pose.scaleY
          assert.ok(pose.x - halfWidth >= 0 && pose.x + halfWidth <= width,
            `${width}px part ${index} at ${time}s exceeds a horizontal edge`)
          assert.ok(pose.y - halfHeight >= 0 && pose.y + halfHeight <= height,
            `${width}px part ${index} at ${time}s exceeds a vertical edge`)
          if (index === 4) {
            for (const tongueX of [7.5, 12.5]) {
              for (const tongueY of [-2.5, 1.5]) {
                const x = pose.x + tongueX * pose.scaleX * Math.cos(radians) - tongueY * pose.scaleY * Math.sin(radians)
                const y = pose.y + tongueX * pose.scaleX * Math.sin(radians) + tongueY * pose.scaleY * Math.cos(radians)
                assert.ok(x >= 0 && x <= width && y >= 0 && y <= height,
                  `${width}px tongue at ${time}s exceeds the viewport`)
              }
            }
          }
        })
      }
    }
  }
})

test('partial and shuffled boards keep a single route and correct target arrivals', () => {
  for (const width of [320, 375]) {
    for (const count of [0, 1, 3, 7, 13, 16]) {
      for (const mode of ['snake', 'shuffle'] as const) {
        const input = layout(width, 0, count)
        input.order = getTileRevealOrder(count, mode)
        const { route, events } = createDecodeTour(input)
        const tileEvents = events.filter(event => event.kind === 'tiles')
        assert.deepEqual(tileEvents.map(event => event.index), input.order)
        tileEvents.forEach(event => closePoint(route.sample(event.distance), input.tiles[event.index]))
        closePoint(route.sample(0), input.dock)
        closePoint(route.sample(route.length), input.dock)
        for (let distance = 0; distance < route.length; distance += 5) {
          const pose = route.sample(distance)
          assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.y) && Number.isFinite(pose.angle))
        }
      }
    }
  }
})

function wheelFixture(width: number, innerCount: number, single = false, reverse = false, removed: number[] = []) {
  const input = layout(width, 0)
  const board = input.tiles.map((_, index) => ({ id: index, letter: removed.includes(index) ? '' : 'A' }))
  const ordering = board.map((_, index) => index)
  const { positions } = wheelLayout(board, reverse ? ordering.reverse() : ordering,
    new Set(board.slice(0, innerCount).map(tile => tile.id)), single, 'circle')
  const size = width - 32
  const center = { x: width / 2, y: 390 }
  return {
    ...input,
    tiles: positions.map(point => point ? { x: center.x + (point.x - 50) * size / 100,
      y: center.y + (point.y - 50) * size / 100 } : { x: 0, y: 0 }),
    wheel: { center, rings: ['outer', 'inner'].map(ring =>
      positions.flatMap((point, index) => point?.ring === ring ? [index] : [])) },
  }
}

test('wheel tours sweep each circle outside in without skipping or reassigning any physical tiles', () => {
  for (const innerCount of [0, 1, 2, 5, 8, 15, 16]) for (const single of [false, true]) {
    for (const reverse of [false, true]) for (const removed of [[], [0, 3, 5, 7, 10, 11, 15]]) {
      const input = wheelFixture(375, innerCount, single, reverse, removed)
      const before = structuredClone(input)
      const { route, events } = createDecodeTour(input)
      assert.deepEqual(input, before)
      const visits = events.filter(event => event.kind === 'tiles')
      assert.deepEqual(visits.map(event => event.index).sort((a, b) => a - b),
        input.wheel.rings.flat().sort((a, b) => a - b))
      assert.deepEqual(visits.map(event => input.wheel.rings[0].includes(event.index) ? 'outer' : 'inner'),
        [...input.wheel.rings[0].map(() => 'outer'), ...input.wheel.rings[1].map(() => 'inner')])
      visits.forEach((event, index) => {
        closePoint(route.sample(event.distance), input.tiles[event.index])
        if (index) assert.ok(event.distance > visits[index - 1].distance)
      })
      // No shortcuts through the centre/shuffle button, even for sparse rings.
      const minRadius = Math.min(...input.wheel.rings.flat().map(index =>
        Math.hypot(input.tiles[index].x - input.wheel.center.x, input.tiles[index].y - input.wheel.center.y)))
      for (let d = visits[0].distance; d <= visits.at(-1)!.distance; d += 2) {
        const pose = route.sample(d)
        assert.ok(Math.hypot(pose.x - input.wheel.center.x, pose.y - input.wheel.center.y) >= minRadius - 2)
      }
      closePoint(route.sample(route.length), input.dock)
    }
  }
})

test('spiralling avoids the old grid-order detours and keeps the whole wyrm on screen', () => {
  for (const width of [320, 375]) for (const single of [false, true]) for (const refillCount of [0, 6]) {
    const input = wheelFixture(width, 5, single)
    input.refills = layout(width, refillCount).refills
    const { route, events } = createDecodeTour(input)
    const oldTour = createDecodeTour({ ...input, wheel: undefined })
    assert.ok(route.length < oldTour.route.length * .8, 'at least 20% shorter than the criss-crossing route')
    assert.deepEqual(events.filter(event => event.kind !== 'tiles').map(({ kind, index }) => ({ kind, index })),
      oldTour.events.filter(event => event.kind !== 'tiles').map(({ kind, index }) => ({ kind, index })))
    for (let d = 0; d <= route.length; d += 2) {
      for (const offset of [0, 16, 30, 44, 56.5]) {
        const pose = sampleWalkingPiece(route, d, offset, d / 250, 1)
        const radians = offset === 0 ? pose.angle * Math.PI / 180 : 0
        const halfWidth = 7.5 * (Math.abs(Math.cos(radians)) * pose.scaleX + Math.abs(Math.sin(radians)) * pose.scaleY)
        const halfHeight = 7.5 * (Math.abs(Math.sin(radians)) * pose.scaleX + Math.abs(Math.cos(radians)) * pose.scaleY)
        assert.ok(pose.x >= halfWidth && pose.x <= width - halfWidth && pose.y >= halfHeight && pose.y <= 629 - halfHeight)
      }
    }
    // Continuous headings at tile reveals and the transition between rings.
    for (const event of events.filter(event => event.kind === 'tiles')) {
      const before = route.sample(event.distance - .1), after = route.sample(event.distance + .1)
      assert.ok(Math.abs(after.angle - before.angle) < 2)
    }
  }
})

test('empty and two-singleton wheel tours are safe', () => {
  for (const removed of [Array.from({ length: 16 }, (_, index) => index),
    Array.from({ length: 16 }, (_, index) => index).filter(index => index !== 0 && index !== 15)]) {
    const input = wheelFixture(320, 1, false, false, removed)
    const { route, events } = createDecodeTour(input)
    assert.equal(events.filter(event => event.kind === 'tiles').length, 16 - removed.length)
    closePoint(route.sample(route.length), input.dock)
    assert.ok(Number.isFinite(route.length))
  }
})
