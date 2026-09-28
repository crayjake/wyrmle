import assert from 'node:assert/strict'
import { test } from 'node:test'
import { beginTileSelectionGesture, crossedTileIds, finishTileSelectionGesture, moveTileSelectionGesture } from '../src/components/tileSelectionGesture.ts'
import type { TileGestureBounds } from '../src/components/tileSelectionGesture.ts'

const row: TileGestureBounds[] = Array.from({ length: 4 }, (_, index) => ({
  id: index + 10, left: index * 50, right: index * 50 + 44, top: 0, bottom: 44,
}))

test('a quick swipe includes crossed tiles in travel order, even without intermediate events', () => {
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [])
  const moved = moveTileSelectionGesture(started.gesture, { x: 172, y: 22 }, row)
  assert.deepEqual([...started.addedIds, ...moved.addedIds], [10, 11, 12, 13])
  assert.equal(finishTileSelectionGesture(moved.gesture), null)
  const reverse = beginTileSelectionGesture(2, { x: 172, y: 22 }, 13, [])
  assert.deepEqual(moveTileSelectionGesture(reverse.gesture, { x: 22, y: 22 }, row).addedIds, [12, 11, 10])
})

test('separate taps can append to a swipe without changing the existing word order', () => {
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [])
  const moved = moveTileSelectionGesture(started.gesture, { x: 172, y: 22 }, row)
  const next = beginTileSelectionGesture(2, { x: 22, y: 72 }, 20, [...moved.gesture.selected])
  assert.deepEqual([...next.gesture.selected], [10, 11, 12, 13, 20])
  assert.deepEqual(next.addedIds, [20])
  assert.equal(finishTileSelectionGesture(next.gesture), null)
})

test('swiping back over selected tiles never deselects or duplicates them', () => {
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [10, 12])
  const moved = moveTileSelectionGesture(started.gesture, { x: 172, y: 22 }, row)
  const reversed = moveTileSelectionGesture(moved.gesture, { x: 22, y: 22 }, row)
  assert.deepEqual(started.addedIds, [])
  assert.deepEqual(moved.addedIds, [11, 13])
  assert.deepEqual(reversed.addedIds, [])
  assert.deepEqual([...reversed.gesture.selected], [10, 12, 11, 13])
  assert.equal(finishTileSelectionGesture(reversed.gesture), null)
})

test('a tap toggles an existing tile while small finger jitter remains a tap', () => {
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [10, 11])
  const moved = moveTileSelectionGesture(started.gesture, { x: 24, y: 25 }, row)
  assert.equal(finishTileSelectionGesture(moved.gesture), 10)
  assert.deepEqual(moved.addedIds, [])
})

test('moving away and returning to the first tile is not a deselecting tap', () => {
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [10])
  const away = moveTileSelectionGesture(started.gesture, { x: 22, y: 80 }, row)
  const returned = moveTileSelectionGesture(away.gesture, { x: 22, y: 22 }, row)
  assert.equal(finishTileSelectionGesture(returned.gesture), null)
})

test('diagonal movement only selects tiles physically crossed, with no adjacency constraint', () => {
  const board = [...row, ...row.map(tile => ({ ...tile, id: tile.id + 10, top: 50, bottom: 94 }))]
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [])
  const moved = moveTileSelectionGesture(started.gesture, { x: 72, y: 72 }, board)
  assert.deepEqual(moved.addedIds, [21])
  const far = moveTileSelectionGesture(moved.gesture, { x: 172, y: 172 }, board)
  assert.deepEqual(far.addedIds, [])
})

test('unavailable or empty slots can be omitted without interrupting the swipe', () => {
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [])
  const moved = moveTileSelectionGesture(started.gesture, { x: 172, y: 22 }, row.filter(tile => tile.id !== 11))
  assert.deepEqual(moved.addedIds, [12, 13])
})

test('same letters on different physical tiles remain independently selectable', () => {
  // The gesture uses physical IDs, so it never merges equal glyphs.
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [99])
  const moved = moveTileSelectionGesture(started.gesture, { x: 72, y: 22 }, row)
  assert.deepEqual([...moved.gesture.selected], [99, 10, 11])
})

test('round tiles ignore empty square corners, including stationary touches', () => {
  const tile = { ...row[0], radius: 22 }
  assert.deepEqual(crossedTileIds({ x: 0, y: 0 }, { x: 4, y: 0 }, [tile]), [])
  assert.deepEqual(crossedTileIds({ x: 1, y: 1 }, { x: 1, y: 1 }, [tile]), [])
  assert.deepEqual(crossedTileIds({ x: 22, y: 22 }, { x: 22, y: 22 }, [tile]), [10])
  assert.deepEqual(crossedTileIds({ x: -10, y: -1 }, { x: 54, y: -1 }, [tile]), [])
  assert.deepEqual(crossedTileIds({ x: -10, y: 0 }, { x: 54, y: 0 }, [tile]), [10])
})

test('a fast swipe collects circular targets in travel order and does not repeat them', () => {
  const circles = row.map(tile => ({ ...tile, radius: 22 }))
  const started = beginTileSelectionGesture(1, { x: 22, y: 22 }, 10, [])
  const moved = moveTileSelectionGesture(started.gesture, { x: 172, y: 22 }, circles)
  assert.deepEqual(moved.addedIds, [11, 12, 13])
  const back = moveTileSelectionGesture(moved.gesture, { x: 22, y: 22 }, circles)
  assert.deepEqual(back.addedIds, [])
  assert.deepEqual(crossedTileIds({ x: 195, y: 22 }, { x: -1, y: 22 }, circles), [13, 12, 11, 10])
})
