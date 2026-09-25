import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { getRunStorageKey, loadDailySession, resetDailyPuzzle, saveDailyRun } from '../src/daily/persistence.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import type { StorageLike } from '../src/daily/types.ts'

const walkthroughs = JSON.parse(readFileSync(new URL('../artifacts/revive-lexical-v2/anger/selected-walkthroughs.json', import.meta.url), 'utf8')) as {
  candidateId: string; routes: { words: string[]; tileIds: number[][]; livesRemaining: number }[]
}
const certificate = JSON.parse(readFileSync(new URL('../artifacts/revive-lexical-v2/anger/early-r-long7-common-opening-safety.json', import.meta.url), 'utf8'))
class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

test('Historical v8 retains the reviewed unlimited Revive puzzle and earlier saved versions', () => {
  const puzzle = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-5', 8)
  assert.equal(puzzle.puzzleVersion, 8)
  assert.equal(puzzle.encounter.id, walkthroughs.candidateId)
  assert.equal(puzzle.encounter.enemy.word, 'ANGER')
  assert.equal(puzzle.encounter.startingTiles.filter(tile => tile.gem === 'regen').length, 1)
  assert.equal(puzzle.encounter.longWordRule?.minimumLength, 7)
  assert.equal(puzzle.difficulty, 'MEDIUM')
  assert.ok(Object.isFrozen(puzzle.encounter.lexicalRules))
  assert.equal(getDailyPuzzle('2026-09-24').encounter.enemy.word, 'DESPAIR')
  assert.equal(getDailyPuzzleForVersion('2026-09-25', 'letter-strike-4', 6).encounter.enemy.word, 'DESPAIR')
  assert.equal(getDailyPuzzleForVersion('2026-09-25', 'letter-strike-5', 7).encounter.enemy.word, 'DESPAIR')
  assert.throws(() => getDailyPuzzleForVersion('2026-09-24', puzzle.gameVersion, 8), /unsupported/)
  assert.equal('analysis' in puzzle.encounter, false)
  assert.equal('openingSafety' in puzzle.encounter, false)
})

test('reviewed three-, four-, five- and six-word wins replay and restore, including the final-life clutch', () => {
  const puzzle = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-5', 8)
  assert.deepEqual(walkthroughs.routes.map(route => route.words.length).sort(), [3, 4, 5, 6])
  for (const route of walkthroughs.routes) {
    let state = createLetterStrikeGame(puzzle.encounter)
    const storage = new MemoryStorage()
    const committed = submitLetterStrike(state, route.tileIds[0])
    storage.setItem(getRunStorageKey(puzzle.date), JSON.stringify({ saveVersion: 4,
      mode: 'normal', puzzleId: puzzle.date, gameVersion: puzzle.gameVersion, puzzleVersion: puzzle.puzzleVersion,
      enemyLetters: committed.enemyLetters, playerResolve: committed.playerResolve, tiles: committed.tiles,
      refillIndex: committed.refillIndex, nextTileId: committed.nextTileId, playedWords: committed.playedWords,
      status: committed.status, completedAt: null }))
    for (const ids of route.tileIds) {
      state = submitLetterStrike(state, ids)
      assert.equal(state.error, null)
      saveDailyRun(puzzle, state, storage, '2026-09-25T18:00:00Z')
      assert.deepEqual(loadDailySession(puzzle, storage).game, state)
    }
    assert.deepEqual(state.playedWords.map(turn => turn.word), route.words)
    assert.equal(state.playerResolve, route.livesRemaining)
    assert.equal(state.status, 'won')
    assert.equal(loadDailySession(puzzle, storage).result?.puzzleVersion, 8)
  }
  assert.equal(walkthroughs.routes.find(route => route.words.length === 6)?.livesRemaining, 0)
})

test('every certified physical opening has a real winning rescue; the scope is explicitly restricted', () => {
  const encounter = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-5', 8).encounter
  assert.equal(isOpeningSafetyCertificateCurrent(encounter, certificate), true)
  assert.equal(certificate.openingVocabulary.scope, 'restricted-spellings')
  assert.equal(certificate.enumeration.requiredSelections, 204)
  assert.equal(certificate.unknownSelections, 0)
  for (const result of certificate.results) for (const opening of result.openings) {
    let state = submitLetterStrike(createLetterStrikeGame(encounter), opening.tileIds)
    for (const move of result.continuation) {
      state = submitLetterStrike(state, move.tileIds)
      assert.equal(state.error, null)
    }
    assert.equal(state.status, 'won', opening.word)
  }
})

test('a DESPAIR attempt with a committed word stays pinned until an explicit beta reset opens the new board', () => {
  const latest = getDailyPuzzle('2026-09-25')
  const old = getDailyPuzzleForVersion(latest.date, 'letter-strike-4', 6)
  const storage = new MemoryStorage()
  const game = submitLetterStrike(createLetterStrikeGame(old.encounter), [13, 14, 12, 15])
  assert.equal(game.playedWords[0].word, 'TILE')
  // Capture a schema-4 attempt from before v8 existed.
  storage.setItem(getRunStorageKey(old.date), JSON.stringify({ saveVersion: 4,
    mode: 'normal', puzzleId: old.date, gameVersion: old.gameVersion, puzzleVersion: old.puzzleVersion,
    enemyLetters: game.enemyLetters, playerResolve: game.playerResolve, tiles: game.tiles,
    refillIndex: game.refillIndex, nextTileId: game.nextTileId, playedWords: game.playedWords,
    status: 'playing', completedAt: null }))
  assert.equal(loadDailySession(latest, storage).game?.encounter.id, old.encounter.id)
  resetDailyPuzzle(latest.date, storage)
  assert.equal(loadDailySession(latest, storage).game?.encounter.id, latest.encounter.id)
})
