import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clearDailyHistory, getInProgressPuzzleIds, getOpeningPuzzleId, getResultStorageKey, getRunStorageKey,
  inspectDailyStorage, loadDailySession, loadResults, resetDailyPuzzle, saveDailyRun,
} from '../src/daily/persistence.ts'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { buildDailyResult } from '../src/daily/results.ts'
import { buildShareText } from '../src/daily/share.ts'
import type { DailyPuzzleDefinition, DailyResult, StorageLike } from '../src/daily/types.ts'
import { SAVE_VERSION } from '../src/daily/versions.ts'
import { createLetterStrikeGame as createGame, submitLetterStrike as submitWord, toggleLetterStrikeTile as toggleTile } from '../src/game/letterStrike.ts'
import type { LetterStrikeState as GameState } from '../src/game/letterStrike.ts'

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

const puzzle = getDailyPuzzle('2026-09-23')
const finishedAt = '2026-09-24T12:00:00.000Z'
const currentWinTileIds = [
  [0, 1, 2], [4, 5, 15, 18, 16], [11, 20, 9, 10, 14, 17],
  [8, 21, 22, 27], [24, 30, 33, 26, 25, 19],
]
const selectedDailyWinTileIds = [[0, 14, 6, 7, 2, 15, 13, 10], [8, 17, 1, 12], [21, 16, 27, 18]]

function playTurns(game: GameState, turns: number[][]): GameState {
  for (const ids of turns) {
    game = submitWord(game, ids)
    assert.equal(game.error, null)
  }
  return game
}

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

// Captured v1 field lists deliberately omit all newly introduced grammar and
// per-position metadata. Fixtures are independent of the production adapter.
function legacyRunFixture(game: GameState, completedAt: string | null = null) {
  return {
    saveVersion: 1, puzzleId: puzzle.puzzleId, gameVersion: 'letter-strike-1', puzzleVersion: 1,
    enemyLetters: game.enemyLetters, playerResolve: game.playerResolve, tiles: game.tiles,
    refillIndex: game.refillIndex, nextTileId: game.nextTileId, status: game.status, completedAt,
    playedWords: game.playedWords.map((turn) => ({
      word: turn.word, strikes: turn.strikes, semanticLabel: turn.semanticLabel,
      effectLabels: turn.effectLabels, tiles: turn.tiles,
      preview: {
        word: turn.preview.word, semanticLabel: turn.preview.semanticLabel,
        strikes: turn.preview.strikes, resolveCost: turn.preview.resolveCost,
        effectLabels: turn.preview.effectLabels, enemyLetters: turn.preview.enemyLetters,
        hits: turn.preview.hits, valid: turn.preview.valid, error: turn.preview.error,
      },
    })),
  }
}

function legacyResultFixture(result: DailyResult) {
  return {
    saveVersion: 1,
    result: {
      puzzleId: result.puzzleId, date: result.date, gameVersion: result.gameVersion,
      puzzleVersion: result.puzzleVersion, enemyWord: result.enemyWord, won: result.won,
      startingResolve: result.startingResolve, resolveRemaining: result.resolveRemaining,
      attacks: result.attacks, wordsPlayed: result.wordsPlayed, totalStrikes: result.totalStrikes,
      lettersDestroyed: result.lettersDestroyed, armourBroken: result.armourBroken,
      strongestHit: result.strongestHit, counters: result.counters, resisted: result.resisted,
      neutral: result.neutral, strikeActivations: result.strikeActivations, wardSaves: result.wardSaves,
      turns: result.turns.map((turn) => ({
        strikes: turn.strikes, lettersDestroyed: turn.lettersDestroyed, armourBroken: turn.armourBroken,
        semanticLabel: turn.semanticLabel, tileIds: turn.tileIds, specialTiles: turn.specialTiles,
        strikeActivations: turn.strikeActivations, resolveProtected: turn.resolveProtected,
      })),
      completedAt: result.completedAt,
    },
  }
}

function versionedRunFixture(definition: DailyPuzzleDefinition, game: GameState, completedAt: string | null = null) {
  return {
    saveVersion: 2, puzzleId: definition.puzzleId, gameVersion: definition.gameVersion,
    puzzleVersion: definition.puzzleVersion, enemyLetters: game.enemyLetters,
    playerResolve: game.playerResolve, tiles: game.tiles, refillIndex: game.refillIndex,
    nextTileId: game.nextTileId,
    playedWords: game.playedWords.map((turn) => {
      const preview: Record<string, unknown> = { ...turn.preview }
      delete preview.longWordModifier
      return { ...turn, preview }
    }),
    status: game.status, completedAt,
  }
}

