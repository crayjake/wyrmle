import assert from 'node:assert/strict'
import { test } from 'node:test'
import { wheelLayout } from '../src/components/wheelLayout.ts'
import { getMatchingTileIds } from '../src/components/tileMatchHints.ts'

const tiles = [...'PEACEFULMILDSTRO'].map((letter, id) => ({ id, letter }))
const order = tiles.map((_, index) => index)
const enemies = [...'CALM'].map(letter => ({ letter, hitsRemaining: 1 }))

test('every underlined copy goes inside, including after shuffle, refills and enemy removals', () => {
  for (const currentTiles of [tiles, tiles.map(tile => tile.letter === 'P' ? { id: 99, letter: 'M' } : tile)]) {
    for (const currentEnemy of [enemies, enemies.map(enemy => ({ ...enemy, hitsRemaining: enemy.letter === 'L' ? 0 : 1 }))]) {
      const matches = new Set(getMatchingTileIds(currentTiles, currentEnemy))
      for (const ordering of [order, [...order].reverse()]) {
        const { positions } = wheelLayout(currentTiles, ordering, matches, false, 'circle')
        assert.equal(positions.length, 16)
        positions.forEach((position, index) => assert.equal(position?.ring, matches.has(currentTiles[index].id) ? 'inner' : 'outer'))
      }
    }
  }
})

test('all possible matching counts fit both shapes without tile or shuffle overlaps', () => {
  for (let count = 0; count <= 16; count++) for (const shape of ['square', 'circle'] as const) {
    const layout = wheelLayout(tiles, order, new Set(order.slice(0, count)), false, shape)
    const positions = layout.positions.filter(position => position !== undefined), { tileSize } = layout
    assert.equal(positions.length, tiles.length)
    assert.ok(tileSize > 0)
    for (const p of positions) {
      assert.ok(p.x - tileSize / 2 >= 0 && p.x + tileSize / 2 <= 100)
      assert.ok(p.y - tileSize / 2 >= 0 && p.y + tileSize / 2 <= 100)
      // The shuffle control is capped at 14% of the wheel on small screens.
      assert.ok(Math.max(Math.abs(p.x - 50), Math.abs(p.y - 50)) >= (tileSize + 14) / 2)
    }
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      const dx = Math.abs(positions[i].x - positions[j].x), dy = Math.abs(positions[i].y - positions[j].y)
      assert.ok((shape === 'circle' ? Math.hypot(dx, dy) : Math.max(dx, dy)) >= tileSize + 1.49)
    }
  }
})

test('single-ring mode keeps all tiles on its one ring, regardless of matching hints', () => {
  for (const shape of ['square', 'circle'] as const) {
    const layout = wheelLayout(tiles, order, new Set(order), true, shape)
    assert.equal(layout.hasInner, false)
    assert.equal(layout.positions.every(position => position?.ring === 'outer'), true)
  }
})

test('depleted wheels close every gap while keeping surviving matches on the inner ring', () => {
  for (const removed of [[0, 2, 5, 6], [0, 2, 5, 6, 8, 11, 15], order, order.slice(1)]) {
    const current = tiles.map((tile, index) => removed.includes(index) ? { ...tile, letter: '' } : tile)
    const before = structuredClone(current)
    const matches = new Set(getMatchingTileIds(current, enemies))
    for (const ordering of [order, [...order].reverse()]) {
      for (const single of [false, true]) for (const shape of ['square', 'circle'] as const) {
        const layout = wheelLayout(current, ordering, matches, single, shape)
        assert.equal(layout.positions.length, tiles.length, 'positions retain original board indices')
        current.forEach((tile, index) => {
          const position = layout.positions[index]
          if (!tile.letter) assert.equal(position, undefined, 'empty slots take no wheel space')
          else {
            assert.ok(position)
            assert.equal(position.ring, !single && matches.has(tile.id) ? 'inner' : 'outer')
          }
        })
        for (const ring of ['inner', 'outer'] as const) {
          const occupied = layout.positions.filter(position => position?.ring === ring)
          assert.equal(ring === 'inner' ? layout.hasInner : layout.hasOuter, occupied.length > 0)
          const angles = occupied.map(position => Math.atan2(position!.y - 50, position!.x - 50)).sort((a, b) => a - b)
          for (let i = 0; i < angles.length; i++) {
            const gap = i + 1 < angles.length ? angles[i + 1] - angles[i] : angles[0] + 2 * Math.PI - angles[i]
            assert.ok(Math.abs(gap - 2 * Math.PI / angles.length) < 1e-9, 'all remaining letters are evenly spaced')
          }
        }
      }
    }
    assert.deepEqual(current, before, 'reflow never changes letters or physical tile IDs')
  }
})
