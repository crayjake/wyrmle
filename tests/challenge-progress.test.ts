import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { bingoPreviews } from '../src/experimental/bingo/catalog.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'
import { openChallenge, saveChallenge, restartChallenge, challengeLives, challengeStars, challengeHistory, challengeBestSolution, readChallenge, challengeKey, challengeBackupKey } from '../src/daily/challengeProgress.ts'
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

test('best winning words survive replays, losses and reloads, and change with a better score', () => {
  const store = storage()
  let { record, game } = openChallenge(date, entry.asset, encounter, store)
  for (const word of ['WATER', 'SPRING', 'DIP']) game = play(game, word)
  record = saveChallenge(record, game, true, store)
  assert.deepEqual(challengeBestSolution(record), ['WATER', 'SPRING', 'DIP'])
  record = restartChallenge(record, store)
  ;({ record, game } = openChallenge(date, entry.asset, encounter, store))
  for (const word of ['AIR', 'AIR']) game = play(game, word)
  record = saveChallenge(record, game, true, store)
  assert.equal(game.status, 'lost')
  assert.deepEqual(challengeBestSolution(readChallenge(date, store)!), ['WATER', 'SPRING', 'DIP'])
  record = restartChallenge(record, store)
  ;({ record, game } = openChallenge(date, entry.asset, encounter, store))
  for (const word of ['RAIN', 'MIRED']) game = play(game, word)
  record = saveChallenge(record, game, true, store)
  assert.deepEqual(challengeBestSolution(record), ['RAIN', 'MIRED'])
  record = restartChallenge(record, store)
  ;({ record, game } = openChallenge(date, entry.asset, encounter, store))
  record = saveChallenge(record, play(game, 'IRRIGATED'), true, store)
  assert.deepEqual(challengeBestSolution(readChallenge(date, store)!), ['IRRIGATED'])
})

test('older wins recover their words before restart; older score-only saves remain usable', () => {
  const store = storage()
  const opened = openChallenge(date, entry.asset, encounter, store)
  const win = saveChallenge(opened.record, play(opened.game, 'IRRIGATED'), true, store)
  delete win.bestSolution
  store.setItem(challengeKey(date), JSON.stringify(win))
  assert.deepEqual(challengeBestSolution(readChallenge(date, store)!), ['IRRIGATED'])
  let record = restartChallenge(readChallenge(date, store)!, store)
  assert.deepEqual(challengeBestSolution(record), ['IRRIGATED'])
  delete record.bestSolution
  store.setItem(challengeKey(date), JSON.stringify(record))
  assert.equal(challengeBestSolution(readChallenge(date, store)!), undefined)
  assert.equal(openChallenge(date, entry.asset, encounter, store).record.bestWords, 1)
  for (const bestSolution of [null, 'IRRIGATED', ['BAD', 'DATA'], ['not a saved word']]) {
    store.setItem(challengeKey(date), JSON.stringify({ ...record, bestSolution }))
    assert.equal(readChallenge(date, store)!.bestWords, 1)
    assert.equal(challengeBestSolution(readChallenge(date, store)!), undefined)
  }
  record = saveChallenge(record, play(openChallenge(date, entry.asset, encounter, store).game, 'IRRIGATED'), true, store)
  assert.deepEqual(challengeBestSolution(record), ['IRRIGATED'], 'A tied win can fill a missing word list')
})

test('stale tabs cannot overwrite a newer attempt or best score', () => {
  const store = storage(); const { record, game } = openChallenge(date, entry.asset, encounter, store)
  const newer = saveChallenge(record, play(game, 'IRRIGATED'), true, store)
  assert.throws(() => saveChallenge(record, play(game, 'AIR'), true, store), /another tab/)
  assert.throws(() => restartChallenge(record, store), /another tab/)
  assert.equal(openChallenge(date, entry.asset, encounter, store).record.bestWords, newer.bestWords)
})

test('replacing a daily backs up the old win without transferring its stars or lives', () => {
  const store = storage()
  const old = openChallenge(date, entry.asset, encounter, store)
  const win = saveChallenge(old.record, play(old.game, 'IRRIGATED'), true, store, 4)
  // Simulate a record from the deployed version before per-asset backups existed.
  store.removeItem(challengeBackupKey(date, entry.asset))
  const replacement = 'puzzles/replacement.json'
  const fresh = openChallenge(date, replacement, encounter, store)
  assert.equal(fresh.record.bestWords, null)
  assert.equal(fresh.record.attempts, 0)
  assert.equal(fresh.record.run.lives, 3)
  assert.equal(fresh.hintStep, 1)
  assert.deepEqual(JSON.parse(store.getItem(challengeKey(date))!), win, 'Opening is read-only')
  const started = saveChallenge(fresh.record, play(fresh.game, 'WATER'), true, store)
  assert.deepEqual(JSON.parse(store.getItem(challengeBackupKey(date, entry.asset))!), win)
  assert.equal(openChallenge(date, entry.asset, encounter, store).game.status, 'won', 'Old moves remain recoverable')
  assert.equal(openChallenge(date, replacement, encounter, store).game.playedWords[0].word, 'WATER')
  assert.equal(challengeHistory(store).length, 1, 'Backups are not counted as extra days')
  assert.throws(() => restartChallenge(win, store), /another tab/)
  assert.equal(restartChallenge(started, store).run.lives, 3)
})

test('a legacy tab cannot permanently erase progress on a replacement board', () => {
  const store = storage()
  const old = openChallenge(date, entry.asset, encounter, store)
  const oldWin = saveChallenge(old.record, play(old.game, 'IRRIGATED'), true, store)
  const replacement = 'puzzles/replacement.json'
  const fresh = openChallenge(date, replacement, encounter, store)
  saveChallenge(fresh.record, play(fresh.game, 'WATER'), true, store)
  store.setItem(challengeKey(date), JSON.stringify({ ...oldWin, revision: 20 }))
  const restored = openChallenge(date, replacement, encounter, store)
  assert.equal(restored.record.revision, 20)
  assert.equal(restored.record.bestWords, null)
  assert.equal(restored.game.playedWords[0].word, 'WATER')
  saveChallenge(restored.record, restored.game, true, store)
  assert.equal(JSON.parse(store.getItem(challengeKey(date))!).asset, replacement)
})

test('a failed backup leaves the previous daily save untouched', () => {
  const store = storage()
  const old = openChallenge(date, entry.asset, encounter, store)
  const win = saveChallenge(old.record, play(old.game, 'IRRIGATED'), true, store)
  const fresh = openChallenge(date, 'replacement', encounter, store)
  const full = { getItem: store.getItem, setItem: () => { throw new Error('Storage full') } }
  assert.throws(() => saveChallenge(fresh.record, fresh.game, true, full), /Storage full/)
  assert.deepEqual(JSON.parse(store.getItem(challengeKey(date))!), win)
})
