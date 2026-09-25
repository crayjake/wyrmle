import assert from 'node:assert/strict'
import { test } from 'node:test'
import walkthroughs from '../artifacts/meaning-v1/walkthroughs.json' with { type: 'json' }
import correctedWalkthroughs from '../artifacts/meaning-v2/walkthroughs.json' with { type: 'json' }
import {
  canUpgradeMeaningVocabulary, getResultStorageKey, getRunStorageKey,
  loadDailySession, resetDailyPuzzle, saveDailyRun, undoDailyRun,
} from '../src/daily/persistence.ts'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { buildDailyResult } from '../src/daily/results.ts'
import type { DailyPuzzleDefinition, StorageLike } from '../src/daily/types.ts'
import { captureUndoSnapshot } from '../src/daily/undo.ts'
import { SAVE_VERSION } from '../src/daily/versions.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { findPlayableWords } from '../src/generator/findMoves.ts'

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

const corrected = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-7', 11)
const archived = getDailyPuzzleForVersion(corrected.puzzleId, 'letter-strike-7', 10)
const current = getDailyPuzzle('2026-09-25')
const at = '2026-09-25T17:00:00.000Z'
const key = getRunStorageKey(corrected.puzzleId)

function position(game: LetterStrikeState) {
  const { encounter: _encounter, ...state } = game
  return state
}

function historicalRun(turns: number[][], compact = true, undosUsed = 0, publication = archived) {
  let game = createLetterStrikeGame(publication.encounter)
  const undoHistory: LetterStrikeState[] = []
  for (const ids of turns) {
    undoHistory.push(captureUndoSnapshot(game))
    game = submitLetterStrike(game, ids)
    assert.equal(game.error, null)
  }
  const raw = JSON.stringify({
    saveVersion: SAVE_VERSION, mode: 'normal', puzzleId: publication.puzzleId,
    gameVersion: publication.gameVersion, puzzleVersion: publication.puzzleVersion,
    enemyLetters: game.enemyLetters, playerResolve: game.playerResolve,
    tiles: game.tiles, refillIndex: game.refillIndex, nextTileId: game.nextTileId,
    playedWords: game.playedWords, status: game.status,
    completedAt: game.status === 'playing' ? null : at,
    revision: turns.length + 3, undosUsed,
    undoHistory: compact ? undoHistory.map(position) : undoHistory,
  })
  return { game, raw }
}

test('only the exact reviewed v10 to v11 meaning correction qualifies for an active upgrade', () => {
  assert.equal(corrected.puzzleVersion, 11)
  assert.equal(canUpgradeMeaningVocabulary(archived, corrected), true)
  const lexicon = corrected.encounter.meaningLexicon!
  const altered = (patch: Partial<DailyPuzzleDefinition['encounter']>): DailyPuzzleDefinition => ({
    ...corrected, encounter: { ...corrected.encounter, ...patch },
  })
  const missing = { ...lexicon.words }
  delete missing.HARMONY
  for (const incompatible of [
    { ...corrected, puzzleVersion: 12 },
    { ...corrected, gameVersion: 'letter-strike-8' },
    { ...corrected, puzzleId: '2026-09-26' },
    altered({ refillQueue: corrected.encounter.refillQueue + 'E' }),
    altered({ startingResolve: 9 }),
    altered({ meaningLexicon: { ...lexicon, profileVersion: 'changed' } }),
    altered({ meaningLexicon: { ...lexicon, dictionaryVersion: 'unknown-version' } }),
    altered({ meaningLexicon: { ...lexicon, words: missing } }),
    altered({ meaningLexicon: { ...lexicon, words: { ...lexicon.words,
      HARMONY: { ...lexicon.words.HARMONY, definition: 'A changed old definition.' },
    } } }),
    altered({ meaningLexicon: { ...lexicon, words: { ...lexicon.words,
      AND: { ...lexicon.words.AND, relation: 'opposite' },
    } } }),
    altered({ meaningLexicon: { ...lexicon, words: { ...lexicon.words,
      AND: { ...lexicon.words.AND, definition: '' },
    } } }),
  ]) assert.equal(canUpgradeMeaningVocabulary(archived, incompatible), false)
  assert.equal(canUpgradeMeaningVocabulary(corrected, corrected), false)
})