function preModeResultFixture(result: DailyResult) {
  const historical: Record<string, unknown> = { ...result }
  delete historical.mode
  delete historical.puzzleDifficulty
  delete historical.undosUsed
  delete historical.undosRemaining
  return historical
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
  assert.equal('enemyHp' in saved, false)
  assert.deepEqual(saved.enemyLetters, game.enemyLetters)
  assert.equal(saved.enemyLetters[0].hitsRemaining, 2)
  assert.equal(saved.enemyLetters[7].hitsRemaining, 0)
  assert.equal(saved.enemyLetters[9].hitsRemaining, 1)
  assert.equal(saved.refillIndex, 8)
  assert.equal(saved.nextTileId, 24)
  assert.deepEqual(saved.playedWords, game.playedWords)
})

test('wins and losses remain completed after refreshing and reject attempts to replace results', () => {
  for (const outcome of ['won', 'lost']) {
    const storage = new MemoryStorage()
    const game = outcome === 'won'
      ? playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
      : playWords(['SAD', 'CEE', 'EEL', 'AGO', 'ERR'], true)
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
  const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
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
  const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
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
  const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
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
  assert.throws(() => saveDailyRun(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), storage, finishedAt), /quota/)
  assert.deepEqual(loadDailySession(puzzle, storage).game, prior)
  assert.equal(loadResults(storage).length, 0)
})

test('different dates keep independent runs and reset reconstructs only the selected day', () => {
  const storage = new MemoryStorage()
  const other = getDailyPuzzle('2026-09-25')
  const first = playWords(['JOY'])
  const second = playTurns(createGame(other.encounter), selectedDailyWinTileIds.slice(0, 1))
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

test('explicit beta reset removes permanent completion as well as the run', () => {
  const storage = new MemoryStorage()
  saveDailyRun(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), storage, finishedAt)
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

test('replay validation rejects altered enemy letters, armour, tiles, history and result totals', () => {
  for (const field of ['enemyLetters', 'armour', 'tiles', 'playedWords']) {
    const storage = new MemoryStorage()
    saveDailyRun(puzzle, playWords(['JOY']), storage)
    const key = getRunStorageKey(puzzle.puzzleId)
    const run = JSON.parse(storage.getItem(key)!)
    if (field === 'enemyLetters') run.enemyLetters[0].hitsRemaining = 0
    else if (field === 'armour') run.enemyLetters[9].initialHits = 1
    else if (field === 'tiles') run.tiles[0].letter = 'Z'
    else run.playedWords[0].strikes = 999
    storage.setItem(key, JSON.stringify(run))
    assert.equal(loadDailySession(puzzle, storage).game, null)
    assert.match(loadDailySession(puzzle, storage).error!, /does not match/)
  }
  const storage = new MemoryStorage()
  saveDailyRun(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), storage, finishedAt)
  const key = getResultStorageKey(puzzle.puzzleId)
  const envelope = JSON.parse(storage.getItem(key)!)
  envelope.result.totalStrikes = 999
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
  const earlier = getDailyPuzzle('2026-09-22')
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
      ? playTurns(createGame(today.encounter), selectedDailyWinTileIds)
      : createGame(today.encounter)
    saveDailyRun(today, game, storage, '2026-09-25T12:00:00.000Z')
    if (completed) storage.removeItem(getRunStorageKey(today.puzzleId))
    assert.equal(getOpeningPuzzleId(today.puzzleId, storage), today.puzzleId)
  }
})

test('opening selects today when earlier dates are complete or absent and ignores future DEV saves', () => {
  const storage = new MemoryStorage()
  assert.equal(getOpeningPuzzleId('2026-09-25', storage), '2026-09-25')
  saveDailyRun(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), storage, finishedAt)
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
      saveDailyRun(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), storage, finishedAt)
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

test('legacy damage runs and results are ignored and preserved through letter-strike save, reset and clear', () => {
  const storage = new MemoryStorage()
  const legacy = {
    'wyrmle:daily:run:2026-09-22': '{old damaged numeric run',
    'wyrmle:daily:result:2026-09-23': JSON.stringify({ gameVersion: '1', totalDamage: 33, won: true }),
    'wyrmle:daily:v1:run:2026-09-23': JSON.stringify({ enemyHp: 33 }),
    'wyrmle:daily:v1:result:2026-09-23': '{old numeric result',
  }
  for (const [key, value] of Object.entries(legacy)) storage.setItem(key, value)
  assert.equal(getOpeningPuzzleId(puzzle.puzzleId, storage), puzzle.puzzleId)
  assert.equal(loadDailySession(puzzle, storage).resumed, false)
  assert.deepEqual(loadResults(storage), [])
  assert.deepEqual(getInProgressPuzzleIds(storage), [])
  assert.deepEqual(inspectDailyStorage(storage), {})
  saveDailyRun(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), storage, finishedAt)
  assert.equal(loadResults(storage).length, 1)
  resetDailyPuzzle(puzzle.puzzleId, storage)
  saveDailyRun(puzzle, playWords(['JOY']), storage)
  clearDailyHistory(storage)
  assert.equal(storage.length, Object.keys(legacy).length)
  for (const [key, value] of Object.entries(legacy)) assert.equal(storage.getItem(key), value)
})

