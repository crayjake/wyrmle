import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRunStorageKey, loadDailySession, saveDailyRun, undoDailyRun } from '../src/daily/persistence.ts'
import { getDailyPuzzle } from '../src/daily/puzzle.ts'
import { captureUndoSnapshot, restoreUndoSnapshot } from '../src/daily/undo.ts'
import type { DailySession, StorageLike } from '../src/daily/types.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { findPlayableWords } from '../src/generator/findMoves.ts'

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  readonly maximumCharacters: number
  constructor(maximumCharacters = Number.POSITIVE_INFINITY) { this.maximumCharacters = maximumCharacters }
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) {
    if (value.length > this.maximumCharacters) throw new Error('Storage quota exceeded')
    this.data.set(key, value)
  }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

const published = getDailyPuzzle('2026-09-25')
const archived = getDailyPuzzle('2026-09-26')
const at = '2026-09-25T15:00:00.000Z'

function continuation(game: LetterStrikeState): LetterStrikeState {
  for (const word of findPlayableWords(game)) {
    if (word.length > 4) continue
    const ids: number[] = []
    for (const letter of word) ids.push(game.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))!.id)
    const next = submitLetterStrike(game, ids)
    if (!next.error && next.status === 'playing') return next
  }
  throw new Error('Published fixture needs a nonterminal short-word continuation.')
}

function begin(storage: StorageLike): DailySession {
  const fresh = loadDailySession(published, storage)
  assert.equal(fresh.error, null)
  return saveDailyRun(published, fresh.game!, storage, at, 'normal', fresh.revision)
}

test('large published meanings are shared in memory while saved undo positions remain small through reload and undo', () => {
  assert.ok(published.encounter.meaningLexicon, 'This fixture must exercise the meaning-era publication.')
  assert.ok(JSON.stringify(published.encounter.meaningLexicon).length > 1_000_000, 'Exercise a table large enough to regress storage size.')
  const storage = new MemoryStorage(100_000)
  const initial = begin(storage)
  const first = saveDailyRun(published, continuation(initial.game!), storage, at, 'normal', initial.revision)
  const second = saveDailyRun(published, continuation(first.game!), storage, at, 'normal', first.revision)
  const key = getRunStorageKey(published.puzzleId)
  const raw = storage.getItem(key)!
  const stored = JSON.parse(raw)
  assert.ok(raw.length < 50_000)
  assert.equal(stored.undoHistory.length, 2)
  assert.ok(stored.undoHistory.every((position: object) => !Object.hasOwn(position, 'encounter')))
  assert.ok(!raw.includes('meaningLexicon'))
  const loaded = loadDailySession(published, storage)
  assert.equal(loaded.error, null)
  assert.equal(storage.getItem(key), raw, 'Reading does not migrate or rewrite stored bytes.')
  assert.deepEqual(loaded.game, second.game)
  for (const state of [loaded.game!, ...loaded.undoHistory]) {
    assert.equal(state.encounter, published.encounter)
    assert.equal(state.encounter.meaningLexicon, published.encounter.meaningLexicon)
  }
  assert.ok(Object.isFrozen(loaded.undoHistory[0].tiles[0]))
  const undone = undoDailyRun(published, storage, loaded.revision)
  assert.deepEqual(undone.game, first.game)
  assert.equal(undone.game!.encounter, published.encounter)
  assert.deepEqual(loadDailySession(published, storage).game, first.game)
  const backToStart = undoDailyRun(published, storage, undone.revision)
  assert.deepEqual(backToStart.game, initial.game)
  assert.equal(backToStart.undosUsed, 2)
  assert.deepEqual(loadDailySession(published, storage).game, initial.game)
})

