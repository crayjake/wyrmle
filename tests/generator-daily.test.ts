import assert from 'node:assert/strict'
import test from 'node:test'
import savedCandidates from '../src/generator/data/melancholy.json' with { type: 'json' }
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { getRunStorageKey, getResultStorageKey, loadDailySession, saveDailyRun } from '../src/daily/persistence.ts'
import { buildDailyResult } from '../src/daily/results.ts'
import { withCurrentLexicalRules } from '../src/game/lexicalRules.ts'
import { SAVE_VERSION } from '../src/daily/versions.ts'
import type { DailyPuzzleDefinition, DailyRun, StorageLike } from '../src/daily/types.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { createCandidate } from '../src/generator/generate.ts'
import { getDailyPuzzleId } from '../src/daily/date.ts'

const today = '2026-09-24'
const tomorrow = '2026-09-25'
const currentToday = getDailyPuzzle(today)
const published = getDailyPuzzleForVersion(tomorrow, 'letter-strike-5', 7)
const archived = getDailyPuzzleForVersion(today, 'letter-strike-1', 1)
const archivedMelancholy = getDailyPuzzleForVersion(today, 'letter-strike-4', 5)
const archivedDespair = getDailyPuzzleForVersion(today, 'letter-strike-4', 6)
const archivedTomorrow = getDailyPuzzleForVersion(tomorrow, 'letter-strike-4', 4)
const best = savedCandidates[0]
const quickRoute = [
  { word: 'WINTER', tileIds: [1, 14, 9, 13, 15, 7], resolve: 4 },
  { word: 'HOPE', tileIds: [18, 11, 20, 21], resolve: 4 },
  { word: 'SCARED', tileIds: [5, 25, 0, 10, 22, 4], resolve: 3 },
]
const clutchRoute = [
  { word: 'ORDER', tileIds: [11, 7, 4, 15, 10], resolve: 5 },
  { word: 'HAPPY', tileIds: [18, 0, 16, 20, 3], resolve: 4 },
  { word: 'CHEER', tileIds: [25, 24, 21, 22, 23], resolve: 3 },
  { word: 'DOG', tileIds: [6, 8, 27], resolve: 2 },
  { word: 'CONFIDENT', tileIds: [31, 26, 9, 2, 14, 28, 33, 32, 13], resolve: 1 },
  { word: 'OPTIMISM', tileIds: [36, 41, 38, 37, 34, 42, 5, 35], resolve: 0 },
]

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

function savedRun(puzzle: DailyPuzzleDefinition, game: LetterStrikeState): Omit<DailyRun, 'revision' | 'undosUsed' | 'undoHistory'> {
  return { saveVersion: 4, mode: 'hard', puzzleId: puzzle.puzzleId,
    gameVersion: puzzle.gameVersion, puzzleVersion: puzzle.puzzleVersion,
    enemyLetters: game.enemyLetters, playerResolve: game.playerResolve, tiles: game.tiles,
    refillIndex: game.refillIndex, nextTileId: game.nextTileId, playedWords: game.playedWords,
    status: game.status, completedAt: null }
}

test('Historical September 25 v7 retains the exact selected DESPAIR encounter as a frozen runtime-only snapshot', () => {
  const selected = createCandidate('DESPAIR', 'enemy-variety-v1:DESPAIR:5', { lexicalMode: 'legacy' })
  const expected = withCurrentLexicalRules(selected.encounter)
  expected.id = 'daily-despair-lexical-v7'
  assert.equal(published.gameVersion, 'letter-strike-5')
  assert.equal(published.puzzleVersion, 7)
  assert.equal(published.encounter.enemy.word, 'DESPAIR')
  assert.deepEqual(published.encounter, expected)
  assert.notEqual(published.encounter, selected.encounter)
  assert.ok(Object.isFrozen(published.encounter.startingTiles[0]))
  assert.ok(Object.isFrozen(published.encounter.wordPartsOfSpeech))
  assert.equal('analysis' in published, false)
  assert.equal('winningLines' in published.encounter, false)
  assert.equal('construction' in published.encounter, false)
  assert.equal(getDailyPuzzle('2026-09-23').puzzleVersion, 1)
  assert.equal(getDailyPuzzle('2026-09-26').puzzleVersion, 4)
  assert.equal(published.difficulty, 'MEDIUM')
  assert.deepEqual(published.encounter.startingTiles, archivedDespair.encounter.startingTiles)
  assert.equal(published.encounter.refillQueue, archivedDespair.encounter.refillQueue)
  assert.equal(archived.encounter.startingTiles.map(tile => tile.letter).join(''), 'JOYCHEERGLOOMADS')
  for (const date of ['2026-09-23', '2026-09-26']) {
    for (const version of [5, 6]) assert.throws(() => getDailyPuzzleForVersion(date, 'letter-strike-4', version), /unsupported/)
  }
  assert.throws(() => getDailyPuzzleForVersion(tomorrow, 'letter-strike-4', 5), /unsupported/)
})

