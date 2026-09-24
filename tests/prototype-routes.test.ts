import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'

type Route = { opening: string; moves: readonly (readonly [string, readonly number[]])[] }

// Hand-checked examples from the authored board, not a runtime puzzle solver.
// Different openings exercise counter, resisted, long-neutral and special use.
const routes: readonly Route[] = [
  { opening: 'JOY', moves: [
    ['JOY', [0, 1, 2]], ['COMELY', [4, 10, 11, 15, 9, 17]],
    ['GLAD', [8, 21, 22, 14]], ['MEANED', [24, 18, 13, 26, 20, 27]],
    ['HONEYS', [5, 30, 28, 6, 31, 32]],
  ] },
  { opening: 'CHEER', moves: [
    ['CHEER', [4, 5, 15, 6, 7]], ['STORMY', [12, 3, 1, 16, 11, 2]],
    ['LONELY', [9, 10, 26, 18, 21, 17]], ['MONADS', [24, 30, 28, 22, 27, 32]],
  ] },
  { opening: 'GLAD', moves: [
    ['GLAD', [8, 9, 13, 14]], ['STORMY', [12, 3, 1, 7, 11, 2]],
    ['HEARTY', [5, 15, 22, 16, 23, 17]], ['COMELY', [4, 30, 24, 20, 21, 31]],
    ['SANDY', [32, 33, 26, 34, 37]],
  ] },
  { opening: 'GAY', moves: [
    ['GAY', [8, 13, 2]], ['COMELY', [4, 1, 11, 15, 9, 17]],
    ['MOLESTED', [24, 10, 21, 20, 12, 3, 6, 14]], ['HEARTY', [5, 25, 22, 19, 23, 31]],
    ['SANDY', [32, 33, 26, 34, 37]],
  ] },
  { opening: 'SAD', moves: [
    ['SAD', [12, 13, 14]], ['COMELY', [4, 1, 11, 15, 9, 2]],
    ['MERRY', [24, 20, 19, 7, 17]], ['LOANED', [21, 10, 22, 26, 25, 27]],
    ['HONEYS', [5, 30, 28, 6, 31, 32]],
  ] },
  { opening: 'GLOOM', moves: [
    ['GLOOM', [8, 9, 1, 10, 11]], ['CHEER', [4, 5, 15, 6, 16]],
    ['DREAMY', [14, 7, 18, 22, 24, 2]], ['JOY', [0, 30, 17]],
    ['LEADEN', [21, 20, 33, 27, 25, 26]], ['MERRY', [38, 39, 19, 40, 37]],
  ] },
  { opening: 'CLOSET', moves: [
    ['CLOSET', [4, 9, 1, 12, 15, 3]], ['MERRY', [11, 18, 16, 7, 2]],
    ['HOMELY', [5, 10, 24, 6, 21, 17]], ['GAY', [8, 22, 31]], ['NOD', [28, 30, 27]],
  ] },
  { opening: 'THREAD', moves: [
    ['THREAD', [3, 5, 7, 15, 13, 14]], ['COMELY', [4, 1, 11, 6, 9, 2]],
    ['DREAMY', [27, 16, 25, 22, 24, 17]], ['LOANER', [21, 30, 33, 28, 18, 19]],
    ['JOY', [0, 10, 31]],
  ] },
]

function play(state: LetterStrikeState, word: string, ids: readonly number[]): LetterStrikeState {
  const before = structuredClone(state)
  const preview = previewLetterStrike(state, ids)
  assert.equal(preview.word, word)
  assert.equal(preview.valid, true, `${word}: ${preview.error}`)
  const next = submitLetterStrike(state, ids)
  assert.deepEqual(next.playedWords.at(-1)?.preview, preview, `${word} preview must be the committed outcome`)
  assert.deepEqual(next.enemyLetters, preview.enemyLetters)
  assert.equal(next.playerResolve, state.playerResolve - preview.resolveCost)
  assert.deepEqual(state, before, `${word} must not mutate its input`)
  return next
}

