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
        positions.forEach((position, index) => assert.equal(position.ring, matches.has(currentTiles[index].id) ? 'inner' : 'outer'))
      }
    }
  }
})

test('all possible matching counts fit both shapes without tile or shuffle overlaps', () => {
  for (let count = 0; count <= 16; count++) for (const shape of ['square', 'circle'] as const) {
    const { positions, tileSize } = wheelLayout(tiles, order, new Set(order.slice(0, count)), false, shape)
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
    assert.equal(layout.positions.every(position => position.ring === 'outer'), true)
  }
})
