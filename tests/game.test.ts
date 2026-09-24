import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDictionaryWord } from '../src/game/dictionary.ts'
import { melancholyEncounter } from '../src/game/encounters.ts'
import {
  clearSelection, createGame, getSelectedWord, previewAttack, submitWord, toggleTile,
} from '../src/game/game.ts'
import type { GameState } from '../src/game/types.ts'

// Adapted from bookworm-game's tests: choose a distinct actual tile for each letter.
function selectWord(state: GameState, word: string): GameState {
  let selected = clearSelection(state)
  for (const letter of word.toUpperCase()) {
    const tile = selected.tiles.find((tile) =>
      tile.letter === letter && !selected.selectedTileIds.includes(tile.id),
    )
    assert.ok(tile, `Board is missing ${letter} for ${word}`)
    selected = toggleTile(selected, tile.id)
  }
  return selected
}

test('the prototype starts with one Resolve resource and distinct fixed tiles', () => {
  const state = createGame(melancholyEncounter)
  assert.equal(state.encounter.enemy.word, 'MELANCHOLY')
  assert.equal(state.enemyHp, melancholyEncounter.enemy.maxHealth)
  assert.equal(state.playerResolve, 5)
  assert.equal('health' in state, false)
  assert.equal('turnsRemaining' in state, false)
  assert.equal(state.status, 'playing')
  assert.equal(state.tiles.map((tile) => tile.letter).join(''), 'JOYCHEERSADGLOOM')
  assert.deepEqual(state.tiles, melancholyEncounter.startingTiles)
  assert.notEqual(state.tiles, melancholyEncounter.startingTiles)
  assert.notEqual(state.tiles[0], melancholyEncounter.startingTiles[0])
  assert.equal(new Set(state.tiles.map((tile) => tile.id)).size, 16)
  assert.equal(state.tiles[2].gem, 'ward')
  assert.equal(state.tiles[5].gem, 'power')
  assert.equal(state.refillIndex, 0)
  assert.equal(state.nextTileId, 16)
  assert.deepEqual(state.selectedTileIds, [])
})

test('the local dictionary accepts ordinary discovered words and rejects nonsense', () => {
  for (const word of ['joy', 'CHEER', 'SAD', 'gloom', 'hear', 'dashes', 'coaster']) {
    assert.equal(isDictionaryWord(word), true, word)
  }
  for (const word of ['qzxqzx', 'jyg', 'abc123', 'two words', '']) {
    assert.equal(isDictionaryWord(word), false, word)
  }
})

test('selection follows click order without requiring adjacency', () => {
  const initial = createGame(melancholyEncounter)
  let selected = initial
  for (const id of [10, 9, 8, 4]) selected = toggleTile(selected, id)
  assert.equal(getSelectedWord(selected), 'DASH')
  assert.equal(previewAttack(selected).valid, true)
  assert.deepEqual(selected.selectedTileIds, [10, 9, 8, 4])
  assert.deepEqual(initial.selectedTileIds, [])
  selected = toggleTile(selected, 9)
  assert.equal(getSelectedWord(selected), 'DSH')
  selected = toggleTile(selected, 9)
  assert.equal(getSelectedWord(selected), 'DSHA')
  assert.equal(toggleTile(selected, 999), selected)
})

test('submission uses explicitly supplied tile IDs without changing the stored selection', () => {
  const state = toggleTile(createGame(melancholyEncounter), 8)
  const next = submitWord(state, [0, 1, 2])
  assert.equal(next.error, null)
  assert.equal(state.enemyHp - next.enemyHp, 8)
  assert.deepEqual(next.selectedTileIds, [])
  assert.deepEqual(state.selectedTileIds, [8])
})

test('the same tile cannot supply two letters, even when the resulting word is valid', () => {
  const state = createGame(melancholyEncounter)
  const ids = [3, 4, 5, 5, 7] // CHEER using the same Power E twice.
  assert.equal(previewAttack(state, ids).valid, false)
  const rejected = submitWord(state, ids)
  assert.ok(rejected.error)
  assert.deepEqual({ ...rejected, error: null }, state)
  assert.deepEqual(toggleTile(toggleTile(state, 5), 5).selectedTileIds, [])
})

test('unknown tile IDs cannot be submitted', () => {
  const state = createGame(melancholyEncounter)
  const ids = [0, 1, 999]
  assert.equal(previewAttack(state, ids).valid, false)
  const rejected = submitWord(state, ids)
  assert.ok(rejected.error)
  assert.deepEqual({ ...rejected, error: null }, state)
})

test('invalid dictionary words cannot spend Resolve, consume specials, or advance refills', () => {
  const state = createGame(melancholyEncounter)
  const before = structuredClone(state)
  const ids = [0, 2, 5] // JYE includes both Ward and Power.
  assert.equal(previewAttack(state, ids).valid, false)
  const rejected = submitWord(state, ids)
  assert.ok(rejected.error)
  assert.deepEqual({ ...rejected, error: null }, state)
  assert.deepEqual(state, before)
})