test('compact and former full v10 saves keep their scored publication after the model update', () => {
  assert.equal(current.puzzleVersion, 12)
  assert.equal(canUpgradeMeaningVocabulary(archived, current), false)
  for (const compact of [true, false]) {
    const storage = new MemoryStorage()
    const { game, raw } = historicalRun([[2, 1, 3]], compact, 1) // BAR
    storage.setItem(key, raw)
    const loaded = loadDailySession(current, storage)
    assert.equal(loaded.error, null)
    assert.equal(loaded.game!.encounter, archived.encounter)
    assert.deepEqual(position(loaded.game!), position(game))
    assert.equal(loaded.revision, 4)
    assert.equal(loaded.undosUsed, 1)
    assert.equal(loaded.undosRemaining, 2)
    assert.equal(storage.getItem(key), raw)
    assert.equal(loaded.undoHistory[0].encounter, archived.encounter)
    assert.deepEqual(position(loaded.undoHistory[0]), position(createLetterStrikeGame(archived.encounter)))
    const andIds = [15, 12, 5]
    assert.ok(submitLetterStrike(game, andIds).error, 'The fixture must expose the former coverage hole.')
    assert.ok(submitLetterStrike(loaded.game!, andIds).error, 'A frozen played publication cannot silently acquire different meanings.')
    const committed = saveDailyRun(current, loaded.game!, storage, at, 'normal', loaded.revision)
    assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 10)
    assert.equal(committed.undosUsed, 1)
    assert.deepEqual(loadDailySession(current, storage).game, game)
    const undone = undoDailyRun(current, storage, committed.revision)
    assert.deepEqual(position(undone.game!), position(createLetterStrikeGame(archived.encounter)))
    assert.equal(undone.game!.encounter, archived.encounter)
    assert.equal(undone.undosUsed, 2)
    assert.equal(undone.game!.encounter.meaningLexicon!.words.AND, undefined)
    assert.deepEqual(loadDailySession(current, storage).game, undone.game)
  }
})

test('an undo after the model update retains v10 and its original dictionary at the start', () => {
  const storage = new MemoryStorage()
  const { raw } = historicalRun([[2, 1, 3]], true, 1)
  storage.setItem(key, raw)
  const loaded = loadDailySession(current, storage)
  const undone = undoDailyRun(current, storage, loaded.revision)
  assert.equal(undone.game!.playedWords.length, 0)
  assert.equal(undone.undosUsed, 2)
  assert.equal(undone.game!.encounter, archived.encounter)
  assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 10)
  assert.deepEqual(loadDailySession(current, storage).game, undone.game)
})

test('a previously scored CALM turn stays on v10 when corrected semantics would change its outcome', () => {
  const storage = new MemoryStorage()
  const ids = [8, 15, 10, 14] // CALM, selecting the Revive A rather than Hit A.
  const { game, raw } = historicalRun([ids])
  assert.equal(game.playedWords[0].word, 'CALM')
  assert.equal(game.playedWords[0].semanticLabel, 'NEUTRAL')
  const correctedTurn = submitLetterStrike(createLetterStrikeGame(corrected.encounter), ids)
  assert.equal(correctedTurn.error, null)
  assert.equal(correctedTurn.playedWords[0].semanticLabel, 'COUNTER')
  assert.notEqual(correctedTurn.playedWords[0].strikes, game.playedWords[0].strikes)
  storage.setItem(key, raw)
  const loaded = loadDailySession(current, storage)
  assert.equal(loaded.error, null)
  assert.equal(loaded.game!.encounter, archived.encounter)
  assert.deepEqual(loaded.game, game)
  assert.equal(storage.getItem(key), raw)
  const retained = saveDailyRun(current, loaded.game!, storage, at, 'normal', loaded.revision)
  assert.equal(retained.game!.encounter, archived.encounter)
  assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 10)
  resetDailyPuzzle(corrected.puzzleId, storage)
  const restarted = loadDailySession(current, storage)
  assert.equal(restarted.game!.encounter, current.encounter)
  assert.ok(restarted.game!.encounter.meaningLexicon!.assessment)
})

test('v10 wins, losses and terminal runs without separate results keep their exact publication and completion', () => {
  const won = historicalRun(walkthroughs.routes[0].tileIds)
  assert.equal(won.game.status, 'won')
  let lostGame = createLetterStrikeGame(archived.encounter)
  const losingTurns: number[][] = []
  while (lostGame.status === 'playing') {
    let next: LetterStrikeState | undefined
    for (const word of findPlayableWords(lostGame)) {
      if (word.length !== 3) continue
      const ids: number[] = []
      for (const letter of word) ids.push(lostGame.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))!.id)
      const candidate = submitLetterStrike(lostGame, ids)
      if (candidate.error || candidate.status === 'won') continue
      next = candidate
      losingTurns.push(ids)
      break
    }
    assert.ok(next, 'The archived fixture needs a legal losing continuation.')
    lostGame = next
  }
  assert.equal(lostGame.status, 'lost')
  const lost = historicalRun(losingTurns)
  for (const fixture of [won, lost]) for (const separateResult of [true, false]) {
    const storage = new MemoryStorage()
    storage.setItem(key, fixture.raw)
    const expected = buildDailyResult(archived, fixture.game, at)
    const resultKey = getResultStorageKey(corrected.puzzleId)
    const resultBytes = JSON.stringify({ saveVersion: SAVE_VERSION, result: expected })
    if (separateResult) storage.setItem(resultKey, resultBytes)
    const loaded = loadDailySession(current, storage)
    assert.equal(loaded.error, null)
    assert.equal(loaded.game!.encounter, archived.encounter)
    assert.deepEqual(loaded.result, expected)
    assert.equal(storage.getItem(key), fixture.raw)
    assert.equal(storage.getItem(resultKey), separateResult ? resultBytes : null)
    const committed = saveDailyRun(current, createLetterStrikeGame(corrected.encounter), storage)
    assert.deepEqual(committed.result, expected)
    assert.equal(storage.getItem(resultKey), resultBytes)
  }
})

