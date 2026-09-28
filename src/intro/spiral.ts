import type { Point } from './movement.ts'
import type { WalkPoint } from './walk.ts'

export type DecodeWheel = { center: Point; rings: readonly (readonly number[])[] }
type SpiralPoint = WalkPoint & { tileIndex?: number }

const tau = Math.PI * 2
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Sweep each ring once, outside in. Choose the entry and direction with the
 * shortest approach, inward turn and return, while keeping original tile IDs. */
export function createSpiralWaypoints(tiles: readonly Point[], wheel: DecodeWheel, entry: Point, exit: Point): SpiralPoint[] {
  const polar = tiles.map(point => ({
    angle: Math.atan2(point.y - wheel.center.y, point.x - wheel.center.x),
    radius: distance(point, wheel.center),
  }))
  const rings = wheel.rings.map(ring => [...ring].filter(index => tiles[index])
    .sort((a, b) => polar[a].angle - polar[b].angle)).filter(ring => ring.length)
  const tileCount = rings.reduce((count, ring) => count + ring.length, 0)
  let best: SpiralPoint[] = []
  let bestLength = Infinity

  for (const direction of [1, -1]) {
    function visit(ringIndex: number, path: SpiralPoint[]) {
      if (ringIndex === rings.length) {
        let length = 0
        let previous = entry
        for (const point of [...path, exit]) {
          length += distance(previous, point)
          previous = point
        }
        if (length < bestLength) { best = path; bestLength = length }
        return
      }
      const ring = rings[ringIndex]
      for (let start = 0; start < ring.length; start++) {
        const next = [...path]
        let previousIndex = path.at(-1)?.tileIndex
        let valid = true
        for (let step = 0; step < ring.length; step++) {
          const index = ring[(start + direction * step + ring.length) % ring.length]
          const to = polar[index]
          if (previousIndex !== undefined) {
            const from = polar[previousIndex]
            const turn = ((to.angle - from.angle) * direction + tau) % tau
            // A short forward curl joins the rings. Avoid a whole extra lap or
            // an abrupt radial hop; the two-singleton case can only hop inward.
            const bridge = step === 0
            if (bridge && tileCount > 2 && (turn < Math.PI / 12 || turn > Math.PI)) {
              valid = false
              break
            }
            const segments = Math.ceil(turn / (Math.PI / 4))
            for (let part = 1; part < segments; part++) {
              const t = part / segments
              const angle = from.angle + direction * turn * t
              const radius = from.radius + (to.radius - from.radius) * t * t * (3 - 2 * t)
              const radialSpeed = (to.radius - from.radius) * 6 * t * (1 - t)
              const angularSpeed = direction * turn
              next.push({
                x: wheel.center.x + Math.cos(angle) * radius,
                y: wheel.center.y + Math.sin(angle) * radius,
                angle: Math.atan2(radialSpeed * Math.sin(angle) + radius * angularSpeed * Math.cos(angle),
                  radialSpeed * Math.cos(angle) - radius * angularSpeed * Math.sin(angle)),
              })
            }
          }
          next.push({ ...tiles[index], angle: to.angle + direction * Math.PI / 2, tileIndex: index })
          previousIndex = index
        }
        if (valid) visit(ringIndex + 1, next)
      }
    }
    visit(0, [])
  }
  return best
}
