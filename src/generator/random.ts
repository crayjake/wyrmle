/** Portable seeded randomness. All decisions use this stream, never Math.random. */
export function createRandom(seed: string | number) {
  let value = 2166136261
  for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0
  function next() {
    value = (value + 0x6d2b79f5) >>> 0
    let mixed = value
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61)
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296
  }
  const int = (maximum: number) => Math.floor(next() * maximum)
  function pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error('Cannot choose from an empty pool.')
    return items[int(items.length)]
  }
  function shuffle<T>(items: readonly T[]): T[] {
    const result = [...items]
    for (let index = result.length - 1; index > 0; index--) {
      const other = int(index + 1)
      ;[result[index], result[other]] = [result[other], result[index]]
    }
    return result
  }
  return { next, int, pick, shuffle }
}

export type Random = ReturnType<typeof createRandom>