test('original v1 active snapshots restore unchanged outcomes and enrich metadata without rewriting on read', () => {
  const storage = new MemoryStorage()
  const expected = playWords(['SAD'])
  const fixture = legacyRunFixture(expected)
  assert.equal('letterOutcomes' in fixture.playedWords[0].preview, false)
  assert.equal('grammaticalModifier' in fixture.playedWords[0].preview, false)
  const raw = JSON.stringify(fixture)
  const key = getRunStorageKey(puzzle.puzzleId)
  storage.setItem(key, raw)
  const restored = loadDailySession(puzzle, storage)
  assert.equal(restored.error, null)
  assert.deepEqual(restored.game, expected)
  assert.equal(restored.game!.playedWords[0].strikes, 0)
  assert.equal(restored.game!.playedWords[0].preview.grammaticalModifier, 0)
  assert.equal(restored.game!.playedWords[0].preview.letterOutcomes.length, 10)
  assert.equal(storage.getItem(key), raw)
  const advanced = playWords(['CEE'], true, restored.game!)
  saveDailyRun(puzzle, advanced, storage)
  assert.equal(JSON.parse(storage.getItem(key)!).saveVersion, SAVE_VERSION)
  assert.deepEqual(loadDailySession(puzzle, storage).game, advanced)
})

test('original v1 completed records gain positional sharing while preserving first completion and original bytes', () => {
  for (const won of [true, false]) {
    const storage = new MemoryStorage()
    const game = won ? playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
      : playWords(['SAD', 'CEE', 'EEL', 'AGO', 'ERR'], true)
    const expected = buildDailyResult(puzzle, game, finishedAt)
    const fixture = legacyResultFixture(expected)
    assert.equal('enemyLetterCount' in fixture.result, false)
    assert.equal('largestRemoval' in fixture.result, false)
    assert.equal('letterOutcomes' in fixture.result.turns[0], false)
    const raw = JSON.stringify(fixture)
    const key = getResultStorageKey(puzzle.puzzleId)
    storage.setItem(key, raw)
    storage.setItem(getRunStorageKey(puzzle.puzzleId), JSON.stringify(legacyRunFixture(playWords(['JOY']))))
    const restored = loadDailySession(puzzle, storage)
    assert.equal(restored.error, null)
    assert.deepEqual(restored.game, game)
    assert.deepEqual(restored.result, expected)
    assert.equal(buildShareText(restored.result!), buildShareText(expected))
    assert.deepEqual(loadResults(storage), [expected])
    assert.equal(saveDailyRun(puzzle, createGame(puzzle.encounter), storage, '2026-09-25T15:00:00Z').result!.completedAt, finishedAt)
    assert.equal(storage.getItem(key), raw)
  }
})

test('terminal legacy run can repair a missing result using enriched outcomes and the original finish time', () => {
  const storage = new MemoryStorage()
  const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
  const raw = JSON.stringify(legacyRunFixture(game, finishedAt))
  storage.setItem(getRunStorageKey(puzzle.puzzleId), raw)
  assert.equal(loadDailySession(puzzle, storage).result?.completedAt, finishedAt)
  saveDailyRun(puzzle, createGame(puzzle.encounter), storage)
  const saved = JSON.parse(storage.getItem(getResultStorageKey(puzzle.puzzleId))!)
  assert.equal(saved.saveVersion, SAVE_VERSION)
  assert.equal(saved.result.completedAt, finishedAt)
  assert.equal(saved.result.turns[0].letterOutcomes.length, 10)
  assert.equal(storage.getItem(getRunStorageKey(puzzle.puzzleId)), raw)
})

