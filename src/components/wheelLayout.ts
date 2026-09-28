type WheelTile = { id: number }
export type WheelPosition = { x: number; y: number; ring: 'inner' | 'outer' }

/** Group physical tiles by the same match hints the player sees. Shuffle only
 * changes their order within each group; it never changes ring membership. */
export function wheelLayout(tiles: readonly WheelTile[], order: readonly number[], matchingIds: ReadonlySet<number>,
  singleRing: boolean, shape: 'square' | 'circle') {
  const inner = singleRing ? [] : order.filter(index => matchingIds.has(tiles[index].id))
  const outer = order.filter(index => singleRing || !matchingIds.has(tiles[index].id))
  const positions: WheelPosition[] = Array(tiles.length)
  for (const [indices, radius, ring] of [[outer, 42, 'outer'], [inner, 22, 'inner']] as const) {
    indices.forEach((index, slot) => {
      const angle = (slot / indices.length * 2 - .5) * Math.PI
      positions[index] = { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, ring }
    })
  }
  // The matching group can contain any number of repeated letters. Fit every
  // actual pair of cells, including cells on different rings, without overlap.
  let tileSize = singleRing ? shape === 'circle' ? 15.5 : 12 : 16
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    const dx = Math.abs(positions[i].x - positions[j].x)
    const dy = Math.abs(positions[i].y - positions[j].y)
    const distance = shape === 'circle' ? Math.hypot(dx, dy) : Math.max(dx, dy)
    tileSize = Math.min(tileSize, distance - 1.5)
  }
  return { positions, tileSize, hasInner: inner.length > 0, hasOuter: outer.length > 0 }
}
