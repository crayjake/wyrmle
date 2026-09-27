import assert from 'node:assert/strict'
import test from 'node:test'
import { createBingoTour } from '../src/intro/bingoTour.ts'
import { smoothTravelDistance } from '../src/intro/walk.ts'

test('the bingo swoop meets each star in order at phone and landscape widths', () => {
  for (const width of [240, 288, 320]) {
    const stars = [width / 2 - 58, width / 2, width / 2 + 58].map(x => ({ x, y: 42 }))
    const { route, arrivals } = createBingoTour(width, stars)
    assert.equal(arrivals.length, 3)
    arrivals.forEach((distance, index) => {
      const head = route.sample(distance)
      assert.ok(Math.hypot(head.x - stars[index].x, head.y - stars[index].y) < .01)
      assert.ok(distance > (arrivals[index - 1] ?? 0))
      assert.ok(distance < route.length)
    })
    let previous = 0
    for (let frame = 0; frame <= 168; frame++) {
      const distance = smoothTravelDistance(frame / 60, 2.8, route.length, .25)
      assert.ok(distance >= previous)
      const head = route.sample(distance)
      assert.ok(head.x >= 0 && head.x <= width && head.y >= 0 && head.y <= 84)
      previous = distance
    }
  }
})
