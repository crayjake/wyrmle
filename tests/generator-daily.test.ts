import assert from 'node:assert/strict'
import test from 'node:test'
import savedCandidates from '../src/generator/data/melancholy.json' with { type: 'json' }
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { getRunStorageKey, getResultStorageKey, loadDailySession, saveDailyRun } from '../src/daily/persistence.ts'
import { buildDailyResult } from '../src/daily/results.ts'
import { SAVE_VERSION } from '../src/daily/versions.ts'
import type { DailyPuzzleDefinition, DailyRun, StorageLike } from '../src/daily/types.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'

const today = '2026-09-24'
const published = getDailyPuzzle(today)
const archived = getDailyPuzzleForVersion(today, 'letter-strike-1', 1)
const best = savedCandidates[0]

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

function savedRun(puzzle: DailyPuzzleDefinition, game: LetterStrikeState): DailyRun {
  return { saveVersion: SAVE_VERSION, mode: 'hard', puzzleId: puzzle.puzzleId,
    gameVersion: puzzle.gameVersion, puzzleVersion: puzzle.puzzleVersion,
    enemyLetters: game.enemyLetters, playerResolve: game.playerResolve, tiles: game.tiles,
    refillIndex: game.refillIndex, nextTileId: game.nextTileId, playedWords: game.playedWords,
    status: game.status, completedAt: null }
}

test('September 24 publishes the highest-ranked accepted generated encounter as a frozen runtime-only snapshot', () => {
  assert.equal(best.quality.total, 69.53)
  assert.equal(best.validation.accepted, true)
  assert.equal(best.candidate.seed, 'melancholy-review-v1:38:g0:p0:m0')
  assert.ok(savedCandidates.every(candidate => candidate.quality.total <= best.quality.total))
  assert.equal(published.gameVersion, 'letter-strike-4')
  assert.equal(published.puzzleVersion, 5)
  assert.deepEqual(published.encounter, best.candidate.encounter)
  assert.notEqual(published.encounter, best.candidate.encounter)
  assert.ok(Object.isFrozen(published.encounter.startingTiles[0]))
  assert.ok(Object.isFrozen(published.encounter.wordPartsOfSpeech))
  assert.equal('analysis' in published, false)
  assert.equal('winningLines' in published.encounter, false)
  assert.equal('construction' in published.encounter, false)
  assert.equal(getDailyPuzzle('2026-09-23').puzzleVersion, 1)
  assert.equal(getDailyPuzzle('2026-09-25').puzzleVersion, 4)
  assert.equal(archived.encounter.startingTiles.map(tile => tile.letter).join(''), 'JOYCHEERGLOOMADS')
  assert.throws(() => getDailyPuzzleForVersion('2026-09-25', 'letter-strike-4', 5), /unsupported/)
})

test('new Normal and Hard attempts play the same generated daily and can save, win and restore its exact route', () => {
  const normal = loadDailySession(published, new MemoryStorage(), 'normal')
  const hard = loadDailySession(published, new MemoryStorage(), 'hard')
  assert.deepEqual(normal.game, hard.game)
  assert.equal(normal.mode, 'normal')
  assert.equal(hard.mode, 'hard')
  for (const mode of ['normal', 'hard'] as const) {
    const storage = new MemoryStorage()
    let game = createLetterStrikeGame(published.encounter)
    saveDailyRun(published, game, storage, undefined, mode)
    for (const move of best.analysis.winningLines[0].moves) {
      game = submitLetterStrike(game, move.tileIds)
      const saved = saveDailyRun(published, game, storage, '2026-09-24T18:00:00Z', mode)
      assert.equal(saved.error, null)
      const restored = loadDailySession(published, storage)
      assert.deepEqual(restored.game, game)
      assert.equal(restored.mode, mode)
    }
    assert.equal(game.status, 'won')
    const completed = loadDailySession(published, storage)
    assert.equal(completed.result?.puzzleVersion, 5)
    assert.equal(completed.result?.won, true)
  }
})

test('a validated untouched September 24 save upgrades to the new daily without changing its mode or writing during load', () => {
  const storage = new MemoryStorage()
  const raw = JSON.stringify(savedRun(archived, createLetterStrikeGame(archived.encounter)))
  storage.setItem(getRunStorageKey(today), raw)
  const session = loadDailySession(published, storage)
  assert.equal(session.error, null)
  assert.deepEqual(session.game, createLetterStrikeGame(published.encounter))
  assert.equal(session.mode, 'hard')
  assert.equal(storage.getItem(getRunStorageKey(today)), raw)
  saveDailyRun(published, session.game!, storage)
  assert.equal(JSON.parse(storage.getItem(getRunStorageKey(today))!).puzzleVersion, 5)
})

test('started and completed September 24 legacy runs keep their original encounter and result', () => {
  const storage = new MemoryStorage()
  let game = submitLetterStrike(createLetterStrikeGame(archived.encounter), [0, 1, 2])
  storage.setItem(getRunStorageKey(today), JSON.stringify(savedRun(archived, game)))
  const resumed = loadDailySession(published, storage)
  assert.equal(resumed.error, null)
  assert.deepEqual(resumed.game, game)
  game = submitLetterStrike(game, [12, 5, 7, 16, 17])
  saveDailyRun(published, game, storage)
  assert.equal(JSON.parse(storage.getItem(getRunStorageKey(today))!).puzzleVersion, 1)
  // Exact original daily route, still valid under the pinned v1 rule set.
  for (const ids of [[3, 4, 6, 18, 19], [20, 21, 13, 23, 25, 14], [24, 10, 9, 27], [26, 22, 8]]) {
    game = submitLetterStrike(game, ids)
    assert.equal(game.error, null)
  }
  assert.equal(game.status, 'won')
  const result = buildDailyResult(archived, game, '2026-09-24T17:00:00Z', 'hard')
  const raw = JSON.stringify({ saveVersion: SAVE_VERSION, result })
  storage.setItem(getResultStorageKey(today), raw)
  const completed = loadDailySession(published, storage)
  assert.equal(completed.error, null)
  assert.deepEqual(completed.result, result)
  assert.equal(completed.game?.encounter.id, archived.encounter.id)
  assert.equal(storage.getItem(getResultStorageKey(today)), raw)
})
