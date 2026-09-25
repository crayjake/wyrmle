import type { Point } from './movement.ts'

export type SnakePose = Point & { angle: number }

export type GridRoute = {
  length: number
  /** Normalized travel distance at every supplied point, including duplicates. */
  arrivals: number[]
  /** Distance in pixels; values outside the route extend its first or last leg. */
  sample: (distance: number) => SnakePose
}

type Leg = {
  start: Point
  distance: number
  length: number
  direction: Point
  angle: number
}

/**
 * An orthogonal path sampled by distance, so every piece moves at the same
 * speed and turns only when it reaches the corner itself. Diagonal waypoints
 * are joined horizontally first, then vertically.
 */
export function createGridRoute(points: readonly Point[]): GridRoute {
  const origin = { ...(points[0] ?? { x: 0, y: 0 }) }
  const legs: Leg[] = []
  const distances: number[] = points.length ? [0] : []
  let previous = origin
  let length = 0

  function append(end: Point) {
    const dx = end.x - previous.x
    const dy = end.y - previous.y
    const legLength = Math.abs(dx) + Math.abs(dy)
    if (legLength === 0) return
    const direction = { x: dx / legLength, y: dy / legLength }
    const angle = dx > 0 ? 0 : dx < 0 ? 180 : dy > 0 ? 90 : -90
    legs.push({ start: previous, distance: length, length: legLength, direction, angle })
    length += legLength
    previous = { ...end }
  }

  for (const point of points.slice(1)) {
    append({ x: point.x, y: previous.y })
    append(point)
    distances.push(length)
  }

  return {
    length,
    arrivals: distances.map((distance) => length ? distance / length : 0),
    sample(distance) {
      const target = Number.isFinite(distance) ? distance : 0
      // A stationary route still has a horizontal heading, allowing the body
      // to rest behind its head when there is only a docking point.
      if (legs.length === 0) return { x: origin.x + target, y: origin.y, angle: 0 }

      let low = 0
      let high = legs.length - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        const leg = legs[middle]
        if (target >= leg.distance + leg.length) low = middle + 1
        else high = middle
      }
      const leg = legs[low]
      const along = target - leg.distance
      return {
        x: leg.start.x + leg.direction.x * along,
        y: leg.start.y + leg.direction.y * along,
        angle: leg.angle,
      }
    },
  }
}

/** Body offsets are distances behind the head, in the caller's render order. */
export function sampleSnake(
  route: GridRoute,
  headDistance: number,
  offsets: readonly number[],
): SnakePose[] {
  return offsets.map((offset) => route.sample(headDistance - offset))
}
