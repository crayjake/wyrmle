import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clearDailyHistory, getInProgressPuzzleIds, getOpeningPuzzleId, getResultStorageKey, getRunStorageKey,
  inspectDailyStorage, loadDailySession, loadResults, resetDailyPuzzle, saveDailyRun,
} from '../src/daily/persistence.ts'
import { getDailyPuzzle } from '../src/daily/puzzle.ts'
import type { StorageLike } from '../src/daily/types.ts'
import { createGame, submitWord, toggleTile } from '../src/game/game.ts'
import type { GameState } from '../src/game/types.ts'

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  failKey: string | null = null
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('Storage quota exceeded')
    this.data.set(key, value)
  }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

const puzzle = getDailyPuzzle('2026-09-24')
const finishedAt = '2026-09-24T12:00:00.000Z'

function playWords(words: string[], normalOnly = false, game = createGame(puzzle.encounter)): GameState {
  for (const word of words) {
    const ids: number[] = []
    for (const letter of word) {
      const tile = game.tiles.find((tile) => tile.letter === letter && !ids.includes(tile.id)
        && (!normalOnly || tile.type === 'normal'))
      assert.ok(tile, `Missing ${letter} in ${word}`)
      ids.push(tile.id)
    }
    game = submitWord(game, ids)
    assert.equal(game.error, null)
  }
  return game
}

test('a fresh date reconstructs the canonical starting state without writing during load', () => {
  const storage = new MemoryStorage()
  const session = loadDailySession(puzzle, storage)
  assert.deepEqual(session.game, createGame(puzzle.encounter))
  assert.equal(session.resumed, false)
  assert.equal(session.result, null)
  assert.equal(session.error, null)
  assert.equal(storage.length, 0)
})

test('refresh restores the exact committed run and excludes transient selection/error state', () => {
  const storage = new MemoryStorage()
  const game = playWords(['JOY', 'CHEER'])
  const selected = { ...toggleTile(game, game.tiles[0].id), error: 'temporary validation feedback' }
  saveDailyRun(puzzle, selected, storage)
  const restored = loadDailySession(puzzle, storage)
  assert.equal(restored.resumed, true)
  assert.equal(restored.error, null)
  assert.deepEqual(restored.game, game)
  const saved = JSON.parse(storage.getItem(getRunStorageKey(puzzle.puzzleId))!)
  assert.equal('selectedTileIds' in saved, false)
  assert.equal('error' in saved, false)
  assert.equal('encounter' in saved, false)
  assert.equal(saved.refillIndex, 8)
  assert.equal(saved.nextTileId, 24)
  assert.deepEqual(saved.playedWords, game.playedWords)
})

test('wins and losses remain completed after refreshing and reject attempts to replace results', () => {
  for (const outcome of ['won', 'lost']) {
    const storage = new MemoryStorage()
    const game = outcome === 'won'
      ? playWords(['JOY', 'CHEER', 'HAPPY'])
      : playWords(['ACE', 'ADO', 'EGO', 'AHS', 'HOM'], true)
    assert.equal(game.status, outcome)
    const complete = saveDailyRun(puzzle, game, storage, finishedAt)
    assert.deepEqual(loadDailySession(puzzle, storage).game, game)
    assert.deepEqual(loadResults(storage), [complete.result])
    const staleWrite = saveDailyRun(puzzle, createGame(puzzle.encounter), storage)
    assert.deepEqual(staleWrite.result, complete.result)
    assert.deepEqual(loadDailySession(puzzle, storage).game, game)
    assert.equal(loadDailySession(puzzle, storage).result?.completedAt, finishedAt)
    assert.deepEqual(getInProgressPuzzleIds(storage), [])
  }
})

test('a result restores terminal gameplay even when the run is missing, stale or corrupted', () => {
  const storage = new MemoryStorage()
  const game = playWords(['JOY', 'CHEER', 'HAPPY'])
  saveDailyRun(puzzle, game, storage, finishedAt)
  const runKey = getRunStorageKey(puzzle.puzzleId)
  for (const raw of [null, '{broken json', JSON.stringify({ status: 'playing', saveVersion: -1 })]) {
    if (raw === null) storage.removeItem(runKey)
    else storage.setItem(runKey, raw)
    const restored = loadDailySession(puzzle, storage)
    assert.equal(restored.error, null)
    assert.deepEqual(restored.game, game)
    assert.equal(restored.result?.completedAt, finishedAt)
  }
})

test('terminal run recovers a missing result without mutating during reads, then repairs it on save', () => {
  const storage = new MemoryStorage()
  const game = playWords(['JOY', 'CHEER', 'HAPPY'])
  const completed = saveDailyRun(puzzle, game, storage, finishedAt)
  storage.removeItem(getResultStorageKey(puzzle.puzzleId))
  assert.deepEqual(loadDailySession(puzzle, storage).result, completed.result)
  assert.deepEqual(loadResults(storage), [completed.result])
  assert.equal(storage.length, 1)
  saveDailyRun(puzzle, game, storage, '2026-09-25T00:00:00.000Z')
  assert.equal(storage.length, 2)
  assert.equal(loadDailySession(puzzle, storage).result?.completedAt, finishedAt)
})

