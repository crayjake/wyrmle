import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bingoPreviews } from '../src/experimental/bingo/catalog.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'
import { bingoProgressKey, describeBingoProgress, readBingoProgress, restartBingoAttempt, resumeBingoAttempt, saveBingoAttempt } from '../src/experimental/bingo/progress.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'

class MemoryStorage {
  data = new Map<string, string>()
  writes = 0
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.writes++; this.data.set(key, value) }
}
const entry = bingoPreviews.find(entry => entry.id === 'bingo-arid-1')!
const payload = JSON.parse(readFileSync(new URL(`../public/${entry.asset}`, import.meta.url), 'utf8'))
const encounter = decodeBingoPreview(payload, entry, 3)
const key = bingoProgressKey(entry)
function play(game: LetterStrikeState, word: string) {
  const ids = selectWordIds(game.tiles, word)
  assert.ok(ids, word)
  const next = submitLetterStrike(game, ids)
  assert.equal(next.error, null)
  return next
}
function win(words: string[]) {
  const game = words.reduce(play, createLetterStrikeGame(encounter))
  assert.equal(game.status, 'won')
  return game
}

test('opening alone is not ongoing; beginning and accepted moves resume from a small isolated log', () => {
  const storage = new MemoryStorage()
  storage.setItem('wyrmle:daily:run:2026-09-26', 'existing daily progress')
  storage.setItem('wyrmle:preferences:v1', 'existing preferences')
  const initial = createLetterStrikeGame(encounter)
  saveBingoAttempt(key, initial, false, 1, storage)
  assert.equal(storage.getItem(key), null)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).status, 'new')
  saveBingoAttempt(key, initial, true, 1, storage)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).status, 'ongoing')
  assert.equal(resumeBingoAttempt(key, encounter, storage).started, true)
  const game = play(initial, 'WATER')
  saveBingoAttempt(key, game, true, 2, storage)
  const resumed = resumeBingoAttempt(key, encounter, storage)
  assert.deepEqual(resumed.game, game)
  assert.equal(resumed.hintStep, 2)
  const writes = storage.writes
  saveBingoAttempt(key, { ...game, selectedTileIds: [game.tiles[0].id] }, true, 2, storage)
  assert.equal(storage.writes, writes, 'Selecting a tile must not rewrite progress')
  assert.ok(storage.getItem(key)!.length < 1500, 'Do not store encounter/meaning data')
  assert.equal(storage.getItem('wyrmle:daily:run:2026-09-26'), 'existing daily progress')
  assert.equal(storage.getItem('wyrmle:preferences:v1'), 'existing preferences')
  assert.equal(storage.data.size, 3)
})

test('best stars improve from three words to two to bingo and survive restarts, losses and life changes', () => {
  const storage = new MemoryStorage()
  for (const [words, stars] of [[['WATER', 'SPRING', 'DIP'], 1], [['RAIN', 'MIRED'], 2], [['IRRIGATED'], 3]] as const) {
    const game = win([...words])
    saveBingoAttempt(key, game, true, 1, storage)
    const best = readBingoProgress(key, storage)
    assert.equal(best.bestWords, words.length)
    assert.equal(describeBingoProgress(best, 3).stars, stars)
    assert.equal(resumeBingoAttempt(key, encounter, storage).game.status, 'won')
    restartBingoAttempt(key, 3, storage)
    assert.equal(resumeBingoAttempt(key, encounter, storage).started, false)
    assert.equal(readBingoProgress(key, storage).bestWords, words.length)
  }
  let lost = createLetterStrikeGame(encounter)
  while (lost.status === 'playing') {
    const word = Object.keys(encounter.meaningLexicon!.words).find(word => {
      if (word.length !== 3) return false
      const ids = selectWordIds(lost.tiles, word)
      return ids && previewLetterStrike(lost, ids).strikes <= 1
    })
    assert.ok(word)
    lost = play(lost, word)
  }
  assert.equal(lost.status, 'lost')
  saveBingoAttempt(key, lost, true, 3, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 1)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 5).label, 'Bingo')
  const separate = new MemoryStorage()
  saveBingoAttempt(key, lost, true, 1, separate)
  assert.equal(describeBingoProgress(readBingoProgress(key, separate), 3).label, 'Try again')
  for (const words of [4, 5]) assert.equal(describeBingoProgress({ version: 1, bestWords: words, runs: {} }, 5).stars, 1)
})

test('life budgets keep separate attempts, with one best score for the identical puzzle', () => {
  const storage = new MemoryStorage()
  const first = play(createLetterStrikeGame(encounter), 'WATER')
  saveBingoAttempt(key, first, true, 2, storage)
  const fiveLife = { ...encounter, startingResolve: 5 }
  const second = play(createLetterStrikeGame(fiveLife), 'RAIN')
  saveBingoAttempt(key, second, true, 3, storage)
  assert.deepEqual(resumeBingoAttempt(key, encounter, storage).game, first)
  assert.deepEqual(resumeBingoAttempt(key, fiveLife, storage).game, second)
  const best = play(second, 'MIRED')
  assert.equal(best.status, 'won')
  saveBingoAttempt(key, best, true, 3, storage)
  restartBingoAttempt(key, 3, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 2)
  assert.equal(resumeBingoAttempt(key, fiveLife, storage).game.status, 'won')
  assert.equal(resumeBingoAttempt(key, encounter, storage).started, false)
})

test('hints and revealing an answer do not grant completion, and revisions do not inherit old stars', () => {
  const storage = new MemoryStorage()
  const initial = createLetterStrikeGame(encounter)
  saveBingoAttempt(key, initial, false, 4, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, null)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).stars, 0)
  assert.equal(resumeBingoAttempt(key, encounter, storage).hintStep, 4)
  saveBingoAttempt(key, win(['IRRIGATED']), true, 4, storage)
  const replacement = bingoProgressKey({ asset: 'previews/bingo/arid-1-new-version.json' })
  assert.equal(readBingoProgress(replacement, storage).bestWords, null)
  assert.equal(readBingoProgress(bingoProgressKey(), storage).bestWords, null)
})

test('malformed logs and blocked storage fail safely without accepting partial replays', () => {
  const storage = new MemoryStorage()
  for (const raw of ['broken', 'null', '[]', '{"version":2,"runs":{}}', '{"version":1,"bestWords":-1,"runs":{}}']) {
    storage.setItem(key, raw)
    assert.equal(readBingoProgress(key, storage).bestWords, null)
    assert.equal(resumeBingoAttempt(key, encounter, storage).started, false)
  }
  saveBingoAttempt(key, play(createLetterStrikeGame(encounter), 'WATER'), true, 2, storage)
  const stored = JSON.parse(storage.getItem(key)!)
  stored.runs[3].moves.push({ word: 'CAT', ids: [999, 998, 997] })
  storage.setItem(key, JSON.stringify(stored))
  assert.equal(resumeBingoAttempt(key, encounter, storage).game.playedWords.length, 0)
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('full') } }
  assert.equal(resumeBingoAttempt(key, encounter, blocked).started, false)
  assert.equal(saveBingoAttempt(key, createLetterStrikeGame(encounter), true, 1, blocked), false)
  assert.equal(restartBingoAttempt(key, 3, blocked), false)
})