for (const { opening, moves } of routes) {
  test(`authored prototype remains winnable after ${opening}, with exact preview and deterministic refills`, () => {
    let game = createLetterStrikeGame()
    let repeated = createLetterStrikeGame()
    for (const [word, ids] of moves) {
      if (game.status === 'won') break
      game = play(game, word, ids)
      repeated = submitLetterStrike(repeated, ids)
      assert.deepEqual(game, repeated, `${opening} route must replay the same board, IDs and armour`)
    }
    assert.equal(game.status, 'won')
    assert.equal(game.enemyLetters.every(letter => letter.hitsRemaining === 0), true)
    assert.equal(game.playedWords.reduce((total, move) => total + move.strikes, 0), 12)
    assert.equal(game.playedWords.filter(move => move.effectLabels.includes('WARD')).length, 1)
    assert.equal(game.playedWords.filter(move => move.effectLabels.includes('STRIKE')).length, 1)
  })
}

test('ordinary and Ward E offer the same THREAD targets while choosing when to save Resolve', () => {
  const initial = createLetterStrikeGame()
  const ordinaryIds = [3, 5, 7, 6, 13, 14]
  const wardIds = [3, 5, 7, 15, 13, 14]
  const ordinaryPreview = previewLetterStrike(initial, ordinaryIds)
  const wardPreview = previewLetterStrike(initial, wardIds)
  assert.equal(ordinaryPreview.strikes, 2)
  assert.equal(wardPreview.strikes, ordinaryPreview.strikes)
  assert.deepEqual(wardPreview.enemyLetters, ordinaryPreview.enemyLetters)
  assert.equal(ordinaryPreview.resolveCost, 1)
  assert.equal(wardPreview.resolveCost, 0)

  const ordinaryFirst = play(initial, 'THREAD', ordinaryIds)
  const wardFirst = play(initial, 'THREAD', wardIds)
  assert.equal(ordinaryFirst.tiles.find(tile => tile.id === 15)?.gem, 'ward')
  assert.equal(wardFirst.tiles.some(tile => tile.gem === 'ward'), false)

  // Saving the Ward E remains useful on a different long word next turn.
  const wardLater = play(ordinaryFirst, 'COMELY', [4, 1, 11, 15, 9, 2])
  const ordinaryLater = play(wardFirst, 'COMELY', [4, 1, 11, 6, 9, 2])
  assert.equal(wardLater.playedWords[1].preview.resolveCost, 0)
  assert.equal(ordinaryLater.playedWords[1].preview.resolveCost, 1)
  assert.equal(wardLater.playerResolve, ordinaryLater.playerResolve)
  assert.deepEqual(wardLater.enemyLetters, ordinaryLater.enemyLetters)
})

test('middle boards retain a counter, a useful long neutral and resisted bait', () => {
  let game = play(createLetterStrikeGame(), 'JOY', [0, 1, 2])
  game = play(game, 'CHEER', [4, 5, 15, 18, 16])
  const counter = previewLetterStrike(game, [8, 9, 13, 14]) // GLAD
  const long = previewLetterStrike(game, [11, 20, 9, 10, 14, 17]) // MELODY
  const bait = previewLetterStrike(game, [12, 13, 14]) // SAD
  assert.equal(counter.valid && long.valid && bait.valid, true)
  assert.equal(counter.semanticLabel, 'COUNTER')
  assert.equal(counter.strikes, 2)
  assert.equal(long.semanticLabel, 'NEUTRAL')
  assert.equal(long.longWordModifier, 1)
  assert.equal(long.strikes, 3)
  assert.deepEqual(long.effectLabels, ['STRIKE'])
  assert.equal(bait.semanticLabel, 'RESISTED')
  assert.equal(bait.strikes, 1)
})

test('the later authored PPY block creates a useful HAPPY counter after four turns', () => {
  let game = createLetterStrikeGame()
  for (const [word, ids] of [
    ['CLOSET', [4, 9, 1, 12, 15, 3]], ['MERRY', [11, 18, 16, 7, 2]],
    ['GLAD', [8, 21, 22, 14]], ['MEANED', [24, 6, 13, 28, 25, 27]],
  ] as const) game = play(game, word, ids)
  assert.equal(game.status, 'playing')
  assert.deepEqual(game.enemyLetters.filter(letter => letter.hitsRemaining > 0).map(letter => letter.letter), ['H', 'Y'])
  const happy = previewLetterStrike(game, [5, 33, 35, 36, 31])
  assert.equal(happy.word, 'HAPPY')
  assert.equal(happy.valid, true)
  assert.equal(happy.semanticLabel, 'COUNTER')
  assert.equal(happy.strikes, 2)
  assert.equal(play(game, 'HAPPY', [5, 33, 35, 36, 31]).status, 'won')
})