test('completion is durable when the subsequent terminal run write fails', () => {
  const storage = new MemoryStorage()
  saveDailyRun(puzzle, playWords(['JOY']), storage)
  storage.failKey = getRunStorageKey(puzzle.puzzleId)
  const game = playWords(['JOY', 'CHEER', 'HAPPY'])
  assert.throws(() => saveDailyRun(puzzle, game, storage, finishedAt), /quota/)
  const restored = loadDailySession(puzzle, storage)
  assert.deepEqual(restored.game, game)
  assert.equal(restored.result?.completedAt, finishedAt)
})

test('result write failure does not overwrite the last committed run', () => {
  const storage = new MemoryStorage()
  const prior = playWords(['JOY'])
  saveDailyRun(puzzle, prior, storage)
  storage.failKey = getResultStorageKey(puzzle.puzzleId)
  assert.throws(() => saveDailyRun(puzzle, playWords(['JOY', 'CHEER', 'HAPPY']), storage, finishedAt), /quota/)
  assert.deepEqual(loadDailySession(puzzle, storage).game, prior)
  assert.equal(loadResults(storage).length, 0)
})

test('different dates keep independent runs and reset reconstructs only the selected day', () => {
  const storage = new MemoryStorage()
  const other = getDailyPuzzle('2026-09-25')
  const first = playWords(['JOY'])
  const second = playWords(['CHEER'], false, createGame(other.encounter))
  saveDailyRun(puzzle, first, storage)
  saveDailyRun(other, second, storage)
  assert.deepEqual(loadDailySession(puzzle, storage).game, first)
  assert.deepEqual(loadDailySession(other, storage).game, second)
  assert.deepEqual(getInProgressPuzzleIds(storage), [puzzle.puzzleId, other.puzzleId])
  resetDailyPuzzle(puzzle.puzzleId, storage)
  assert.deepEqual(loadDailySession(puzzle, storage).game, createGame(puzzle.encounter))
  assert.equal(loadDailySession(puzzle, storage).resumed, false)
  assert.deepEqual(loadDailySession(other, storage).game, second)
})

test('DEV reset removes permanent completion as well as the run', () => {
  const storage = new MemoryStorage()
  saveDailyRun(puzzle, playWords(['JOY', 'CHEER', 'HAPPY']), storage, finishedAt)
  resetDailyPuzzle(puzzle.puzzleId, storage)
  assert.equal(loadResults(storage).length, 0)
  assert.deepEqual(loadDailySession(puzzle, storage).game, createGame(puzzle.encounter))
})

test('corrupted or unsupported run saves block play without erasing or overwriting data', () => {
  const fixtures = [
    '{broken',
    JSON.stringify({ saveVersion: 99 }),
    JSON.stringify({ saveVersion: 1, gameVersion: '99', puzzleVersion: 1, puzzleId: puzzle.puzzleId }),
  ]
  for (const raw of fixtures) {
    const storage = new MemoryStorage()
    const key = getRunStorageKey(puzzle.puzzleId)
    storage.setItem(key, raw)
    const restored = loadDailySession(puzzle, storage)
    assert.equal(restored.game, null)
    assert.match(restored.error!, /saved data has been kept/)
    assert.throws(() => saveDailyRun(puzzle, createGame(puzzle.encounter), storage))
    assert.equal(storage.getItem(key), raw)
  }
})

test('replay validation rejects altered HP, tiles, history and result totals', () => {
  for (const field of ['enemyHp', 'tiles', 'playedWords']) {
    const storage = new MemoryStorage()
    saveDailyRun(puzzle, playWords(['JOY']), storage)
    const key = getRunStorageKey(puzzle.puzzleId)
    const run = JSON.parse(storage.getItem(key)!)
    if (field === 'enemyHp') run.enemyHp = 1
    else if (field === 'tiles') run.tiles[0].letter = 'Z'
    else run.playedWords[0].damage = 999
    storage.setItem(key, JSON.stringify(run))
    assert.equal(loadDailySession(puzzle, storage).game, null)
    assert.match(loadDailySession(puzzle, storage).error!, /does not match/)
  }
  const storage = new MemoryStorage()
  saveDailyRun(puzzle, playWords(['JOY', 'CHEER', 'HAPPY']), storage, finishedAt)
  const key = getResultStorageKey(puzzle.puzzleId)
  const envelope = JSON.parse(storage.getItem(key)!)
  envelope.result.totalDamage = 999
  storage.setItem(key, JSON.stringify(envelope))
  assert.equal(loadDailySession(puzzle, storage).game, null)
  assert.throws(() => loadResults(storage), /does not match/)
})