test('legacy adapters reject altered original evidence, omitted fields and injected new metadata', () => {
  for (const corruption of ['strikes', 'armour', 'missing', 'injected']) {
    const storage = new MemoryStorage()
    const fixture = JSON.parse(JSON.stringify(legacyRunFixture(playWords(['JOY']))))
    if (corruption === 'strikes') fixture.playedWords[0].preview.strikes += 1
    if (corruption === 'armour') fixture.enemyLetters[9].hitsRemaining = 0
    if (corruption === 'missing') delete fixture.playedWords[0].preview.hits
    if (corruption === 'injected') fixture.playedWords[0].preview.letterOutcomes = []
    const raw = JSON.stringify(fixture)
    const key = getRunStorageKey(puzzle.puzzleId)
    storage.setItem(key, raw)
    assert.match(loadDailySession(puzzle, storage).error!, /does not match/)
    assert.equal(storage.getItem(key), raw)
  }
  for (const corruption of ['total', 'missing', 'injected']) {
    const storage = new MemoryStorage()
    const completed = buildDailyResult(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), finishedAt)
    const fixture = JSON.parse(JSON.stringify(legacyResultFixture(completed)))
    if (corruption === 'total') fixture.result.totalStrikes += 1
    if (corruption === 'missing') delete fixture.result.turns[0].specialTiles
    if (corruption === 'injected') fixture.result.turns[0].letterOutcomes = []
    const raw = JSON.stringify(fixture)
    const key = getResultStorageKey(puzzle.puzzleId)
    storage.setItem(key, raw)
    assert.match(loadDailySession(puzzle, storage).error!, /does not match/)
    assert.equal(storage.getItem(key), raw)
  }
})

test('new-schema per-position outcomes are validated for both snapshots and permanent results', () => {
  for (const kind of ['run', 'result']) {
    const storage = new MemoryStorage()
    const game = kind === 'run' ? playWords(['JOY']) : playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
    saveDailyRun(puzzle, game, storage, finishedAt)
    const key = kind === 'run' ? getRunStorageKey(puzzle.puzzleId) : getResultStorageKey(puzzle.puzzleId)
    const saved = JSON.parse(storage.getItem(key)!)
    const outcomes = kind === 'run' ? saved.playedWords[0].preview.letterOutcomes : saved.result.turns[0].letterOutcomes
    outcomes[9].removed = true
    storage.setItem(key, JSON.stringify(saved))
    assert.match(loadDailySession(puzzle, storage).error!, /does not match/)
  }
})

test('grammar-enabled current days restore their rules and do not reinterpret future-date v1 DEV saves', () => {
  const storage = new MemoryStorage()
  const nextDay = getDailyPuzzle('2026-09-25')
  const game = playWords(['GLAD'], false, createGame(nextDay.encounter))
  assert.equal(game.playedWords[0].preview.grammaticalModifier, 1)
  assert.equal(game.playedWords[0].strikes, 2)
  saveDailyRun(nextDay, game, storage)
  assert.deepEqual(loadDailySession(nextDay, storage).game, game)
  const oldDev = { ...legacyRunFixture(playWords(['SAD'])), puzzleId: nextDay.puzzleId }
  const raw = JSON.stringify(oldDev)
  storage.setItem(getRunStorageKey(nextDay.puzzleId), raw)
  assert.match(loadDailySession(nextDay, storage).error!, /unsupported.*2026-09-25/)
  assert.equal(storage.getItem(getRunStorageKey(nextDay.puzzleId)), raw)
})

test('committed v2 runs replay and continue on overlap rules while callers hold the latest puzzle', () => {
  const storage = new MemoryStorage()
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-2', 2)
  const original = playWords(['JOY'], false, createGame(archived.encounter))
  const raw = JSON.stringify(versionedRunFixture(archived, original))
  const key = getRunStorageKey(latest.puzzleId)
  storage.setItem(key, raw)
  const restored = loadDailySession(latest, storage)
  assert.equal(restored.error, null)
  assert.deepEqual(restored.game, original)
  assert.equal(storage.getItem(key), raw)
  const advanced = playWords(['LAD'], false, restored.game!)
  assert.equal(advanced.playedWords.at(-1)!.strikes, 1)
  saveDailyRun(latest, advanced, storage)
  assert.equal(JSON.parse(storage.getItem(key)!).gameVersion, 'letter-strike-2')
  assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 2)
  assert.deepEqual(loadDailySession(latest, storage).game, advanced)
  assert.throws(() => saveDailyRun(latest, playTurns(createGame(latest.encounter), selectedDailyWinTileIds.slice(0, 1)), storage), /different encounter/)
})

test('v2 wins and losses remain authoritative with unchanged sharing and first completion bytes', () => {
  for (const won of [true, false]) {
    const storage = new MemoryStorage()
    const latest = getDailyPuzzle('2026-09-25')
    const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-2', 2)
    const words = won ? ['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'] : ['SAD', 'CEE', 'EEL', 'AGO', 'ERR']
    const game = playWords(words, !won, createGame(archived.encounter))
    assert.equal(game.status, won ? 'won' : 'lost')
    const finish = '2026-09-25T10:00:00.000Z'
    const expected = buildDailyResult(archived, game, finish)
    const raw = JSON.stringify({ saveVersion: 2, result: preModeResultFixture(expected) })
    const key = getResultStorageKey(latest.puzzleId)
    storage.setItem(key, raw)
    const restored = loadDailySession(latest, storage)
    assert.equal(restored.error, null)
    assert.deepEqual(restored.result, expected)
    assert.equal(buildShareText(restored.result!), buildShareText(expected))
    assert.deepEqual(loadResults(storage), [expected])
    assert.equal(saveDailyRun(latest, createGame(latest.encounter), storage).result!.completedAt, finish)
    assert.equal(storage.getItem(key), raw)
  }
})

