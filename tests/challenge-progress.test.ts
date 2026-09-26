import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { bingoPreviews } from '../src/experimental/bingo/catalog.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'
import { openChallenge, saveChallenge, restartChallenge, challengeLives, challengeStars, challengeHistory } from '../src/daily/challengeProgress.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) }, key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size } }
}
const entry = bingoPreviews.find(e => e.enemy === 'ARID')!
const encounter = decodeBingoPreview(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')), entry, 3)
const date = '2026-09-26'
const play = (game: ReturnType<typeof createLetterStrikeGame>, word: string) => submitLetterStrike(game, selectWordIds(game.tiles, word)!)

test('daily progression follows wins, allows unlimited losses and retains best stars', () => {
  const store = storage()
  let { record, game } = openChallenge(date, entry.asset, encounter, store)
  record = saveChallenge(record, game, true, store)
  for (const word of ['WATER', 'SPRING', 'DIP']) { game = play(game, word); record = saveChallenge(record, game, true, store) }
  assert.equal(game.status, 'won'); assert.equal(record.bestWords, 3); assert.equal(record.attempts, 1)
  record = restartChallenge(record, store); assert.equal(record.run.lives, 2)
  ;({ record, game } = openChallenge(date, entry.asset, encounter, store))
  for (const word of ['RAIN', 'MIRED']) { game = play(game, word); record = saveChallenge(record, game, true, store) }
  assert.equal(game.status, 'won'); assert.equal(record.bestWords, 2)
  for (let i = 0; i < 8; i++) {
    record = restartChallenge(record, store); assert.equal(record.run.lives, 1)
    ;({ record, game } = openChallenge(date, entry.asset, encounter, store))
    game = play(game, 'AIR'); record = saveChallenge(record, game, true, store)
    assert.equal(game.status, 'lost'); assert.equal(record.bestWords, 2)
  }
  record = restartChallenge(record, store)
  ;({ record, game } = openChallenge(date, entry.asset, encounter, store))
  game = play(game, 'IRRIGATED'); record = saveChallenge(record, game, true, store)
  assert.equal(game.status, 'won'); assert.equal(record.bestWords, 1); assert.equal(challengeStars(record.bestWords), 3)
  assert.equal(challengeHistory(store).length, 1); assert.equal(record.attempts, 11)
  assert.equal(openChallenge(date, entry.asset, encounter, store).game.status, 'won')
})

test('losses do not reduce lives; duplicate begin saves do not count extra attempts', () => {
  const store = storage(); let { record, game } = openChallenge(date, entry.asset, encounter, store)
  record = saveChallenge(record, game, true, store); record = saveChallenge(record, game, true, store)
  assert.equal(record.attempts, 1)
  for (const word of ['AIR', 'AIR', 'DUST']) game = play(game, word)
  record = saveChallenge(record, game, true, store)
  assert.equal(game.status, 'lost'); assert.equal(record.bestWords, null)
  assert.equal(restartChallenge(record, store).run.lives, 3)
  assert.deepEqual([null, 3, 2, 1].map(challengeLives), [3, 2, 1, 1])
})

test('stale tabs cannot overwrite a newer attempt or best score', () => {
  const store = storage(); const { record, game } = openChallenge(date, entry.asset, encounter, store)
  const newer = saveChallenge(record, play(game, 'IRRIGATED'), true, store)
  assert.throws(() => saveChallenge(record, play(game, 'AIR'), true, store), /another tab/)
  assert.throws(() => restartChallenge(record, store), /another tab/)
  assert.equal(openChallenge(date, entry.asset, encounter, store).record.bestWords, newer.bestWords)
})
