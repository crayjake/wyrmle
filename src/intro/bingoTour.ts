import type { Point } from './movement.ts'
import { createWalkRoute } from './walk.ts'
import type { WalkPoint } from './walk.ts'

/** The same curved, distance-based travel as decoding. Star reveals are tied to
 * head arrivals, so changing the screen size cannot desynchronise the sparkle. */
export function createBingoTour(width: number, stars: readonly Point[]) {
  const first = stars[0], last = stars.at(-1)
  if (!first || !last) return { route: createWalkRoute([], width), arrivals: [] }
  const points: WalkPoint[] = [{ x: 12, y: first.y + 26, angle: -Math.PI / 4 }]
  const targets: number[] = []
  stars.forEach((star, index) => {
    targets.push(points.length)
    points.push({ ...star, angle: 0 })
    const next = stars[index + 1]
    if (next) points.push({ x: (star.x + next.x) / 2, y: star.y + (index % 2 ? 20 : -20), angle: 0 })
  })
  points.push({ x: width - 12, y: last.y - 26, angle: -Math.PI / 4 })
  const route = createWalkRoute(points, width)
  return { route, arrivals: targets.map(index => route.arrivals[index]) }
}