test('September 24 and historical September 25 v7 share exact DESPAIR while the earlier MELANCHOLY snapshot stays available', () => {
  assert.equal(best.quality.total, 69.53)
  assert.equal(best.validation.accepted, true)
  assert.equal(best.candidate.seed, 'melancholy-review-v1:38:g0:p0:m0')
  assert.ok(savedCandidates.every(candidate => candidate.quality.total <= best.quality.total))
  assert.deepEqual(archivedMelancholy.encounter, best.candidate.encounter)
  assert.notEqual(archivedMelancholy.encounter, best.candidate.encounter)
  assert.ok(Object.isFrozen(archivedMelancholy.encounter.startingTiles[0]))
  assert.ok(Object.isFrozen(archivedMelancholy.encounter.wordPartsOfSpeech))
  assert.equal(currentToday.puzzleVersion, 7)
  assert.deepEqual(currentToday.encounter.startingTiles, archivedDespair.encounter.startingTiles)
  assert.deepEqual(currentToday.encounter, published.encounter)
  assert.equal(currentToday.difficulty, published.difficulty)
  assert.equal(getDailyPuzzle(getDailyPuzzleId(new Date('2026-09-24T23:59:59.999Z'))).puzzleVersion, 7)
  assert.equal(getDailyPuzzle(getDailyPuzzleId(new Date('2026-09-25T00:30:00+01:00'))).puzzleVersion, 7)
  assert.equal(getDailyPuzzle(getDailyPuzzleId(new Date('2026-09-25T00:00:00.000Z'))).puzzleVersion, 10)
  assert.equal(loadDailySession(currentToday, new MemoryStorage()).game?.encounter.id, published.encounter.id)
})

test('Normal and Hard attempts begun on v7 can save, win and restore their historical route', () => {
  const normal = loadDailySession(published, new MemoryStorage(), 'normal')
  const hard = loadDailySession(published, new MemoryStorage(), 'hard')
  assert.deepEqual(normal.game, hard.game)
  assert.equal(normal.mode, 'normal')
  assert.equal(hard.mode, 'hard')
  for (const mode of ['normal', 'hard'] as const) {
    const storage = new MemoryStorage()
    let game = createLetterStrikeGame(published.encounter)
    storage.setItem(getRunStorageKey(tomorrow), JSON.stringify({
      ...savedRun(published, submitLetterStrike(game, quickRoute[0].tileIds)), mode }))
    for (const move of quickRoute) {
      game = submitLetterStrike(game, move.tileIds)
      assert.equal(game.error, null)
      assert.equal(game.playedWords.at(-1)?.word, move.word)
      assert.equal(game.playerResolve, move.resolve)
      const saved = saveDailyRun(published, game, storage, '2026-09-25T18:00:00Z', mode)
      assert.equal(saved.error, null)
      const restored = loadDailySession(published, storage)
      assert.deepEqual(restored.game, game)
      assert.equal(restored.mode, mode)
    }
    assert.equal(game.status, 'won')
    const completed = loadDailySession(published, storage)
    assert.equal(completed.result?.puzzleVersion, 7)
    assert.equal(completed.result?.enemyWord, 'DESPAIR')
    assert.equal(completed.result?.attacks, 3)
    assert.equal(completed.result?.won, true)
  }
})

test('the published DESPAIR also supports its six-word last-Resolve clutch and restores the final result', () => {
  const storage = new MemoryStorage()
  let game = createLetterStrikeGame(published.encounter)
  storage.setItem(getRunStorageKey(tomorrow), JSON.stringify(
    savedRun(published, submitLetterStrike(game, clutchRoute[0].tileIds))))
  for (const [index, move] of clutchRoute.entries()) {
    if (index === clutchRoute.length - 1) {
      assert.equal(game.status, 'playing')
      assert.equal(game.playerResolve, 1)
      assert.deepEqual(game.enemyLetters.filter(letter => letter.hitsRemaining > 0).map(letter => letter.letter), ['S'])
    }
    game = submitLetterStrike(game, move.tileIds)
    assert.equal(game.error, null)
    assert.equal(game.playedWords.at(-1)?.word, move.word)
    assert.equal(game.playerResolve, move.resolve)
    assert.equal(saveDailyRun(published, game, storage, '2026-09-25T18:00:00Z', 'hard').error, null)
    assert.deepEqual(loadDailySession(published, storage).game, game)
  }
  assert.equal(game.status, 'won')
  const result = loadDailySession(published, storage).result
  assert.equal(result?.won, true)
  assert.equal(result?.attacks, 6)
  assert.equal(result?.resolveRemaining, 0)
  assert.equal(result?.puzzleVersion, 7)
})

