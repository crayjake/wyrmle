export type TileGesturePoint = { x: number; y: number }

export type TileGestureBounds = {
  id: number
  left: number
  right: number
  top: number
  bottom: number
}

export type TileSelectionGesture = {
  pointerId: number
  start: TileGesturePoint
  previous: TileGesturePoint
  startTileId: number
  startWasSelected: boolean
  dragged: boolean
  selected: ReadonlySet<number>
  visited: ReadonlySet<number>
}

const TAP_SLOP = 8

// Return where a segment first enters a tile. Testing the whole segment means
// fast swipes still collect tiles between the browser's pointer samples.
function entryDistance(start: TileGesturePoint, end: TileGesturePoint, bounds: TileGestureBounds): number | null {
  let entry = 0
  let exit = 1
  for (const [origin, delta, minimum, maximum] of [
    [start.x, end.x - start.x, bounds.left, bounds.right],
    [start.y, end.y - start.y, bounds.top, bounds.bottom],
  ]) {
    if (delta === 0) {
      if (origin < minimum || origin > maximum) return null
      continue
    }
    const a = (minimum - origin) / delta
    const b = (maximum - origin) / delta
    entry = Math.max(entry, Math.min(a, b))
    exit = Math.min(exit, Math.max(a, b))
    if (entry > exit) return null
  }
  return entry
}

export function beginTileSelectionGesture(
  pointerId: number,
  point: TileGesturePoint,
  tileId: number,
  selectedIds: readonly number[],
): { gesture: TileSelectionGesture; addedIds: number[] } {
  const selected = new Set(selectedIds)
  const startWasSelected = selected.has(tileId)
  selected.add(tileId)
  return {
    gesture: {
      pointerId, start: point, previous: point, startTileId: tileId,
      startWasSelected, dragged: false, selected, visited: new Set([tileId]),
    },
    addedIds: startWasSelected ? [] : [tileId],
  }
}

export function crossedTileIds(start: TileGesturePoint, end: TileGesturePoint, bounds: readonly TileGestureBounds[]): number[] {
  return bounds.flatMap(tile => {
    const entry = entryDistance(start, end, tile)
    return entry === null ? [] : [{ id: tile.id, entry }]
  }).sort((a, b) => a.entry - b.entry).map(tile => tile.id)
}

export function moveTileSelectionGesture(
  gesture: TileSelectionGesture,
  point: TileGesturePoint,
  bounds: readonly TileGestureBounds[],
): { gesture: TileSelectionGesture; addedIds: number[] } {
  const crossed = crossedTileIds(gesture.previous, point, bounds)
  const selected = new Set(gesture.selected)
  const visited = new Set(gesture.visited)
  const addedIds: number[] = []
  for (const id of crossed) {
    if (!visited.has(id) && !selected.has(id)) {
      selected.add(id)
      addedIds.push(id)
    }
    visited.add(id)
  }
  return {
    gesture: {
      ...gesture, previous: point, selected, visited,
      dragged: gesture.dragged || visited.size > 1 || Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) > TAP_SLOP,
    },
    addedIds,
  }
}

// A tap keeps the established toggle behaviour. Once the finger travels,
// selection only adds tiles, even when it crosses a letter already in the word.
export function finishTileSelectionGesture(gesture: TileSelectionGesture): number | null {
  return gesture.startWasSelected && !gesture.dragged ? gesture.startTileId : null
}