test('an unfinished v2 attempt can complete under its pinned version and restore through the latest definition', () => {
  const storage = new MemoryStorage()
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-2', 2)
  const partial = playWords(['JOY'], false, createGame(archived.encounter))
  storage.setItem(getRunStorageKey(latest.puzzleId), JSON.stringify(versionedRunFixture(archived, partial)))
  const game = playWords(['MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'], false, loadDailySession(latest, storage).game!)
  const saved = saveDailyRun(latest, game, storage, '2026-09-25T10:00:00.000Z')
  assert.equal(saved.result!.gameVersion, 'letter-strike-2')
  assert.equal(saved.result!.won, true)
  assert.deepEqual(loadDailySession(latest, storage).result, saved.result)
})

test('validated zero-turn v2 snapshots upgrade in memory and commit current rules without clearing storage first', () => {
  const storage = new MemoryStorage()
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-2', 2)
  const raw = JSON.stringify(versionedRunFixture(archived, createGame(archived.encounter)))
  const key = getRunStorageKey(latest.puzzleId)
  storage.setItem(key, raw)
  const restored = loadDailySession(latest, storage)
  assert.equal(restored.error, null)
  assert.equal(restored.resumed, true)
  assert.deepEqual(restored.game, createGame(latest.encounter))
  assert.equal(storage.getItem(key), raw)
  const firstMove = playTurns(restored.game!, selectedDailyWinTileIds.slice(0, 1))
  assert.equal(firstMove.playedWords[0].strikes, 3)
  saveDailyRun(latest, firstMove, storage)
  assert.equal(JSON.parse(storage.getItem(key)!).gameVersion, latest.gameVersion)
  assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, latest.puzzleVersion)
  assert.deepEqual(loadDailySession(latest, storage).game, firstMove)
})

test('rule pinning and zero-turn upgrades never bypass snapshot or version-pair validation', () => {
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-2', 2)
  for (const corruption of ['zero-turn-state', 'rule-relabel', 'version-pair']) {
    const storage = new MemoryStorage()
    const game = corruption === 'zero-turn-state' ? createGame(archived.encounter)
      : playWords(['LAD'], false, createGame(archived.encounter))
    const fixture = versionedRunFixture(archived, game)
    if (corruption === 'zero-turn-state') fixture.playerResolve -= 1
    if (corruption === 'rule-relabel') {
      fixture.gameVersion = 'letter-strike-3'
      fixture.puzzleVersion = 3
    }
    if (corruption === 'version-pair') fixture.puzzleVersion = 3
    const raw = JSON.stringify(fixture)
    const key = getRunStorageKey(latest.puzzleId)
    storage.setItem(key, raw)
    assert.equal(loadDailySession(latest, storage).game, null)
    assert.ok(loadDailySession(latest, storage).error)
    assert.throws(() => saveDailyRun(latest, createGame(latest.encounter), storage))
    assert.equal(storage.getItem(key), raw)
  }
})

test('pre-LONG v3 snapshots restore and continue without enabling LONG or rewriting their original bytes', () => {
  const storage = new MemoryStorage()
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-3', 3)
  const original = playWords(['GLOOMS'], false, createGame(archived.encounter))
  assert.equal(original.playedWords[0].preview.longWordModifier, 0)
  assert.equal(original.playedWords[0].strikes, 2)
  const fixture = versionedRunFixture(archived, original)
  assert.equal('longWordModifier' in fixture.playedWords[0].preview, false)
  const raw = JSON.stringify(fixture)
  const key = getRunStorageKey(latest.puzzleId)
  storage.setItem(key, raw)
  const restored = loadDailySession(latest, storage)
  assert.equal(restored.error, null)
  assert.deepEqual(restored.game, original)
  assert.equal(storage.getItem(key), raw)
  const next = playWords(['CHEER'], false, restored.game!)
  saveDailyRun(latest, next, storage)
  const written = JSON.parse(storage.getItem(key)!)
  assert.equal(written.saveVersion, SAVE_VERSION)
  assert.equal(written.gameVersion, 'letter-strike-3')
  assert.equal(written.playedWords[0].preview.longWordModifier, 0)
  assert.deepEqual(loadDailySession(latest, storage).game, next)
})

