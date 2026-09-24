export type Point = { x: number; y: number }
export type TravelCurve = 'straight' | 'weave' | 'turn-right' | 'turn-left'

/** Follow one continuous sine wave around the line joining both centers. */
export function sampleSineTravel(
  start: Point,
  target: Point,
  progress: number,
  amplitude: number,
  cycles = 2,
): Point & { angle: number } {
  const t = Math.max(0, Math.min(1, progress))
  const dx = target.x - start.x
  const dy = target.y - start.y
  const frequency = 2 * Math.PI * cycles
  const phase = frequency * t

  return {
    x: start.x + dx * t,
    y: start.y + dy * t + amplitude * Math.sin(phase),
    angle: Math.atan2(dy + amplitude * frequency * Math.cos(phase), dx) * 180 / Math.PI,
  }
}

/** Sample a visual route and face its tangent; none of this affects game state. */
export function sampleTravel(
  start: Point,
  target: Point,
  progress: number,
  curve: TravelCurve = 'straight',
  bend = 0,
): Point & { angle: number } {
  const t = Math.max(0, Math.min(1, progress))
  const dx = target.x - start.x
  const dy = target.y - start.y
  if (curve === 'straight') {
    return {
      x: start.x + dx * t,
      y: start.y + dy * t,
      angle: Math.atan2(dy, dx) * 180 / Math.PI,
    }
  }

  // Flatten the vertical tangent at each arrival, so alternating enemy edges
  // join smoothly and a row turn enters/exits along the horizontal tile lane.
  const sine = t === 0 || t === 1 ? 0 : Math.sin(Math.PI * t)
  const cosine = Math.cos(Math.PI * t)
  const turn = curve === 'turn-right' ? bend : curve === 'turn-left' ? -bend : 0
  return {
    x: start.x + dx * t + turn * sine,
    y: start.y + dy * (1 - cosine) / 2,
    angle: Math.atan2(dy * Math.PI * sine / 2, dx + turn * Math.PI * cosine) * 180 / Math.PI,
  }
}

/** Keep rotations continuous when the tangent crosses -180/180 degrees. */
export function unwrapAngle(previous: number, next: number): number {
  const delta = ((next - previous + 180) % 360 + 360) % 360 - 180
  return previous + delta
}
