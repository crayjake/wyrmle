type WheelTile = { id: number; letter: string }
export type WheelPosition = { x: number; y: number; ring: 'inner' | 'outer' }

/** Group physical tiles by the same match hints the player sees. Shuffle only
 * changes their order within each group; it never changes ring membership.
 * Empty board cells keep their game indices but take no space on the wheel. */
export function wheelLayout(tiles: readonly WheelTile[], order: readonly number[], matchingIds: ReadonlySet<number>,
  singleRing: boolean, shape: 'square' | 'circle') {
  const active = order.filter(index => tiles[index]?.letter)
  const inner = singleRing ? [] : active.filter(index => matchingIds.has(tiles[index].id))
  const outer = active.filter(index => singleRing || !matchingIds.has(tiles[index].id))
  const positions = Array<WheelPosition | undefined>(tiles.length).fill(undefined)
  for (const [indices, radius, ring] of [[outer, 42, 'outer'], [inner, 22, 'inner']] as const) {
    indices.forEach((index, slot) => {
      const angle = (slot / indices.length * 2 - .5) * Math.PI
      positions[index] = { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, ring }
    })
  }
  // The matching group can contain any number of repeated letters. Fit every
  // actual pair of cells, including cells on different rings, without overlap.
  let tileSize = singleRing ? shape === 'circle' ? 15.5 : 12 : 16
  const occupied = positions.filter(position => position !== undefined)
  for (let i = 0; i < occupied.length; i++) for (let j = i + 1; j < occupied.length; j++) {
    const dx = Math.abs(occupied[i].x - occupied[j].x)
    const dy = Math.abs(occupied[i].y - occupied[j].y)
    const distance = shape === 'circle' ? Math.hypot(dx, dy) : Math.max(dx, dy)
    tileSize = Math.min(tileSize, distance - 1.5)
  }
  return { positions, tileSize, hasInner: inner.length > 0, hasOuter: outer.length > 0 }
}
