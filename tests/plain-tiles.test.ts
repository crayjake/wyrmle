import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { bingoPreviews } from '../src/experimental/bingo/catalog.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'
import { bingoEncounter } from '../src/experimental/bingo/puzzle.ts'
import { createCandidate } from '../src/generator/generate.ts'

test('current and future dailies have ordinary tiles; archived saves retain their rules', () => {
  for (const date of ['2026-09-26', '2026-09-27', '2026-09-28', '2026-10-01']) {
    const puzzle = getDailyPuzzle(date)
    assert.equal(puzzle.puzzleVersion, 14)
    assert.ok(puzzle.encounter.startingTiles.every(tile => tile.type === 'normal' && !tile.gem))
    assert.equal(puzzle.encounter.tileEffects.regen, undefined)
  }
  const current = getDailyPuzzle('2026-09-26').encounter
  const archived = getDailyPuzzleForVersion('2026-09-26', 'letter-strike-7', 13).encounter
  assert.equal(archived.startingTiles.filter(tile => tile.type === 'gem').length, 3)
  assert.equal(current.meaningLexicon, archived.meaningLexicon)
  assert.equal(current.refillQueue, archived.refillQueue)
  assert.deepEqual(current.enemyLetters, archived.enemyLetters)
})

test('the ordinary-tile daily wins through real counter and neutral moves with no special effects', () => {
  let game = createLetterStrikeGame(getDailyPuzzle('2026-09-26').encounter)
  const moves = [
    { word: 'BALANCES', ids: [2, 1, 10, 15, 12, 8, 11, 6] },
    { word: 'METHOD', ids: [14, 20, 17, 7, 0, 5] },
    { word: 'ACORN', ids: [23, 24, 26, 13, 21] },
  ]
  for (const move of moves) {
    game = submitLetterStrike(game, move.ids)
    assert.equal(game.error, null)
    assert.equal(game.playedWords.at(-1)?.word, move.word)
    assert.equal(game.playedWords.at(-1)?.preview.resolveCost, 1)
    assert.deepEqual(game.playedWords.at(-1)?.effectLabels, [])
    assert.ok(game.tiles.every(tile => tile.type === 'normal' && !tile.gem))
  }
  assert.equal(game.status, 'won')
  assert.equal(game.playerResolve, 2)
})

test('every shipped bingo board has no special tiles', () => {
  for (const entry of bingoPreviews) {
    const data = JSON.parse(readFileSync(new URL(`../public/${entry.asset}`, import.meta.url), 'utf8'))
    const encounter = decodeBingoPreview(data, entry, 3)
    assert.ok(encounter.startingTiles.every(tile => tile.type === 'normal' && !tile.gem), entry.id)
  }
  assert.ok(bingoEncounter.startingTiles.every(tile => tile.type === 'normal' && !tile.gem))
})

test('current generation refuses special-tile requests instead of silently reintroducing them', () => {
  assert.throws(() => createCandidate('CHAOS', 'removed', { includeRegenTile: true }), /removed/)
  assert.throws(() => createCandidate('CHAOS', 'removed', { regenTileCount: 2 }), /removed/)
})
