import type { Point } from './movement.ts'

export type WalkPoint = Point & {
  /** Optional travel direction in radians. */
  angle?: number
}

export type WalkPose = Point & {
  /** Continuous heading in degrees, suitable for a CSS rotation. */
  angle: number
}

export type WalkRoute = {
  length: number
  /** Absolute distance in pixels at each input waypoint, including duplicates. */
  arrivals: number[]
  /** Negative distances extend the initial tangent; the end is clamped. */
  sample: (distance: number) => WalkPose
}

type ArcSample = WalkPose & { distance: number }

const tau = Math.PI * 2
const epsilon = 1e-8
const samplesPerEdge = 48
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

function direction(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  return length > epsilon ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : { x: 1, y: 0 }
}

function tangent(points: readonly WalkPoint[], index: number): Point {
  const point = points[index]
  if (point.angle !== undefined) return { x: Math.cos(point.angle), y: Math.sin(point.angle) }
  if (index === 0) return direction(point, points[1])
  if (index === points.length - 1) return direction(points[index - 1], point)
  const previous = points[index - 1]
  const next = points[index + 1]
  if (Math.hypot(next.x - previous.x, next.y - previous.y) > epsilon) return direction(previous, next)
  // A route doubling back needs a rounded turn, rather than a zero tangent.
  const incoming = direction(previous, point)
  return { x: -incoming.y, y: incoming.x }
}

function continuousAngle(radians: number, previous?: number): number {
  const degrees = radians * 180 / Math.PI
  if (previous === undefined) return degrees
  return previous + ((degrees - previous + 180) % 360 + 360) % 360 - 180
}

/**
 * The footless walking study's cubic route, sampled by distance so the whole
 * wyrm follows one uninterrupted journey at a steady speed through each row.
 */
export function createWalkRoute(points: readonly WalkPoint[], width: number): WalkRoute {
  const distinct: WalkPoint[] = []
  const originalIndices: number[] = []
  for (const point of points) {
    const previous = distinct.at(-1)
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > epsilon) {
      distinct.push({ ...point })
    } else if (point.angle !== undefined) {
      previous.angle = point.angle
    }
    originalIndices.push(distinct.length - 1)
  }

  if (distinct.length < 2) {
    const origin = distinct[0] ?? { x: 0, y: 0 }
    const radians = origin.angle ?? 0
    const angle = radians * 180 / Math.PI
    return {
      length: 0,
      arrivals: points.map(() => 0),
      sample(distance) {
        const behind = Number.isFinite(distance) ? Math.min(0, distance) : 0
        return { x: origin.x + behind * Math.cos(radians), y: origin.y + behind * Math.sin(radians), angle }
      },
    }
  }

  const tangents = distinct.map((_, index) => tangent(distinct, index))
  const viewport = Number.isFinite(width) ? Math.max(0, width) : 375
  const gutter = Math.min(11, viewport / 2)
  const samples: ArcSample[] = []
  const arrivals = [0]
  let length = 0

  for (let edge = 0; edge < distinct.length - 1; edge += 1) {
    const start = distinct[edge]
    const end = distinct[edge + 1]
    const span = Math.hypot(end.x - start.x, end.y - start.y) * 0.32
    const first = {
      x: clamp(start.x + tangents[edge].x * span, gutter, viewport - gutter),
      y: start.y + tangents[edge].y * span,
    }
    const second = {
      x: clamp(end.x - tangents[edge + 1].x * span, gutter, viewport - gutter),
      y: end.y - tangents[edge + 1].y * span,
    }

    for (let step = edge ? 1 : 0; step <= samplesPerEdge; step += 1) {
      const t = step / samplesPerEdge
      const u = 1 - t
      const x = u * u * u * start.x + 3 * u * u * t * first.x + 3 * u * t * t * second.x + t * t * t * end.x
      const y = u * u * u * start.y + 3 * u * u * t * first.y + 3 * u * t * t * second.y + t * t * t * end.y
      const dx = 3 * (u * u * (first.x - start.x) + 2 * u * t * (second.x - first.x) + t * t * (end.x - second.x))
      const dy = 3 * (u * u * (first.y - start.y) + 2 * u * t * (second.y - first.y) + t * t * (end.y - second.y))
      const previous = samples.at(-1)
      if (previous) length += Math.hypot(x - previous.x, y - previous.y)
      const fallback = tangents[step === samplesPerEdge ? edge + 1 : edge]
      const radians = Math.hypot(dx, dy) > epsilon ? Math.atan2(dy, dx) : Math.atan2(fallback.y, fallback.x)
      samples.push({ x, y, angle: continuousAngle(radians, previous?.angle), distance: length })
    }
    arrivals.push(length)
  }

  return {
    length,
    arrivals: originalIndices.map((index) => arrivals[index]),
    sample(distance) {
      const target = Number.isNaN(distance) ? 0 : distance
      const first = samples[0]
      if (target <= 0) {
        const behind = Number.isFinite(target) ? target : 0
        const radians = first.angle * Math.PI / 180
        return { x: first.x + behind * Math.cos(radians), y: first.y + behind * Math.sin(radians), angle: first.angle }
      }
      if (target >= length) {
        const last = samples[samples.length - 1]
        return { x: last.x, y: last.y, angle: last.angle }
      }
      let low = 1
      let high = samples.length - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        if (samples[middle].distance < target) low = middle + 1
        else high = middle
      }
      const before = samples[low - 1]
      const after = samples[low]
      const amount = (target - before.distance) / (after.distance - before.distance || 1)
      return { x: mix(before.x, after.x, amount), y: mix(before.y, after.y, amount), angle: mix(before.angle, after.angle, amount) }
    },
  }
}

/** Body offsets trail the head; index runs from tail to head for the ripple. */
export function sampleWalkingPiece(
  route: WalkRoute,
  distance: number,
  offset: number,
  timeSeconds: number,
  amount: number,
  index = 0,
): WalkPose & { scaleX: number; scaleY: number } {
  const base = route.sample(distance - offset)
  const phase = (Number.isFinite(timeSeconds) ? timeSeconds : 0) * tau * 1.65
  const strength = Number.isFinite(amount) ? clamp(amount, 0, 1) : 0
  const lag = index * 0.47
  const forward = 0.32 * Math.sin(phase - lag) * strength
  const side = 0.85 * Math.sin(phase * 2 - lag) * strength
  const stretch = 0.018 * Math.cos(phase * 2 - lag) * strength
  const radians = base.angle * Math.PI / 180
  return {
    x: base.x + Math.cos(radians) * forward - Math.sin(radians) * side,
    y: base.y + Math.sin(radians) * forward + Math.cos(radians) * side,
    angle: base.angle,
    scaleX: 1 + stretch,
    scaleY: 1 - stretch,
  }
}

/** Cosine speed ramps surround a constant-speed middle, without waypoint stops. */
export function smoothTravelDistance(elapsed: number, duration: number, length: number, ramp = 0.5): number {
  if (duration <= 0) return elapsed >= 0 ? length : 0
  const time = clamp(Number.isNaN(elapsed) ? 0 : elapsed, 0, duration)
  if (time === 0) return 0
  if (time === duration) return length
  const edge = clamp(ramp, 0, duration / 2)
  if (edge === 0) return length * time / duration
  const easeIn = (value: number) => value / 2 - edge * Math.sin(Math.PI * value / edge) / tau
  const travelled = time < edge ? easeIn(time)
    : time > duration - edge ? duration - edge - easeIn(duration - time)
      : time - edge / 2
  return clamp(length * travelled / (duration - edge), 0, length)
}
