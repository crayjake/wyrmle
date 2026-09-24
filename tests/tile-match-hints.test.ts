import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getMatchingTileIds } from '../src/components/tileMatchHints.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'

test('match hints include every copy of a living letter, including wounded armour, without changing state', () => {
  const tiles = Object.freeze([{ id: 1, letter: 'L' }, { id: 2, letter: 'l' }, { id: 3, letter: 'Y' }, { id: 4, letter: 'X' }])
  const enemies = Object.freeze([{ letter: 'L', hitsRemaining: 0 }, { letter: 'L', hitsRemaining: 1 }, { letter: 'Y', hitsRemaining: 1 }])
  assert.deepEqual(getMatchingTileIds(tiles, enemies), [1, 2, 3])
  assert.deepEqual(getMatchingTileIds(tiles, enemies.map(enemy => ({ ...enemy, hitsRemaining: enemy.letter === 'L' ? 0 : 1 }))), [3])
  assert.deepEqual(getMatchingTileIds(tiles, enemies.map(enemy => ({ ...enemy, hitsRemaining: 0 }))), [])
  assert.deepEqual(enemies.map(enemy => enemy.hitsRemaining), [0, 1, 1])
})

test('generic match hints remain distinct from the real selected-word strikes', () => {
  const game = createLetterStrikeGame()
  const matchingBefore = getMatchingTileIds(game.tiles, game.enemyLetters)
  const gloom = ['G', 'L', 'O', 'O', 'M'].reduce<number[]>((ids, letter) => {
    const tile = game.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))!
    return [...ids, tile.id]
  }, [])
  const preview = previewLetterStrike(game, gloom)
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.strikes, 1)
  assert.ok(matchingBefore.length > preview.hits.length)
  assert.ok(matchingBefore.includes(game.tiles.find(tile => tile.letter === 'M')!.id))
  assert.ok(!preview.hits.some(hit => hit.letter === 'M'))
  const submitted = submitLetterStrike(game, gloom)
  // The other L instance survives, so any new L tile would still earn a hint.
  assert.deepEqual(getMatchingTileIds([{ id: 99, letter: 'L' }], submitted.enemyLetters), [99])
  assert.deepEqual(getMatchingTileIds(game.tiles, game.enemyLetters), matchingBefore)
})