test('former full meaning-era undo snapshots load unchanged and compact on the next explicit commit', () => {
  const storage = new MemoryStorage()
  const initial = begin(storage)
  const first = saveDailyRun(published, continuation(initial.game!), storage, at, 'normal', initial.revision)
  const key = getRunStorageKey(published.puzzleId)
  const historical = JSON.parse(storage.getItem(key)!)
  historical.undoHistory = first.undoHistory
  const historicalRaw = JSON.stringify(historical)
  assert.ok(historicalRaw.length > 1_000_000)
  storage.setItem(key, historicalRaw)
  const loaded = loadDailySession(published, storage)
  assert.equal(loaded.error, null)
  assert.deepEqual(loaded.game, first.game)
  assert.equal(loaded.undoHistory[0].encounter, published.encounter)
  assert.equal(storage.getItem(key), historicalRaw)
  const committed = saveDailyRun(published, loaded.game!, storage, at, 'normal', loaded.revision)
  assert.ok(storage.getItem(key)!.length < 50_000)
  const restored = undoDailyRun(published, storage, committed.revision)
  assert.deepEqual(restored.game, initial.game)
  assert.deepEqual(loadDailySession(published, storage).game, initial.game)
})

test('compact undo snapshots remain exact evidence: altered positions and injected rule fields are rejected without writes', () => {
  const clean = new MemoryStorage()
  const initial = begin(clean)
  saveDailyRun(published, continuation(initial.game!), clean, at, 'normal', initial.revision)
  const key = getRunStorageKey(published.puzzleId)
  for (const field of ['refillIndex', 'encounter', 'meaningLexicon', 'selectedTileIds', 'tiles']) {
    const storage = new MemoryStorage()
    const corrupt = JSON.parse(clean.getItem(key)!)
    const snapshot = corrupt.undoHistory[0]
    if (field === 'refillIndex') snapshot.refillIndex = 999
    if (field === 'encounter') snapshot.encounter = { id: 'wrong-puzzle' }
    if (field === 'meaningLexicon') snapshot.meaningLexicon = {}
    if (field === 'selectedTileIds') snapshot.selectedTileIds = [0]
    if (field === 'tiles') snapshot.tiles.pop()
    const bytes = JSON.stringify(corrupt)
    storage.setItem(key, bytes)
    assert.ok(loadDailySession(published, storage).error, field)
    assert.equal(storage.getItem(key), bytes, field)
  }
})

test('archived schema-5 runs keep their historical snapshot shape and restore the same canonical encounter', () => {
  const storage = new MemoryStorage()
  const game = createLetterStrikeGame(archived.encounter)
  const started = saveDailyRun(archived, game, storage, at, 'normal', 0)
  const first = saveDailyRun(archived, continuation(started.game!), storage, at, 'normal', started.revision)
  const key = getRunStorageKey(archived.puzzleId)
  const bytes = storage.getItem(key)!
  assert.ok(JSON.parse(bytes).undoHistory[0].encounter, 'Old puzzle encoding is unchanged.')
  const loaded = loadDailySession(archived, storage)
  assert.equal(loaded.error, null)
  assert.equal(loaded.undoHistory[0].encounter, archived.encounter)
  assert.equal(storage.getItem(key), bytes)
  const undone = undoDailyRun(archived, storage, first.revision)
  assert.deepEqual(undone.game, game)
  assert.equal(undone.game!.encounter, archived.encounter)
})

test('snapshots copy mutable positions and unpublished rule objects while preserving an already immutable lexicon', () => {
  assert.ok(published.encounter.meaningLexicon)
  const mutableEncounter = { ...published.encounter,
    startingTiles: published.encounter.startingTiles.map(tile => ({ ...tile })),
    enemyLetters: published.encounter.enemyLetters.map(letter => ({ ...letter })),
  }
  const game = createLetterStrikeGame(mutableEncounter)
  const snapshot = captureUndoSnapshot({ ...game, selectedTileIds: [game.tiles[0].id], error: 'transient' })
  assert.notEqual(snapshot.encounter, mutableEncounter)
  assert.equal(snapshot.encounter.meaningLexicon, mutableEncounter.meaningLexicon)
  const originalLetter = snapshot.encounter.startingTiles[0].letter
  mutableEncounter.startingTiles[0].letter = 'Z'
  game.tiles[0].letter = 'Z'
  assert.equal(snapshot.encounter.startingTiles[0].letter, originalLetter)
  assert.equal(snapshot.tiles[0].letter, originalLetter)
  assert.deepEqual(snapshot.selectedTileIds, [])
  assert.equal(snapshot.error, null)
  const restored = restoreUndoSnapshot(snapshot)
  assert.deepEqual(restored, snapshot)
  assert.equal(restored.encounter, snapshot.encounter)
})