test('validated untouched September 24 saves adopt DESPAIR without changing mode or writing during load', () => {
  for (const previous of [archived, archivedMelancholy, archivedDespair]) {
    const storage = new MemoryStorage()
    const raw = JSON.stringify(savedRun(previous, createLetterStrikeGame(previous.encounter)))
    storage.setItem(getRunStorageKey(today), raw)
    const session = loadDailySession(currentToday, storage)
    assert.equal(session.error, null)
    assert.deepEqual(session.game, createLetterStrikeGame(currentToday.encounter))
    assert.equal(session.mode, 'hard')
    assert.equal(storage.getItem(getRunStorageKey(today)), raw)
    assert.equal(saveDailyRun(currentToday, session.game!, storage).error, null)
    assert.equal(JSON.parse(storage.getItem(getRunStorageKey(today))!).puzzleVersion, 7)
  }
})

test('started and completed September 24 v1, v5 and DESPAIR v6 runs keep their original encounter and result', () => {
  const previousRoutes = [
    { puzzle: archived, turns: [[0, 1, 2], [12, 5, 7, 16, 17], [3, 4, 6, 18, 19],
      [20, 21, 13, 23, 25, 14], [24, 10, 9, 27], [26, 22, 8]] },
    { puzzle: archivedMelancholy, turns: best.analysis.winningLines[0].moves.map(move => move.tileIds) },
    { puzzle: archivedDespair, turns: quickRoute.map(move => move.tileIds) },
  ]
  for (const { puzzle, turns } of previousRoutes) {
    const storage = new MemoryStorage()
    let game = submitLetterStrike(createLetterStrikeGame(puzzle.encounter), turns[0])
    assert.equal(game.error, null)
    const saved = JSON.stringify(savedRun(puzzle, game))
    storage.setItem(getRunStorageKey(today), saved)
    const resumed = loadDailySession(currentToday, storage)
    assert.equal(resumed.error, null)
    assert.deepEqual(resumed.game, game)
    assert.equal(storage.getItem(getRunStorageKey(today)), saved)
    for (const ids of turns.slice(1)) {
      game = submitLetterStrike(game, ids)
      assert.equal(game.error, null)
      assert.equal(saveDailyRun(currentToday, game, storage, '2026-09-24T17:00:00Z', 'hard').error, null)
      assert.equal(JSON.parse(storage.getItem(getRunStorageKey(today))!).puzzleVersion, puzzle.puzzleVersion)
    }
    assert.equal(game.status, 'won')
    const result = buildDailyResult(puzzle, game, '2026-09-24T17:00:00Z', 'hard')
    const raw = JSON.stringify({ saveVersion: SAVE_VERSION, result })
    assert.equal(storage.getItem(getResultStorageKey(today)), raw)
    const completed = loadDailySession(currentToday, storage)
    assert.equal(completed.error, null)
    assert.deepEqual(completed.result, result)
    assert.equal(completed.game?.encounter.id, puzzle.encounter.id)
    assert.equal(storage.getItem(getResultStorageKey(today)), raw)
  }
})

test('September 25 historical v4 progress and results remain pinned while untouched saves adopt the latest daily', () => {
  const turns = [[0, 1, 2], [4, 5, 15, 18, 16], [11, 20, 9, 10, 14, 17],
    [8, 21, 22, 27], [24, 30, 33, 26, 25, 19]]
  for (const count of [0, 1, turns.length]) {
    const storage = new MemoryStorage()
    let game = createLetterStrikeGame(archivedTomorrow.encounter)
    for (const ids of turns.slice(0, count)) game = submitLetterStrike(game, ids)
    assert.equal(game.error, null)
    const result = count === turns.length ? buildDailyResult(archivedTomorrow, game, '2026-09-25T18:00:00Z', 'hard') : null
    const key = result ? getResultStorageKey(tomorrow) : getRunStorageKey(tomorrow)
    const raw = JSON.stringify(result ? { saveVersion: SAVE_VERSION, result } : savedRun(archivedTomorrow, game))
    storage.setItem(key, raw)
    const loaded = loadDailySession(published, storage)
    assert.equal(loaded.error, null)
    assert.equal(loaded.mode, 'hard')
    assert.deepEqual(loaded.game, count === 0 ? createLetterStrikeGame(getDailyPuzzle(tomorrow).encounter) : game)
    assert.deepEqual(loaded.result, result)
    assert.equal(storage.getItem(key), raw)
    if (count === 1) {
      for (const ids of turns.slice(1)) {
        game = submitLetterStrike(game, ids)
        assert.equal(saveDailyRun(published, game, storage, '2026-09-25T18:00:00Z', 'hard').error, null)
      }
      assert.equal(loadDailySession(published, storage).result?.puzzleVersion, 4)
    }
  }
})