test('empty and short selections cannot submit or spend Resolve', () => {
  const state = createGame(melancholyEncounter)
  for (const ids of [[], [9], [9, 8]]) {
    assert.equal(previewAttack(state, ids).valid, false)
    const rejected = submitWord(state, ids)
    assert.ok(rejected.error)
    assert.deepEqual({ ...rejected, error: null }, state)
  }
})

test('Clear removes only the selection and validation error', () => {
  const state = submitWord(selectWord(createGame(melancholyEncounter), 'JYE'))
  assert.ok(state.error)
  assert.equal(state.selectedTileIds.length, 3)
  assert.deepEqual(clearSelection(state), { ...state, selectedTileIds: [], error: null })
})

test('successful attacks consume only the chosen tiles, without mutating input', () => {
  const state = selectWord(createGame(melancholyEncounter), 'DASH')
  const original = structuredClone(state)
  Object.freeze(state)
  Object.freeze(state.tiles)
  Object.freeze(state.selectedTileIds)
  Object.freeze(state.playedWords)
  state.tiles.forEach(Object.freeze)

  const next = submitWord(state)
  assert.equal(next.error, null)
  assert.equal(next.tiles.length, 16)
  assert.equal(next.playerResolve, state.playerResolve - 1)
  assert.equal(next.refillIndex, 4)
  assert.equal(next.nextTileId, 20)
  assert.equal(new Set(next.tiles.map((tile) => tile.id)).size, 16)
  assert.deepEqual(next.selectedTileIds, [])
  for (const id of state.selectedTileIds) {
    assert.equal(next.tiles.some((tile) => tile.id === id), false)
  }
  state.tiles.forEach((tile, index) => {
    if (!state.selectedTileIds.includes(tile.id)) assert.equal(next.tiles[index], tile)
  })
  assert.deepEqual(state, original)
})

test('refill letters and new IDs fill consumed positions in board order, not click order', () => {
  const state = selectWord(createGame(melancholyEncounter), 'DASH')
  assert.deepEqual(state.selectedTileIds, [10, 9, 8, 4])
  const next = submitWord(state)
  assert.deepEqual([next.tiles[4], next.tiles[8], next.tiles[9], next.tiles[10]], [
    { id: 16, letter: 'H', type: 'normal' },
    { id: 17, letter: 'A', type: 'normal' },
    { id: 18, letter: 'P', type: 'normal' },
    { id: 19, letter: 'P', type: 'normal' },
  ])
})

test('JOY is a strong counter and its actual Ward tile prevents Resolve loss', () => {
  const state = createGame(melancholyEncounter)
  const preview = previewAttack(state, [0, 1, 2])
  assert.equal(preview.word, 'JOY')
  assert.equal(preview.valid, true)
  assert.equal(preview.baseDamage, 3)
  assert.equal(preview.semanticRelation, 'opposite')
  assert.equal(preview.semanticModifier, 5)
  assert.equal(preview.totalDamage, 8)
  assert.equal(preview.resolveCost, 0)
  const next = submitWord(state, [0, 1, 2])
  assert.equal(next.playerResolve, 5)
  assert.equal(state.enemyHp - next.enemyHp, 8)
  assert.equal(next.tiles.some((tile) => tile.id === 2), false)
})

test('CHEER applies its counter and Power bonuses and spends exactly one Resolve', () => {
  const state = createGame(melancholyEncounter)
  const preview = previewAttack(state, [3, 4, 5, 6, 7])
  assert.equal(preview.valid, true)
  assert.equal(preview.word, 'CHEER')
  assert.equal(preview.baseDamage, 5)
  assert.equal(preview.semanticRelation, 'opposite')
  assert.equal(preview.semanticModifier, 5)
  assert.equal(preview.totalDamage, 13)
  assert.equal(preview.resolveCost, 1)
  const next = submitWord(state, [3, 4, 5, 6, 7])
  assert.equal(state.enemyHp - next.enemyHp, 13)
  assert.equal(next.playerResolve, 4)
})

test('GLOOM is longer than JOY but similarity makes it a weaker attack', () => {
  const state = createGame(melancholyEncounter)
  const gloom = previewAttack(selectWord(state, 'GLOOM'))
  const joy = previewAttack(selectWord(state, 'JOY'))
  assert.equal(gloom.valid, true)
  assert.equal(gloom.baseDamage, 5)
  assert.equal(gloom.semanticRelation, 'similar')
  assert.equal(gloom.semanticModifier, -3)
  assert.equal(gloom.totalDamage, 2)
  assert.ok(gloom.word.length > joy.word.length)
  assert.ok(gloom.totalDamage < joy.totalDamage)
})

test('unrelated dictionary words receive no semantic adjustment', () => {
  const preview = previewAttack(selectWord(createGame(melancholyEncounter), 'DASH'))
  assert.equal(preview.valid, true)
  assert.equal(preview.semanticRelation, 'unrelated')
  assert.equal(preview.semanticModifier, 0)
  assert.equal(preview.totalDamage, preview.baseDamage)
})