test('schema-2 v1 snapshots also normalize their absent LONG field without changing archived rules', () => {
  const storage = new MemoryStorage()
  const game = playWords(['GLOOM'])
  const raw = JSON.stringify(versionedRunFixture(puzzle, game))
  const key = getRunStorageKey(puzzle.puzzleId)
  storage.setItem(key, raw)
  const restored = loadDailySession(puzzle, storage)
  assert.equal(restored.error, null)
  assert.deepEqual(restored.game, game)
  assert.equal(restored.game!.playedWords[0].preview.longWordModifier, 0)
  assert.equal(storage.getItem(key), raw)
})

test('untouched v3 snapshots adopt the scheduled Revive board and LONG rule without a read-time write', () => {
  const storage = new MemoryStorage()
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-3', 3)
  const raw = JSON.stringify(versionedRunFixture(archived, createGame(archived.encounter)))
  const key = getRunStorageKey(latest.puzzleId)
  storage.setItem(key, raw)
  const restored = loadDailySession(latest, storage)
  assert.equal(restored.error, null)
  assert.deepEqual(restored.game, createGame(latest.encounter))
  assert.deepEqual(restored.game!.tiles, latest.encounter.startingTiles)
  assert.equal(restored.game!.tiles[6].gem, 'strike')
  assert.equal(restored.game!.tiles[7].gem, 'ward')
  assert.equal(restored.game!.tiles[11].gem, 'regen')
  assert.equal(restored.game!.encounter.longWordRule?.minimumLength, 7)
  assert.equal(storage.getItem(key), raw)
})

test('pre-LONG v3 completions keep their result, share and finish timestamp under latest daily rules', () => {
  const storage = new MemoryStorage()
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-3', 3)
  const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'], false, createGame(archived.encounter))
  const expected = buildDailyResult(archived, game, '2026-09-25T09:00:00.000Z')
  const raw = JSON.stringify({ saveVersion: 2, result: preModeResultFixture(expected) })
  const key = getResultStorageKey(latest.puzzleId)
  storage.setItem(key, raw)
  const restored = loadDailySession(latest, storage)
  assert.deepEqual(restored.result, expected)
  assert.equal(buildShareText(restored.result!), buildShareText(expected))
  assert.equal(storage.getItem(key), raw)
  assert.deepEqual(saveDailyRun(latest, createGame(latest.encounter), storage).result, expected)
})

test('pre-LONG adapters reject injected modifiers and current saves require their real LONG evidence', () => {
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-3', 3)
  const key = getRunStorageKey(latest.puzzleId)
  const storage = new MemoryStorage()
  const fixture = versionedRunFixture(archived, playWords(['GLOOMS'], false, createGame(archived.encounter)))
  fixture.playedWords[0].preview.longWordModifier = 1
  const original = JSON.stringify(fixture)
  storage.setItem(key, original)
  assert.match(loadDailySession(latest, storage).error!, /does not match/)
  assert.equal(storage.getItem(key), original)
  storage.removeItem(key)
  saveDailyRun(latest, playTurns(createGame(latest.encounter), selectedDailyWinTileIds.slice(0, 1)), storage)
  for (const corruption of ['missing', 'altered', 'schema']) {
    const raw = storage.getItem(key)!
    const data = JSON.parse(raw)
    if (corruption === 'missing') delete data.playedWords[0].preview.longWordModifier
    if (corruption === 'altered') data.playedWords[0].preview.longWordModifier = 99
    if (corruption === 'schema') data.saveVersion = 2
    storage.setItem(key, JSON.stringify(data))
    assert.equal(loadDailySession(latest, storage).game, null)
    storage.setItem(key, raw)
  }
})

test('v4 authored win and loss routes persist exact LONG, special and positional outcomes', () => {
  const definition = getDailyPuzzle('2026-09-26')
  for (const won of [true, false]) {
    const storage = new MemoryStorage()
    const turns = won ? currentWinTileIds : [[13, 4, 6], [14, 18, 8], [20, 16, 7], [22, 19, 12], [0, 25, 3]]
    const game = playTurns(createGame(definition.encounter), turns)
    assert.equal(game.status, won ? 'won' : 'lost')
    assert.equal(game.playerResolve, won ? 1 : 0)
    if (won) {
      assert.deepEqual(game.playedWords.map((move) => move.word), ['JOY', 'CHEER', 'MELODY', 'GLAD', 'MOANER'])
      assert.deepEqual(game.playedWords.map((move) => move.preview.longWordModifier), [0, 0, 1, 0, 1])
    }
    const completed = saveDailyRun(definition, game, storage, '2026-09-25T12:00:00.000Z')
    assert.equal(completed.result!.gameVersion, 'letter-strike-4')
    assert.equal(completed.result!.won, won)
    assert.deepEqual(loadDailySession(definition, storage).game, game)
    assert.deepEqual(loadDailySession(definition, storage).result, completed.result)
    assert.equal(buildShareText(loadDailySession(definition, storage).result!), buildShareText(completed.result!))
  }
})