test('the model publication validates old evidence and rejects replacement from a stale tab without changing saved bytes', () => {
  const { raw } = historicalRun([[2, 1, 3]])
  const storage = new MemoryStorage()
  storage.setItem(key, raw)
  const loaded = loadDailySession(current, storage)
  assert.throws(() => saveDailyRun(current, createLetterStrikeGame(current.encounter), storage, at, 'normal', loaded.revision), /different encounter/)
  assert.equal(storage.getItem(key), raw)
  const corrupted = JSON.parse(raw)
  corrupted.playedWords[0].preview.strikes++
  const corruptBytes = JSON.stringify(corrupted)
  storage.setItem(key, corruptBytes)
  assert.match(loadDailySession(current, storage).error!, /does not match/)
  assert.equal(storage.getItem(key), corruptBytes)
})

test('scored v11 runs and undo positions stay on v11 until an explicit reset', () => {
  assert.equal(current.puzzleVersion, 12)
  assert.equal(canUpgradeMeaningVocabulary(corrected, current), false)
  for (const compact of [true, false]) {
    const storage = new MemoryStorage()
    const { game, raw } = historicalRun([[2, 1, 3]], compact, 0, corrected)
    storage.setItem(key, raw)
    const loaded = loadDailySession(current, storage)
    assert.equal(loaded.error, null)
    assert.deepEqual(loaded.game, game)
    assert.equal(loaded.game!.encounter, corrected.encounter)
    assert.equal(loaded.undoHistory[0].encounter, corrected.encounter)
    assert.equal(storage.getItem(key), raw)
    const saved = saveDailyRun(current, loaded.game!, storage, at, 'normal', loaded.revision)
    assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 11)
    const undone = undoDailyRun(current, storage, saved.revision)
    assert.equal(undone.game!.encounter, corrected.encounter)
    assert.equal(undone.game!.playedWords.length, 0)
    assert.equal(undone.undosUsed, 1)
    assert.equal(loadDailySession(current, storage).game!.encounter, corrected.encounter)
    resetDailyPuzzle(current.puzzleId, storage)
    assert.equal(loadDailySession(current, storage).game!.encounter, current.encounter)
    assert.equal(storage.getItem(key), null)
  }
})

test('v11 completions remain exact under the model publication, including a missing result record', () => {
  const fixture = historicalRun(correctedWalkthroughs.routes[0].tileIds, true, 0, corrected)
  assert.equal(fixture.game.status, 'won')
  const expected = buildDailyResult(corrected, fixture.game, at)
  const resultKey = getResultStorageKey(current.puzzleId)
  const resultBytes = JSON.stringify({ saveVersion: SAVE_VERSION, result: expected })
  for (const separateResult of [true, false]) {
    const storage = new MemoryStorage()
    storage.setItem(key, fixture.raw)
    if (separateResult) storage.setItem(resultKey, resultBytes)
    const loaded = loadDailySession(current, storage)
    assert.equal(loaded.error, null)
    assert.equal(loaded.game!.encounter, corrected.encounter)
    assert.deepEqual(loaded.result, expected)
    assert.equal(storage.getItem(key), fixture.raw)
    assert.equal(storage.getItem(resultKey), separateResult ? resultBytes : null)
    const committed = saveDailyRun(current, createLetterStrikeGame(current.encounter), storage)
    assert.deepEqual(committed.result, expected)
    assert.equal(storage.getItem(resultKey), resultBytes)
  }
})

test('fresh sessions and untouched v11 Begin snapshots use the model-assessed publication without rewriting storage', () => {
  assert.equal(current.puzzleVersion, 12)
  for (const beginOnly of [false, true]) {
    const storage = new MemoryStorage()
    const raw = beginOnly ? historicalRun([], true, 0, corrected).raw : null
    if (raw) storage.setItem(key, raw)
    const loaded = loadDailySession(current, storage)
    assert.equal(loaded.error, null)
    assert.equal(loaded.game!.encounter, current.encounter)
    assert.ok(loaded.game!.encounter.meaningLexicon!.assessment)
    assert.equal(loaded.game!.playedWords.length, 0)
    assert.equal(loaded.undosUsed, 0)
    assert.equal(storage.getItem(key), raw)
    assert.equal(storage.getItem(getResultStorageKey(current.puzzleId)), null)
  }
})