test('active stale tabs cannot regress or diverge from already committed history', () => {
  const storage = new MemoryStorage()
  const saved = playWords(['JOY', 'CHEER'])
  saveDailyRun(puzzle, saved, storage)
  assert.throws(() => saveDailyRun(puzzle, playWords(['JOY']), storage), /another tab/)
  assert.throws(() => saveDailyRun(puzzle, playWords(['CHEER']), storage), /another tab/)
  assert.deepEqual(loadDailySession(puzzle, storage).game, saved)
})

test('storage inspection and clearing leave unrelated application keys alone', () => {
  const storage = new MemoryStorage()
  storage.setItem('another-app', 'retained')
  saveDailyRun(puzzle, playWords(['JOY']), storage)
  assert.equal(Object.keys(inspectDailyStorage(storage)).length, 1)
  clearDailyHistory(storage)
  assert.equal(storage.length, 1)
  assert.equal(storage.getItem('another-app'), 'retained')
})

test('denied storage access blocks instead of pretending the user has no save', () => {
  const storage = new MemoryStorage()
  storage.getItem = () => { throw new Error('Storage access denied') }
  const session = loadDailySession(puzzle, storage)
  assert.equal(session.game, null)
  assert.match(session.error!, /Storage access denied/)
})

test('reopening after UTC midnight resumes the latest unfinished earlier date', () => {
  const storage = new MemoryStorage()
  const earlier = getDailyPuzzle('2026-09-23')
  saveDailyRun(earlier, createGame(earlier.encounter), storage)
  saveDailyRun(puzzle, playWords(['JOY']), storage)
  assert.equal(getOpeningPuzzleId('2026-09-25', storage), puzzle.puzzleId)
  assert.equal(getOpeningPuzzleId('2026-09-28', storage), puzzle.puzzleId)
})

test('any saved attempt or completed result for today takes opening priority', () => {
  const today = getDailyPuzzle('2026-09-25')
  for (const completed of [false, true]) {
    const storage = new MemoryStorage()
    saveDailyRun(puzzle, playWords(['JOY']), storage)
    const game = completed
      ? playWords(['JOY', 'CHEER', 'HAPPY'], false, createGame(today.encounter))
      : createGame(today.encounter)
    saveDailyRun(today, game, storage, '2026-09-25T12:00:00.000Z')
    if (completed) storage.removeItem(getRunStorageKey(today.puzzleId))
    assert.equal(getOpeningPuzzleId(today.puzzleId, storage), today.puzzleId)
  }
})

test('opening selects today when earlier dates are complete or absent and ignores future DEV saves', () => {
  const storage = new MemoryStorage()
  assert.equal(getOpeningPuzzleId('2026-09-25', storage), '2026-09-25')
  saveDailyRun(puzzle, playWords(['JOY', 'CHEER', 'HAPPY']), storage, finishedAt)
  const future = getDailyPuzzle('2026-09-26')
  saveDailyRun(future, createGame(future.encounter), storage)
  assert.equal(getOpeningPuzzleId('2026-09-25', storage), '2026-09-25')
  storage.setItem(getRunStorageKey(future.puzzleId), '{bad future DEV save')
  assert.equal(getOpeningPuzzleId('2026-09-25', storage), '2026-09-25')
})

test('opening reports unreadable prior saves and preserves unreadable today for the session error', () => {
  const storage = new MemoryStorage()
  storage.setItem(getRunStorageKey(puzzle.puzzleId), '{broken')
  assert.throws(() => getOpeningPuzzleId('2026-09-25', storage), /saved data has been kept/)
  assert.equal(getOpeningPuzzleId(puzzle.puzzleId, storage), puzzle.puzzleId)
})

test('every run and result version field rejects incompatible stored formats without overwriting', () => {
  for (const type of ['run', 'result']) {
    for (const field of ['saveVersion', 'gameVersion', 'puzzleVersion']) {
      const storage = new MemoryStorage()
      saveDailyRun(puzzle, playWords(['JOY', 'CHEER', 'HAPPY']), storage, finishedAt)
      const key = type === 'run' ? getRunStorageKey(puzzle.puzzleId) : getResultStorageKey(puzzle.puzzleId)
      if (type === 'run') storage.removeItem(getResultStorageKey(puzzle.puzzleId))
      const data = JSON.parse(storage.getItem(key)!)
      if (type === 'result' && field !== 'saveVersion') data.result[field] = field === 'gameVersion' ? '99' : 99
      else data[field] = field === 'gameVersion' ? '99' : 99
      const raw = JSON.stringify(data)
      storage.setItem(key, raw)
      const restored = loadDailySession(puzzle, storage)
      assert.equal(restored.game, null)
      assert.match(restored.error!, /unsupported/)
      assert.throws(() => saveDailyRun(puzzle, createGame(puzzle.encounter), storage), /unsupported/)
      assert.equal(storage.getItem(key), raw)
    }
  }
})