test('Normal, Hard and Hardcore share the exact puzzle, engine transitions, and result evidence', () => {
  const definition = getDailyPuzzle('2026-09-25')
  const sessions = (['normal', 'hard', 'hardcore'] as const).map((mode) => {
    const storage = new MemoryStorage()
    let session = loadDailySession(definition, storage, mode)
    assert.equal(session.mode, mode)
    assert.equal(session.started, false)
    assert.equal(storage.length, 0)
    session = saveDailyRun(definition, session.game!, storage, finishedAt, mode)
    assert.equal(session.started, true)
    for (const ids of selectedDailyWinTileIds) {
      session = saveDailyRun(definition, submitWord(session.game!, ids), storage, finishedAt, mode)
    }
    assert.equal(session.result!.mode, mode)
    assert.equal(loadDailySession(definition, storage, mode === 'normal' ? 'hard' : 'normal').mode, mode)
    return session
  })
  assert.deepEqual(sessions[0].game, sessions[1].game)
  assert.deepEqual({ ...sessions[0].result, mode: 'hard', undosRemaining: 1 }, sessions[1].result)
  assert.deepEqual(sessions[0].game, sessions[2].game)
  assert.deepEqual({ ...sessions[0].result, mode: 'hardcore', undosRemaining: 0 }, sessions[2].result)
})

test('Begin locks mode at zero turns, and stale tabs cannot silently switch an active Daily', () => {
  const storage = new MemoryStorage()
  const initial = createGame(puzzle.encounter)
  saveDailyRun(puzzle, initial, storage, finishedAt, 'hard')
  const raw = storage.getItem(getRunStorageKey(puzzle.puzzleId))!
  const reloaded = loadDailySession(puzzle, storage, 'normal')
  assert.equal(reloaded.mode, 'hard')
  assert.equal(reloaded.started, true)
  assert.equal(reloaded.game!.playedWords.length, 0)
  assert.deepEqual(reloaded.game, initial)
  assert.throws(() => saveDailyRun(puzzle, initial, storage, finishedAt, 'normal'), /already begun in another mode/)
  assert.equal(storage.getItem(getRunStorageKey(puzzle.puzzleId)), raw)
  const advanced = playWords(['JOY'])
  const saved = saveDailyRun(puzzle, advanced, storage)
  assert.equal(saved.mode, 'hard', 'legacy callers without a mode must preserve the locked choice')
  assert.equal(loadDailySession(puzzle, storage, 'normal').mode, 'hard')
})

test('historical Begin snapshots default to Normal even when the preference is Hard', () => {
  const latest = getDailyPuzzle('2026-09-25')
  const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-3', 3)
  for (const [definition, fixture] of [
    [puzzle, legacyRunFixture(createGame(puzzle.encounter))],
    [latest, versionedRunFixture(archived, createGame(archived.encounter))],
  ] as const) {
    const storage = new MemoryStorage()
    const raw = JSON.stringify(fixture)
    const key = getRunStorageKey(definition.puzzleId)
    storage.setItem(key, raw)
    const session = loadDailySession(definition, storage, 'hard')
    assert.equal(session.error, null)
    assert.equal(session.mode, 'normal')
    assert.equal(session.started, true)
    assert.equal(storage.getItem(key), raw)
  }
})

test('schema 3 runs and results gain Normal metadata read-only and reject injected difficulty', () => {
  const definition = getDailyPuzzle('2026-09-26')
  for (const completed of [false, true]) {
    const storage = new MemoryStorage()
    const game = playTurns(createGame(definition.encounter), completed ? currentWinTileIds : currentWinTileIds.slice(0, 1))
    saveDailyRun(definition, game, storage, finishedAt)
    const key = completed ? getResultStorageKey(definition.puzzleId) : getRunStorageKey(definition.puzzleId)
    const fixture = JSON.parse(storage.getItem(key)!)
    fixture.saveVersion = 3
    delete (completed ? fixture.result : fixture).mode
    for (const field of completed ? ['puzzleDifficulty', 'undosUsed', 'undosRemaining'] : ['revision', 'undosUsed', 'undoHistory']) {
      delete (completed ? fixture.result : fixture)[field]
    }
    const raw = JSON.stringify(fixture)
    storage.setItem(key, raw)
    const session = loadDailySession(definition, storage, 'hard')
    assert.equal(session.error, null)
    assert.equal(session.mode, 'normal')
    assert.deepEqual(session.game, game)
    if (completed) assert.equal(session.result!.mode, 'normal')
    assert.equal(storage.getItem(key), raw)
    ;(completed ? fixture.result : fixture).mode = 'hard'
    storage.setItem(key, JSON.stringify(fixture))
    assert.match(loadDailySession(definition, storage).error!, /does not match/)
  }
})