test('duplicate letters with different effects remain distinct gameplay choices', () => {
  const state = createGame(melancholyEncounter)
  const normalIds = [4, 6, 9, 7]
  const powerIds = [4, 5, 9, 7]
  const normal = previewAttack(state, normalIds)
  const power = previewAttack(state, powerIds)
  assert.equal(normal.word, 'HEAR')
  assert.equal(power.word, normal.word)
  assert.equal(normal.valid, true)
  assert.equal(power.valid, true)
  assert.equal(power.totalDamage, normal.totalDamage + 3)
  assert.notDeepEqual(power.tileEffects, normal.tileEffects)
  const usedNormal = submitWord(state, normalIds)
  const usedPower = submitWord(state, powerIds)
  assert.equal(usedNormal.tiles.some((tile) => tile.id === 5), true)
  assert.equal(usedNormal.tiles.some((tile) => tile.id === 6), false)
  assert.equal(usedPower.tiles.some((tile) => tile.id === 5), false)
  assert.equal(usedPower.tiles.some((tile) => tile.id === 6), true)
  assert.equal(usedNormal.enemyHp - usedPower.enemyHp, 3)
})

test('Resolve reaching zero loses when the enemy survives', () => {
  const state = createGame({ ...melancholyEncounter, startingResolve: 1 })
  const next = submitWord(selectWord(state, 'GLOOM'))
  assert.equal(next.error, null)
  assert.equal(next.playerResolve, 0)
  assert.ok(next.enemyHp > 0)
  assert.equal(next.status, 'lost')
})

test('defeating the enemy on the final Resolve wins before loss is checked', () => {
  const state = createGame({
    ...melancholyEncounter,
    startingResolve: 1,
    enemy: { ...melancholyEncounter.enemy, maxHealth: 2 },
  })
  const next = submitWord(selectWord(state, 'GLOOM'))
  assert.equal(next.error, null)
  assert.equal(next.enemyHp, 0)
  assert.equal(next.playerResolve, 0)
  assert.equal(next.status, 'won')
})

test('Ward still protects the final Resolve while the enemy survives', () => {
  const state = createGame({ ...melancholyEncounter, startingResolve: 1 })
  const next = submitWord(state, [0, 1, 2])
  assert.equal(next.playerResolve, 1)
  assert.equal(next.status, 'playing')
})

test('finished games reject selection and submission without spending resources', () => {
  for (const maxHealth of [2, 33]) {
    const state = createGame({
      ...melancholyEncounter,
      startingResolve: 1,
      enemy: { ...melancholyEncounter.enemy, maxHealth },
    })
    const terminal = submitWord(selectWord(state, 'GLOOM'))
    assert.notEqual(terminal.status, 'playing')
    assert.equal(toggleTile(terminal, terminal.tiles[0].id), terminal)
    assert.equal(submitWord(terminal, [0, 1, 2]), terminal)
    assert.equal(previewAttack(terminal, [0, 1, 2]).valid, false)
  }
})

test('preview is pure and equals actual submitted damage and Resolve cost', () => {
  for (const word of ['JOY', 'CHEER', 'SAD', 'GLOOM', 'DASH']) {
    const state = selectWord(createGame(melancholyEncounter), word)
    const before = structuredClone(state)
    Object.freeze(state)
    Object.freeze(state.tiles)
    Object.freeze(state.selectedTileIds)
    state.tiles.forEach(Object.freeze)
    const preview = previewAttack(state)
    assert.equal(preview.valid, true, word)
    assert.deepEqual(state, before)
    const next = submitWord(state)
    assert.equal(state.enemyHp - next.enemyHp, preview.totalDamage, word)
    assert.equal(state.playerResolve - next.playerResolve, preview.resolveCost, word)
  }
})

test('deterministic refills provide a complete playable JOY, CHEER, HAPPY victory', () => {
  let first = createGame(melancholyEncounter)
  let replay = createGame(melancholyEncounter)
  for (const word of ['JOY', 'CHEER', 'HAPPY']) {
    const selected = selectWord(first, word)
    const preview = previewAttack(selected)
    assert.equal(preview.valid, true, word)
    first = submitWord(selected)
    replay = submitWord(replay, selected.selectedTileIds)
    assert.equal(first.error, null, word)
    assert.deepEqual(first, replay)
    assert.equal(first.tiles.length, 16)
    assert.equal(new Set(first.tiles.map((tile) => tile.id)).size, 16)
  }
  assert.equal(first.status, 'won')
  assert.equal(first.enemyHp, 0)
  assert.equal(first.playerResolve, 3)
  assert.equal(first.refillIndex, 13)
  assert.equal(first.nextTileId, 29)
  assert.equal(first.playedWords.length, 3)
  assert.deepEqual(createGame(melancholyEncounter), createGame(melancholyEncounter))
})
