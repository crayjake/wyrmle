import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { getRunStorageKey, loadDailySession, saveDailyRun, undoDailyRun } from '../src/daily/persistence.ts'
import { captureUndoSnapshot } from '../src/daily/undo.ts'
import { SAVE_VERSION } from '../src/daily/versions.ts'
import type { DailyPuzzleDefinition, DailyRun, StorageLike } from '../src/daily/types.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import { getRefillGroups } from '../src/components/refillSupply.ts'

const selected = JSON.parse(readFileSync(new URL('../artifacts/finite-refills-v1/selected.json', import.meta.url), 'utf8'))
const walkthroughs = JSON.parse(readFileSync(new URL('../artifacts/finite-refills-v1/selected-walkthroughs.json', import.meta.url), 'utf8')) as {
  candidateId: string; routes: { words: string[]; tileIds: number[][]; livesRemaining: number;
    turns: { reserveRemaining: number; activeTileCount: number }[] }[]
}
class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

const archivedFinite = () => getDailyPuzzleForVersion('2026-09-25', 'letter-strike-6', 9)

// Once a date has a newer publication, a fresh attempt opens that version.
// Seed the genuine first committed v9 turn to exercise continuing its archive.
function pinArchivedFirstMove(puzzle: DailyPuzzleDefinition, game: LetterStrikeState, storage: StorageLike) {
  assert.equal(game.playedWords.length, 1)
  assert.equal(game.status, 'playing')
  const run: DailyRun = {
    saveVersion: SAVE_VERSION, puzzleId: puzzle.puzzleId, gameVersion: puzzle.gameVersion,
    puzzleVersion: puzzle.puzzleVersion, mode: 'normal', revision: 1, undosUsed: 0,
    undoHistory: [captureUndoSnapshot(createLetterStrikeGame(puzzle.encounter))],
    enemyLetters: game.enemyLetters, playerResolve: game.playerResolve, tiles: game.tiles,
    refillIndex: game.refillIndex, nextTileId: game.nextTileId, playedWords: game.playedWords,
    status: game.status, completedAt: null,
  }
  storage.setItem(getRunStorageKey(puzzle.puzzleId), JSON.stringify(run))
}

test('archived v9 retains the certified finite19 puzzle and its historical supply', () => {
  const puzzle = archivedFinite()
  assert.equal(puzzle.puzzleVersion, 9)
  assert.equal(puzzle.gameVersion, 'letter-strike-6')
  assert.deepEqual(puzzle.encounter, selected.candidate.encounter)
  assert.equal(puzzle.encounter.id, walkthroughs.candidateId)
  assert.equal(puzzle.encounter.finiteRefills, true)
  assert.equal(puzzle.encounter.refillQueue.length, 19)
  assert.equal(puzzle.encounter.startingTiles.filter(tile => tile.gem === 'regen').length, 1)
  assert.equal(puzzle.difficulty, 'MEDIUM')
  assert.equal(selected.validation.accepted, true)
  assert.ok(selected.analysis.refillPressure.winsOnReducedBoard > 0)
  assert.equal(getDailyPuzzle('2026-09-24').encounter.enemy.word, 'DESPAIR')
  assert.equal(getDailyPuzzleForVersion(puzzle.date, 'letter-strike-5', 8).encounter.finiteRefills, undefined)
  assert.throws(() => getDailyPuzzleForVersion('2026-09-24', puzzle.gameVersion, 9), /unsupported/)
  assert.equal('analysis' in puzzle.encounter, false)
})

test('finite daily routes reproduce exact depletion, Revive, final-life wins and persisted empty cells', () => {
  const puzzle = archivedFinite()
  assert.deepEqual(walkthroughs.routes.map(route => route.words.length).sort(), [3, 4, 5, 6])
  for (const route of walkthroughs.routes) {
    let state = createLetterStrikeGame(puzzle.encounter)
    const storage = new MemoryStorage()
    for (const [index, ids] of route.tileIds.entries()) {
      state = submitLetterStrike(state, ids)
      assert.equal(state.error, null)
      assert.equal(state.tiles.length, 16)
      assert.equal(puzzle.encounter.refillQueue.length - state.refillIndex, route.turns[index].reserveRemaining)
      assert.equal(state.tiles.filter(tile => tile.letter).length, route.turns[index].activeTileCount)
      assert.equal(getRefillGroups(state)!.reduce((sum, group) => sum + group.count, 0), route.turns[index].reserveRemaining)
      if (index === 0) pinArchivedFirstMove(puzzle, state, storage)
      saveDailyRun(puzzle, state, storage, '2026-09-25T18:00:00Z')
      assert.deepEqual(loadDailySession(puzzle, storage).game, state)
    }
    assert.deepEqual(state.playedWords.map(turn => turn.word), route.words)
    assert.equal(state.status, 'won')
    assert.equal(state.playerResolve, route.livesRemaining)
    if (route.words.length === 6) {
      assert.equal(state.playerResolve, 0)
      assert.equal(state.refillIndex, 19)
      assert.ok(state.playedWords.some(turn => turn.preview.recoveries?.length))
      assert.ok(state.tiles.some(tile => !tile.letter))
    }
  }
})

test('finite reserve and blank slots restore together through persisted Undo', () => {
  const puzzle = archivedFinite()
  const route = walkthroughs.routes.find(route => route.words.length === 6)!
  const storage = new MemoryStorage()
  let state = createLetterStrikeGame(puzzle.encounter)
  for (const ids of route.tileIds.slice(0, 3)) {
    state = submitLetterStrike(state, ids)
    if (state.playedWords.length === 1) pinArchivedFirstMove(puzzle, state, storage)
    saveDailyRun(puzzle, state, storage)
  }
  const before = state
  state = submitLetterStrike(state, route.tileIds[3])
  const saved = saveDailyRun(puzzle, state, storage)
  assert.ok(state.tiles.some(tile => !tile.letter))
  const undone = undoDailyRun(puzzle, storage, saved.revision)
  assert.deepEqual(undone.game, before)
  assert.equal(undone.undosUsed, 1)
  assert.deepEqual(loadDailySession(puzzle, storage).game, before)
  assert.deepEqual(getRefillGroups(undone.game!), getRefillGroups(before))
})

test('all204 certified physical opening choices still replay to a familiar win under finite rules', () => {
  const encounter = archivedFinite().encounter
  const certificate = selected.analysis.openingSafety
  assert.equal(isOpeningSafetyCertificateCurrent(encounter, certificate), true)
  assert.equal(certificate.openingVocabulary.scope, 'restricted-spellings')
  assert.equal(certificate.enumeration.requiredSelections, 204)
  assert.equal(certificate.unsafeSelections, 0)
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