test('current runs and results require valid mode metadata without rewriting damaged saves', () => {
  for (const completed of [false, true]) {
    for (const mode of [undefined, 'expert', null, false]) {
      const storage = new MemoryStorage()
      const game = completed ? playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']) : playWords(['JOY'])
      saveDailyRun(puzzle, game, storage, finishedAt, 'hard')
      const key = completed ? getResultStorageKey(puzzle.puzzleId) : getRunStorageKey(puzzle.puzzleId)
      const fixture = JSON.parse(storage.getItem(key)!)
      ;(completed ? fixture.result : fixture).mode = mode
      const raw = JSON.stringify(fixture)
      storage.setItem(key, raw)
      assert.match(loadDailySession(puzzle, storage).error!, /difficulty mode is invalid/)
      assert.equal(storage.getItem(key), raw)
    }
  }
})

test('a Hard result remains authoritative through a failed run write and stale Normal completion', () => {
  const storage = new MemoryStorage()
  saveDailyRun(puzzle, playWords(['JOY']), storage, finishedAt, 'hard')
  storage.failKey = getRunStorageKey(puzzle.puzzleId)
  const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
  assert.throws(() => saveDailyRun(puzzle, game, storage, finishedAt, 'hard'), /quota/)
  const raw = storage.getItem(getResultStorageKey(puzzle.puzzleId))!
  const restored = loadDailySession(puzzle, storage, 'normal')
  assert.equal(restored.mode, 'hard')
  assert.equal(restored.result!.mode, 'hard')
  assert.equal(saveDailyRun(puzzle, game, storage, '2026-09-25T12:00:00Z', 'normal').result!.mode, 'hard')
  assert.equal(storage.getItem(getResultStorageKey(puzzle.puzzleId)), raw)
})

test('repairing a missing Hard result retains its mode and original timestamp', () => {
  const storage = new MemoryStorage()
  const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
  saveDailyRun(puzzle, game, storage, finishedAt, 'hard')
  storage.removeItem(getResultStorageKey(puzzle.puzzleId))
  const loaded = loadDailySession(puzzle, storage, 'normal')
  assert.equal(loaded.result!.mode, 'hard')
  saveDailyRun(puzzle, game, storage, '2026-09-25T12:00:00Z')
  const recovered = loadResults(storage)[0]
  assert.equal(recovered.mode, 'hard')
  assert.equal(recovered.completedAt, finishedAt)
})

test('completed schema 5 results preserve their historical difficulty through later calibration changes', () => {
  for (const historicalDifficulty of ['EASY', 'MEDIUM', 'HARD', 'EXPERT', null]) {
    const storage = new MemoryStorage()
    const game = playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
    const completed = saveDailyRun(puzzle, game, storage, finishedAt, 'hard')
    const key = getResultStorageKey(puzzle.puzzleId)
    const envelope = JSON.parse(storage.getItem(key)!)
    envelope.result.puzzleDifficulty = historicalDifficulty
    const raw = JSON.stringify(envelope)
    storage.setItem(key, raw)
    const loaded = loadDailySession(puzzle, storage)
    assert.equal(loaded.error, null)
    assert.deepEqual(loaded.result, { ...completed.result, puzzleDifficulty: historicalDifficulty })
    assert.deepEqual(loaded.game, game)
    assert.equal(loadResults(storage)[0].puzzleDifficulty, historicalDifficulty)
    assert.equal(storage.getItem(key), raw, 'loading must not rewrite the permanent historical rating')
    assert.equal(saveDailyRun(puzzle, game, storage, '2026-09-26T00:00:00Z').result!.puzzleDifficulty, historicalDifficulty)
    assert.equal(storage.getItem(key), raw, 'a stale completion must not recalibrate the historical rating')
  }
})

test('schema 5 results reject malformed historical difficulty labels without rewriting saved data', () => {
  for (const invalid of [undefined, 'IMPOSSIBLE', 'hard', false, 4, {}]) {
    const storage = new MemoryStorage()
    saveDailyRun(puzzle, playWords(['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']), storage, finishedAt)
    const key = getResultStorageKey(puzzle.puzzleId)
    const envelope = JSON.parse(storage.getItem(key)!)
    envelope.result.puzzleDifficulty = invalid
    const raw = JSON.stringify(envelope)
    storage.setItem(key, raw)
    const session = loadDailySession(puzzle, storage)
    assert.equal(session.game, null)
    assert.match(session.error!, /puzzle difficulty is invalid/)
    assert.equal(storage.getItem(key), raw)
  }
})
