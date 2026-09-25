import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canSpellDictionaryWord } from '../src/game/dictionary.ts'
import {
  createLetterStrikeGame, letterStrikeEncounter, previewLetterStrike,
  submitLetterStrike, toggleLetterStrikeTile,
} from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../src/game/letterStrike.ts'
import { refillBoard } from '../src/game/tiles.ts'

function encounter(board = 'CATDOG', refillQueue = ''): LetterStrikeEncounter {
  return {
    ...letterStrikeEncounter, id: 'finite-refill-test', finiteRefills: true, refillQueue,
    enemy: { ...letterStrikeEncounter.enemy, word: 'Z', semanticRelations: { opposite: [], similar: [], related: [] } },
    enemyLetters: [{ id: 'enemy-z', letter: 'Z', initialHits: 1, hitsRemaining: 1 }],
    startingTiles: [...board.padEnd(16, 'Q')].map((letter, id) => ({ id, letter, type: 'normal' })),
    grammarModifiers: {},
  }
}

function wordIds(state: LetterStrikeState, word: string): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = state.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing ${letter} for ${word}`)
    ids.push(tile.id)
  }
  return ids
}

test('partial final refill follows board order and creates inert cells without inventing letters', () => {
  const initial = createLetterStrikeGame(encounter('TCADOG', 're'))
  const next = submitLetterStrike(initial, wordIds(initial, 'CAT'))
  assert.equal(next.status, 'playing')
  assert.equal(next.tiles.length, 16)
  assert.equal(next.refillIndex, 2)
  assert.equal(next.nextTileId, 19)
  assert.deepEqual(next.tiles.slice(0, 3), [
    { id: 16, letter: 'R', type: 'normal' },
    { id: 17, letter: 'E', type: 'normal' },
    { id: 18, letter: '', type: 'normal' },
  ])
  for (let index = 3; index < 16; index++) assert.equal(next.tiles[index], initial.tiles[index])
  assert.equal(new Set(next.tiles.map(tile => tile.id)).size, 16)
  assert.equal(initial.refillIndex, 0)
})

test('an exhausted supply permits remaining words then ends when none can be spelled', () => {
  const initial = createLetterStrikeGame(encounter())
  const first = submitLetterStrike(initial, wordIds(initial, 'CAT'))
  assert.equal(first.status, 'playing')
  assert.equal(first.refillIndex, 0)
  const exhausted = submitLetterStrike(first, wordIds(first, 'DOG'))
  assert.equal(exhausted.status, 'lost')
  assert.equal(exhausted.playerResolve, 3)
  assert.equal(exhausted.refillIndex, 0)
  assert.equal(exhausted.nextTileId, 22)
  assert.equal(exhausted.tiles.filter(tile => tile.letter === '').length, 6)
  assert.equal(exhausted.error, null)
})

test('empty cells cannot be selected or smuggled into an otherwise valid submission', () => {
  const initial = createLetterStrikeGame(encounter())
  const state = submitLetterStrike(initial, wordIds(initial, 'CAT'))
  const emptyId = state.tiles.find(tile => tile.letter === '')!.id
  assert.equal(toggleLetterStrikeTile(state, emptyId), state)
  const validIds = wordIds(state, 'DOG')
  assert.equal(previewLetterStrike(state, validIds).valid, true)
  const ids = [...validIds, emptyId]
  const preview = previewLetterStrike(state, ids)
  assert.equal(preview.valid, false)
  assert.match(preview.error!, /Empty cells/)
  assert.equal(preview.resolveCost, 0)
  assert.equal(preview.strikes, 0)
  const submitted = submitLetterStrike(state, ids)
  assert.deepEqual({ ...submitted, error: null }, state)
})

test('the final hit wins on the last Resolve even when the board has no remaining word', () => {
  const setup = encounter('CAT')
  setup.startingResolve = 1
  setup.enemyLetters = [{ id: 'enemy-c', letter: 'C', initialHits: 1, hitsRemaining: 1 }]
  const initial = createLetterStrikeGame(setup)
  const won = submitLetterStrike(initial, wordIds(initial, 'CAT'))
  assert.equal(won.playerResolve, 0)
  assert.equal(won.status, 'won')
  assert.equal(won.enemyLetters[0].hitsRemaining, 0)
  assert.equal(canSpellDictionaryWord(won.tiles.map(tile => tile.letter), 3), false)
})

test('Revive still restores an enemy after the supply runs out and a later word can win', () => {
  const setup = encounter('CATCOW')
  setup.startingResolve = 2
  setup.enemyLetters = [{ id: 'enemy-c', letter: 'C', initialHits: 1, hitsRemaining: 1 }]
  setup.tileEffects = { ...setup.tileEffects, regen: { strike: false, preventResolveLoss: false, regenerate: true } }
  setup.startingTiles = setup.startingTiles.map(tile => tile.id === 0 ? { ...tile, type: 'gem', gem: 'regen' } : tile)
  const initial = createLetterStrikeGame(setup)
  const revived = submitLetterStrike(initial, wordIds(initial, 'CAT'))
  assert.equal(revived.status, 'playing')
  assert.equal(revived.enemyLetters[0].hitsRemaining, 1)
  assert.deepEqual(revived.playedWords[0].effectLabels, ['REGEN'])
  assert.equal(revived.playedWords[0].preview.recoveries?.length, 1)
  assert.deepEqual(revived.tiles[0], { id: 16, letter: '', type: 'normal' })
  const won = submitLetterStrike(revived, wordIds(revived, 'COW'))
  assert.equal(won.status, 'won')
  assert.equal(won.playerResolve, 0)
  assert.equal(won.refillIndex, 0)
})

test('Ward cannot postpone exhaustion after Revive leaves a living enemy and no spellable word', () => {
  const setup = encounter('CAT')
  setup.enemyLetters = [{ id: 'enemy-c', letter: 'C', initialHits: 1, hitsRemaining: 1 }]
  setup.tileEffects = { ...setup.tileEffects, regen: { strike: false, preventResolveLoss: false, regenerate: true } }
  setup.startingTiles = setup.startingTiles.map(tile => tile.id === 0 ? { ...tile, type: 'gem', gem: 'regen' }
    : tile.id === 1 ? { ...tile, type: 'gem', gem: 'ward' } : tile)
  const initial = createLetterStrikeGame(setup)
  const lost = submitLetterStrike(initial, wordIds(initial, 'CAT'))
  assert.equal(lost.status, 'lost')
  assert.equal(lost.playerResolve, initial.playerResolve)
  assert.equal(lost.enemyLetters[0].hitsRemaining, 1)
  assert.equal(lost.tiles.some(tile => tile.gem), false)
})

test('finite creation permits empty supply and recognizes an unplayable opening', () => {
  assert.equal(createLetterStrikeGame(encounter()).status, 'playing')
  assert.equal(createLetterStrikeGame(encounter('Q'.repeat(16), 'CAT')).status, 'lost')
  assert.throws(() => createLetterStrikeGame(encounter('CATDOG', 'A?')), /refill letters/)
})

test('omitting finite rules retains old queue validation and ordinary refill behavior', () => {
  const { finiteRefills: _finiteRefills, ...legacy } = encounter()
  assert.throws(() => createLetterStrikeGame(legacy), /enough deterministic refill letters/)
  const state = createLetterStrikeGame({ ...legacy, refillQueue: 'DOG'.repeat(32) })
  const next = submitLetterStrike(state, wordIds(state, 'CAT'))
  assert.deepEqual(next.tiles.slice(0, 3), [
    { id: 16, letter: 'D', type: 'normal' },
    { id: 17, letter: 'O', type: 'normal' },
    { id: 18, letter: 'G', type: 'normal' },
  ])
  assert.equal(next.refillIndex, 3)
  assert.equal(next.nextTileId, 19)
  assert.equal(createLetterStrikeGame({ ...legacy, startingTiles: encounter('Q'.repeat(16)).startingTiles,
    refillQueue: 'DOG'.repeat(32) }).status, 'playing')
  assert.throws(() => refillBoard({ ...state, encounter: legacy }, wordIds(state, 'CAT')), /refill queue exhausted/)
})

test('runtime word existence respects physical multiplicity, empties, case and minimum length', () => {
  assert.equal(canSpellDictionaryWord(['l', 'e', 'v', 'e', 'l', ''], 5), true)
  assert.equal(canSpellDictionaryWord(['l', 'e', 'v', '', ''], 5), false)
  assert.equal(canSpellDictionaryWord(['L', 'E', 'V', 'E', 'L'], 6), false)
  assert.equal(canSpellDictionaryWord([...('Q'.repeat(16))], 3), false)
  assert.equal(canSpellDictionaryWord(['E', 'E', 'L'], 3), true)
  assert.equal(canSpellDictionaryWord(['E', 'L', ''], 3), false)
})
