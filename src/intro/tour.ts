import type { Point } from './movement.ts'
import { createWalkRoute } from './walk.ts'
import type { WalkPoint } from './walk.ts'

export type DecodeTarget = { kind: 'enemy' | 'refills' | 'tiles'; index: number; distance: number }

/** One visible trip: leave lives, read the enemy, read reserves, read the board, return. */
export function createDecodeTour({ width, dock, enemies, refills, tiles, order }: {
  width: number
  dock: Point
  enemies: readonly Point[]
  refills: readonly Point[]
  tiles: readonly Point[]
  order: readonly number[]
}) {
  const left = 12
  const right = width - 12
  const points: WalkPoint[] = [{ ...dock, angle: 0 }]
  const targets: { kind: DecodeTarget['kind']; index: number; waypoint: number }[] = []
  const add = (x: number, y: number, angle?: number) => points.push({ x, y, angle })
  function target(kind: DecodeTarget['kind'], index: number, point: Point, angle?: number) {
    targets.push({ kind, index, waypoint: points.length })
    points.push({ ...point, angle })
  }

  if (enemies.length) {
    add(Math.min(dock.x + 39, right), dock.y + 18)
    enemies.forEach((point, index) => target('enemy', index, point, 0))
    add(right - 6, enemies.at(-1)!.y)
  }
  if (refills.length) {
    add(right, refills.at(-1)!.y, -Math.PI / 2)
    for (let index = refills.length - 1; index >= 0; index--) target('refills', index, refills[index], Math.PI)
    add(Math.max(left + 20, refills[0].x - 35), refills[0].y, Math.PI)
  }

  const boardOrder = order.filter(index => tiles[index])
  if (boardOrder.length) {
    const first = tiles[boardOrder[0]]
    add(left + 12, dock.y + 34)
    add(left, Math.max(dock.y + 40, first.y - 45), Math.PI / 2)
    for (const [step, index] of boardOrder.entries()) {
      const point = tiles[index]
      const next = tiles[boardOrder[step + 1]]
      const previous = tiles[boardOrder[step - 1]]
      const horizontal = next?.y === point.y ? next.x - point.x
        : previous?.y === point.y ? point.x - previous.x : undefined
      target('tiles', index, point, horizontal === undefined ? undefined : horizontal > 0 ? 0 : Math.PI)
      if (next && next.y !== point.y && Math.abs(next.x - point.x) < 1) {
        add(point.x < width / 2 ? left + 4 : right - 4, (point.y + next.y) / 2, Math.PI / 2)
      }
    }
    const last = tiles[boardOrder.at(-1)!]
    if (last.x > width / 2) {
      add(right, last.y + 24)
      add(right, dock.y + 34, -Math.PI / 2)
      add(left + 12, dock.y + 34, Math.PI)
    } else {
      add(left, last.y + 24)
      add(left, dock.y + 45, -Math.PI / 2)
    }
  }
  add(left, dock.y, 0)
  add(dock.x, dock.y, 0)
  const route = createWalkRoute(points, width)
  const events: DecodeTarget[] = targets.map(({ kind, index, waypoint }) => ({ kind, index, distance: route.arrivals[waypoint] }))
  return { route, events }
}
