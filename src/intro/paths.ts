import {
  defaultRevealSeed,
  defaultTileRevealMode,
  type TileRevealMode,
} from './config.ts'

// This generator belongs only to the intro. It never advances gameplay RNG
// or changes tile order, identities, or the encounter's refill sequence.
function randomFromSeed(seed: number | string) {
  let value = 2166136261
  for (const character of String(seed)) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  }
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}

/** Return board positions to visit, without modifying the board itself. */
export function getTileRevealOrder(
  count: number,
  mode: TileRevealMode = defaultTileRevealMode,
  seed: number | string = defaultRevealSeed,
  columns = 4,
): number[] {
  const order = Array.from({ length: count }, (_, index) => index)

  if (mode === 'snake') {
    const width = Math.max(1, Math.floor(columns))
    for (let start = width; start < order.length; start += width * 2) {
      const end = Math.min(start + width, order.length)
      order.splice(start, end - start, ...order.slice(start, end).reverse())
    }
    return order
  }

  const random = randomFromSeed(seed)
  for (let index = order.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    const tileIndex = order[index]
    order[index] = order[target]
    order[target] = tileIndex
  }
  return order
}
