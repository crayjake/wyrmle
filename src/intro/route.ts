import type { Point } from './movement.ts'

type Pose = Point & { angle: number }
type Curve = { start: Point; first: Point; second: Point; end: Point }
type ArcSample = { distance: number; edge: number; t: number }

export type SmoothRoute = {
  length: number
  /** Normalized travel distance at each supplied point, including duplicates. */
  arrivals: number[]
  sample: (progress: number) => Pose
}

const samplesPerEdge = 64
const epsilon = 1e-8

function direction(from: Point, to: Point): Point {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  return distance > epsilon
    ? { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance }
    : { x: 1, y: 0 }
}

function fromAngle(angle: number): Point {
  const radians = angle * Math.PI / 180
  return { x: Math.cos(radians), y: Math.sin(radians) }
}

function tangent(points: readonly Point[], index: number): Point {
  if (index === 0) return direction(points[0], points[1])
  if (index === points.length - 1) return direction(points[index - 1], points[index])
  const incoming = direction(points[index - 1], points[index])
  const outgoing = direction(points[index], points[index + 1])

  // At a snake row's edge, keep facing along its horizontal lane. The shared
  // tangent then carries the turn outside the row and into the next lane.
  if (Math.abs(incoming.y) < epsilon && Math.abs(outgoing.x) < epsilon) return incoming
  if (Math.abs(incoming.x) < epsilon && Math.abs(outgoing.y) < epsilon) return outgoing

  const sum = { x: incoming.x + outgoing.x, y: incoming.y + outgoing.y }
  const magnitude = Math.hypot(sum.x, sum.y)
  if (magnitude > epsilon) return { x: sum.x / magnitude, y: sum.y / magnitude }

  // A shuffled route can double back exactly. A perpendicular tangent makes
  // that a rounded loop instead of a zero-speed cusp at the waypoint.
  return { x: -incoming.y, y: incoming.x }
}

function evaluate(curve: Curve, t: number): Pose {
  const u = 1 - t
  const { start, first, second, end } = curve
  const dx = 3 * (u * u * (first.x - start.x) + 2 * u * t * (second.x - first.x) + t * t * (end.x - second.x))
  const dy = 3 * (u * u * (first.y - start.y) + 2 * u * t * (second.y - first.y) + t * t * (end.y - second.y))
  return {
    x: u * u * u * start.x + 3 * u * u * t * first.x + 3 * u * t * t * second.x + t * t * t * end.x,
    y: u * u * u * start.y + 3 * u * u * t * first.y + 3 * u * t * t * second.y + t * t * t * end.y,
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
  }
}

/** One uninterrupted visual route, sampled by distance rather than by edge. */
export function createSmoothRoute(
  points: readonly Point[],
  startAngle?: number,
  endAngle?: number,
): SmoothRoute {
  const distinct: Point[] = []
  const originalIndices: number[] = []
  for (const point of points) {
    const previous = distinct.at(-1)
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > epsilon) {
      distinct.push({ ...point })
    }
    originalIndices.push(distinct.length - 1)
  }

  if (distinct.length < 2) {
    const pose = { ...(distinct[0] ?? { x: 0, y: 0 }), angle: startAngle ?? endAngle ?? 0 }
    return { length: 0, arrivals: points.map(() => 0), sample: () => ({ ...pose }) }
  }

  const tangents = distinct.map((_, index) => tangent(distinct, index))
  if (startAngle !== undefined) tangents[0] = fromAngle(startAngle)
  if (endAngle !== undefined) tangents[tangents.length - 1] = fromAngle(endAngle)

  const curves: Curve[] = []
  const arc: ArcSample[] = [{ distance: 0, edge: 0, t: 0 }]
  const distances = [0]
  let length = 0
  for (let edge = 0; edge < distinct.length - 1; edge += 1) {
    const start = distinct[edge]
    const end = distinct[edge + 1]
    const handle = Math.hypot(end.x - start.x, end.y - start.y) * 0.4
    const curve = {
      start,
      first: { x: start.x + tangents[edge].x * handle, y: start.y + tangents[edge].y * handle },
      second: { x: end.x - tangents[edge + 1].x * handle, y: end.y - tangents[edge + 1].y * handle },
      end,
    }
    curves.push(curve)
    let previous = start
    for (let step = 1; step <= samplesPerEdge; step += 1) {
      const t = step / samplesPerEdge
      const current = evaluate(curve, t)
      length += Math.hypot(current.x - previous.x, current.y - previous.y)
      arc.push({ distance: length, edge, t })
      previous = current
    }
    distances.push(length)
  }

  return {
    length,
    arrivals: originalIndices.map((index) => distances[index] / length),
    sample(progress) {
      const target = Math.max(0, Math.min(1, Number.isNaN(progress) ? 0 : progress)) * length
      let low = 1
      let high = arc.length - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        if (arc[middle].distance < target) low = middle + 1
        else high = middle
      }
      const before = arc[low - 1]
      const after = arc[low]
      const fraction = (target - before.distance) / (after.distance - before.distance)
      // An edge's first sample follows the previous edge's t=1 sample.
      const beforeT = before.edge === after.edge ? before.t : 0
      return evaluate(curves[after.edge], beforeT + (after.t - beforeT) * fraction)
    },
  }
}
