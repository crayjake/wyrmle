import assert from 'node:assert/strict'
import { test } from 'node:test'
import { undoLimit } from '../src/daily/modes.ts'
import {
  getResultStorageKey, getRunStorageKey, loadDailySession, loadResults,
  saveDailyRun, setDailyUndosUsed, undoDailyRun,
} from '../src/daily/persistence.ts'
import { getDailyPuzzle } from '../src/daily/puzzle.ts'
import { buildDailyResult } from '../src/daily/results.ts'
import { buildDailyScoreSubmission } from '../src/daily/submission.ts'
import { captureUndoSnapshot, restoreUndoSnapshot } from '../src/daily/undo.ts'
import type { DifficultyMode, StorageLike } from '../src/daily/types.ts'
import { createLetterStrikeGame, submitLetterStrike, toggleLetterStrikeTile } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  failWrites = false
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Storage quota exceeded')
    this.data.set(key, value)
  }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

// Keep these authored v4 mechanic fixtures independent of scheduled replacements.
const puzzle = getDailyPuzzle('2026-09-28')
const at = '2026-09-28T12:00:00.000Z'

function play(game: LetterStrikeState, word: string): LetterStrikeState {
  const ids: number[] = []
  for (const letter of word) {
    const tile = game.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing ${letter} in ${word}`)
    ids.push(tile.id)
  }
  const next = submitLetterStrike(game, ids)
  assert.equal(next.error, null)
  return next
}

function begin(storage: MemoryStorage, mode: DifficultyMode = 'normal') {
  const fresh = loadDailySession(puzzle, storage, mode)
  return saveDailyRun(puzzle, fresh.game!, storage, at, mode, fresh.revision)
}

test('Normal begins with three undos, Hard one and Hardcore zero without changing the puzzle', () => {
  const states = (['normal', 'hard', 'hardcore'] as const).map(mode => {
    const storage = new MemoryStorage()
    const fresh = loadDailySession(puzzle, storage, mode)
    assert.equal(fresh.undosUsed, 0)
    assert.equal(fresh.undosRemaining, undoLimit(mode))
    assert.equal(fresh.started, false)
    assert.equal(storage.length, 0)
    const started = begin(storage, mode)
    assert.equal(started.undosRemaining, { normal: 3, hard: 1, hardcore: 0 }[mode])
    assert.throws(() => undoDailyRun(puzzle, storage, started.revision), /Submit a word/)
    return started.game
  })
  assert.deepEqual(states[0], states[1])
  assert.deepEqual(states[0], states[2])
})

test('undo restores the complete prior state, tile identities, Ward, armour, refill and Resolve after reload', () => {
  const storage = new MemoryStorage()
  const started = begin(storage)
  const before = structuredClone(started.game!)
  const advanced = saveDailyRun(puzzle, play(started.game!, 'CHEER'), storage, at, 'normal', started.revision)
  assert.notDeepEqual(advanced.game!.enemyLetters, before.enemyLetters)
  assert.notDeepEqual(advanced.game!.tiles, before.tiles)
  assert.notEqual(advanced.game!.refillIndex, before.refillIndex)
  assert.equal(advanced.game!.playedWords[0].preview.resolveCost, 0)
  const reloaded = loadDailySession(puzzle, storage, 'hardcore')
  assert.ok(Object.isFrozen(reloaded.undoHistory[0]))
  assert.ok(Object.isFrozen(reloaded.undoHistory[0].tiles[0]))
  const restored = undoDailyRun(puzzle, storage, reloaded.revision)
  assert.deepEqual(restored.game, before)
  assert.equal(restored.mode, 'normal')
  assert.equal(restored.undosUsed, 1)
  assert.equal(restored.undosRemaining, 2)
  assert.deepEqual(loadDailySession(puzzle, storage).game, before)
  assert.equal(loadDailySession(puzzle, storage).undosUsed, 1)
  assert.equal(loadResults(storage).length, 0)
  assert.deepEqual(started.game, before, 'the original state was never mutated')
})

test('snapshot restoration preserves REGEN, grammar, STRIKE and normal-cost consequences exactly', () => {
  const encounter = {
    ...puzzle.encounter,
    tileEffects: { ...puzzle.encounter.tileEffects, regen: { strike: false, preventResolveLoss: false, regenerate: true } },
    startingTiles: puzzle.encounter.startingTiles.map(tile => tile.letter === 'E'
      ? { ...tile, type: 'gem' as const, gem: 'regen' as const } : tile),
  }
  const initial = createLetterStrikeGame(encounter)
  for (const word of ['THREAD', 'LAD']) {
    const selected = toggleLetterStrikeTile(initial, initial.tiles[0].id)
    const snapshot = captureUndoSnapshot(selected)
    const after = play(initial, word)
    assert.ok(after.playedWords[0].preview.hits.length > 0)
    assert.equal(after.playerResolve, initial.playerResolve - 1)
    if (word === 'THREAD') {
      assert.ok(after.playedWords[0].preview.recoveries!.length > 0)
      assert.equal(after.playedWords[0].preview.longWordModifier, 1)
    }
    if (word === 'LAD') assert.ok(after.playedWords[0].tiles.some(tile => tile.gem === 'strike'))
    assert.deepEqual(restoreUndoSnapshot(snapshot), initial)
    assert.equal(Object.isFrozen(snapshot.enemyLetters), true)
  }
  const adjective = { ...encounter, wordPartsOfSpeech: { ...encounter.wordPartsOfSpeech, SAD: ['adjective'] as const } }
  const adjectiveGame = createLetterStrikeGame(adjective)
  const afterAdjective = play(adjectiveGame, 'SAD')
  assert.equal(afterAdjective.playedWords[0].preview.grammaticalModifier, 1)
  assert.deepEqual(restoreUndoSnapshot(captureUndoSnapshot(adjectiveGame)), adjectiveGame)
})

test('all allowances are durable and cannot be replenished by replaying or reloading a turn', () => {
  for (const mode of ['normal', 'hard', 'hardcore'] as const) {
    const storage = new MemoryStorage()
    let session = begin(storage, mode)
    for (let used = 0; used < undoLimit(mode); used++) {
      session = saveDailyRun(puzzle, play(session.game!, 'JOY'), storage, at, mode, session.revision)
      session = undoDailyRun(puzzle, storage, session.revision)
      assert.equal(session.undosUsed, used + 1)
      session = loadDailySession(puzzle, storage)
    }
    session = saveDailyRun(puzzle, play(session.game!, 'JOY'), storage, at, mode, session.revision)
    assert.equal(session.undosRemaining, 0)
    assert.throws(() => undoDailyRun(puzzle, storage, session.revision), /No undos/)
  }
})

test('multiple undo restores prior move history in stack order and supports a different next word', () => {
  const storage = new MemoryStorage()
  let session = begin(storage)
  const initial = structuredClone(session.game!)
  session = saveDailyRun(puzzle, play(session.game!, 'JOY'), storage, at, 'normal', session.revision)
  const first = structuredClone(session.game!)
  session = saveDailyRun(puzzle, play(session.game!, 'CHEER'), storage, at, 'normal', session.revision)
  session = undoDailyRun(puzzle, storage, session.revision)
  assert.deepEqual(session.game, first)
  session = undoDailyRun(puzzle, storage, session.revision)
  assert.deepEqual(session.game, initial)
  session = saveDailyRun(puzzle, play(session.game!, 'THREAD'), storage, at, 'normal', session.revision)
  assert.deepEqual(session.game!.playedWords.map(turn => turn.word), ['THREAD'])
  assert.deepEqual(loadDailySession(puzzle, storage).game, session.game)
  assert.equal(session.undosUsed, 2)
})

test('revision checks reject stale attacks and undos even after the board returns to an identical state', () => {
  const storage = new MemoryStorage()
  const old = begin(storage)
  const advanced = saveDailyRun(puzzle, play(old.game!, 'JOY'), storage, at, 'normal', old.revision)
  assert.throws(() => undoDailyRun(puzzle, storage, old.revision), /another tab/)
  const undone = undoDailyRun(puzzle, storage, advanced.revision)
  assert.deepEqual(undone.game, old.game)
  assert.throws(() => saveDailyRun(puzzle, play(old.game!, 'JOY'), storage, at, 'normal', old.revision), /another tab/)
  assert.throws(() => undoDailyRun(puzzle, storage, advanced.revision), /another tab/)
  assert.throws(() => saveDailyRun(puzzle, advanced.game!, storage, at, 'normal'), /another tab/)
  assert.equal(loadDailySession(puzzle, storage).undosUsed, 1)
})

test('mode remains fixed after Begin and after undoing the very first move', () => {
  const storage = new MemoryStorage()
  let session = begin(storage, 'hard')
  assert.throws(() => saveDailyRun(puzzle, session.game!, storage, at, 'normal', session.revision), /another mode/)
  session = saveDailyRun(puzzle, play(session.game!, 'JOY'), storage, at, 'hard', session.revision)
  session = undoDailyRun(puzzle, storage, session.revision)
  assert.equal(loadDailySession(puzzle, storage, 'normal').mode, 'hard')
  assert.throws(() => saveDailyRun(puzzle, session.game!, storage, at, 'normal', session.revision), /another mode/)
})

test('a failed undo write leaves the prior board and allowance intact for an explicit retry', () => {
  const storage = new MemoryStorage()
  const started = begin(storage)
  const advanced = saveDailyRun(puzzle, play(started.game!, 'JOY'), storage, at, 'normal', started.revision)
  storage.failWrites = true
  assert.throws(() => undoDailyRun(puzzle, storage, advanced.revision), /quota/)
  assert.equal(loadDailySession(puzzle, storage).undosUsed, 0)
  assert.deepEqual(loadDailySession(puzzle, storage).game, advanced.game)
  storage.failWrites = false
  const restored = undoDailyRun(puzzle, storage, advanced.revision)
  assert.deepEqual(restored.game, started.game)
  assert.equal(restored.undosUsed, 1)
})

test('permanent results record mode, difficulty and used/remaining undo allowance and cannot be undone', () => {
  const storage = new MemoryStorage()
  let session = begin(storage)
  session = saveDailyRun(puzzle, play(session.game!, 'JOY'), storage, at, 'normal', session.revision)
  session = undoDailyRun(puzzle, storage, session.revision)
  const turns = [[0, 1, 2], [4, 5, 15, 18, 16], [11, 20, 9, 10, 14, 17], [8, 21, 22, 27], [24, 30, 33, 26, 25, 19]]
  for (const ids of turns) session = saveDailyRun(puzzle, submitLetterStrike(session.game!, ids), storage, at, 'normal', session.revision)
  assert.equal(session.result!.won, true)
  assert.equal(session.result!.mode, 'normal')
  assert.equal(session.result!.puzzleDifficulty, puzzle.difficulty ?? null)
  assert.equal(session.result!.undosUsed, 1)
  assert.equal(session.result!.undosRemaining, 2)
  assert.equal(session.result!.resolveRemaining, session.game!.playerResolve)
  const raw = storage.getItem(getResultStorageKey(puzzle.puzzleId))
  assert.throws(() => undoDailyRun(puzzle, storage, session.revision), /finalized/)
  assert.equal(storage.getItem(getResultStorageKey(puzzle.puzzleId)), raw)
  assert.deepEqual(loadResults(storage), [session.result])
  const submission = buildDailyScoreSubmission(session.result!)
  assert.equal(submission.undosUsed, 1)
  assert.equal(submission.undosRemaining, 2)
})

test('schema 4 Hard runs and results are migrated read-only with exact outcomes and full undo snapshots', () => {
  for (const terminal of [false, true]) {
    const storage = new MemoryStorage()
    let game = createLetterStrikeGame(puzzle.encounter)
    const turns = [[0, 1, 2], [4, 5, 15, 18, 16], [11, 20, 9, 10, 14, 17], [8, 21, 22, 27], [24, 30, 33, 26, 25, 19]]
    for (const ids of terminal ? turns : turns.slice(0, 2)) game = submitLetterStrike(game, ids)
    saveDailyRun(puzzle, game, storage, at, 'hard')
    const key = terminal ? getResultStorageKey(puzzle.puzzleId) : getRunStorageKey(puzzle.puzzleId)
    const historical = JSON.parse(storage.getItem(key)!)
    historical.saveVersion = 4
    for (const field of terminal ? ['puzzleDifficulty', 'undosUsed', 'undosRemaining'] : ['revision', 'undosUsed', 'undoHistory']) {
      delete (terminal ? historical.result : historical)[field]
    }
    const raw = JSON.stringify(historical)
    storage.setItem(key, raw)
    const loaded = loadDailySession(puzzle, storage, 'hardcore')
    assert.equal(loaded.error, null)
    assert.equal(loaded.mode, 'hard')
    assert.equal(loaded.undosUsed, 0)
    assert.equal(loaded.undosRemaining, 1)
    assert.deepEqual(loaded.game, game)
    assert.equal(storage.getItem(key), raw)
    if (!terminal) {
      assert.equal(loaded.undoHistory.length, 2)
      const undone = undoDailyRun(puzzle, storage, loaded.revision)
      assert.equal(undone.game!.playedWords.length, 1)
      assert.equal(undone.undosRemaining, 0)
    }
  }
})

test('tampered immutable snapshots or invalid allowance metadata block play and preserve saved bytes', () => {
  for (const field of ['snapshot', 'undosUsed', 'revision']) {
    const storage = new MemoryStorage()
    const started = begin(storage)
    saveDailyRun(puzzle, play(started.game!, 'JOY'), storage, at, 'normal', started.revision)
    const key = getRunStorageKey(puzzle.puzzleId)
    const data = JSON.parse(storage.getItem(key)!)
    if (field === 'snapshot') data.undoHistory[0].refillIndex = 99
    else data[field] = -1
    const raw = JSON.stringify(data)
    storage.setItem(key, raw)
    assert.ok(loadDailySession(puzzle, storage).error)
    assert.equal(storage.getItem(key), raw)
  }
})

test('DEV undo count edits respect the mode and preserve full combat state', () => {
  const storage = new MemoryStorage()
  const initial = begin(storage, 'hard')
  const changed = setDailyUndosUsed(puzzle, storage, 1, initial.revision)
  assert.deepEqual(changed.game, initial.game)
  assert.equal(changed.undosRemaining, 0)
  assert.throws(() => setDailyUndosUsed(puzzle, storage, 2, changed.revision), /invalid/)
  const reset = setDailyUndosUsed(puzzle, storage, 0, changed.revision)
  assert.equal(reset.undosRemaining, 1)
  assert.equal(loadDailySession(puzzle, storage).undosUsed, 0)
})

test('REGEN result and future submission retain exact recovery evidence without mutating it', () => {
  const encounter = {
    ...puzzle.encounter, startingResolve: 1,
    tileEffects: { ...puzzle.encounter.tileEffects, regen: { strike: false, preventResolveLoss: false, regenerate: true } },
    startingTiles: puzzle.encounter.startingTiles.map(tile => tile.letter === 'E'
      ? { ...tile, type: 'gem' as const, gem: 'regen' as const } : tile),
  }
  const game = play(createLetterStrikeGame(encounter), 'THREAD')
  const result = buildDailyResult({ ...puzzle, encounter }, game, at)
  assert.ok(result.regenRecoveries! > 0)
  assert.deepEqual(result.turns[0].recoveries, game.playedWords[0].preview.recoveries)
  assert.ok(result.turns[0].specialTiles.some(tile => tile.gem === 'regen'))
  const submission = buildDailyScoreSubmission(result)
  assert.deepEqual(submission.recoveriesByTurn![0], result.turns[0].recoveries)
  submission.recoveriesByTurn![0][0].hitsAfter = 99
  assert.notEqual(game.playedWords[0].preview.recoveries![0].hitsAfter, 99)
})
