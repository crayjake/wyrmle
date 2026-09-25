import assert from 'node:assert/strict'
import { test } from 'node:test'
import walkthroughs from '../artifacts/meaning-v1/walkthroughs.json' with { type: 'json' }
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

const latest = getDailyPuzzle('2026-09-25')
const archived = getDailyPuzzleForVersion(latest.puzzleId, 'letter-strike-7', 10)
const at = '2026-09-25T17:00:00.000Z'
const key = getRunStorageKey(latest.puzzleId)

function position(game: LetterStrikeState) {
  const { encounter: _encounter, ...state } = game
  return state
}

function historicalRun(turns: number[][], compact = true, undosUsed = 0) {
  let game = createLetterStrikeGame(archived.encounter)
  const undoHistory: LetterStrikeState[] = []
  for (const ids of turns) {
    undoHistory.push(captureUndoSnapshot(game))
    game = submitLetterStrike(game, ids)
    assert.equal(game.error, null)
  }
  const raw = JSON.stringify({
    saveVersion: SAVE_VERSION, mode: 'normal', puzzleId: archived.puzzleId,
    gameVersion: archived.gameVersion, puzzleVersion: archived.puzzleVersion,
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
  assert.equal(latest.puzzleVersion, 11)
  assert.equal(canUpgradeMeaningVocabulary(archived, latest), true)
  const lexicon = latest.encounter.meaningLexicon!
  const altered = (patch: Partial<DailyPuzzleDefinition['encounter']>): DailyPuzzleDefinition => ({
    ...latest, encounter: { ...latest.encounter, ...patch },
  })
  const missing = { ...lexicon.words }
  delete missing.HARMONY
  for (const incompatible of [
    { ...latest, puzzleVersion: 12 },
    { ...latest, gameVersion: 'letter-strike-8' },
    { ...latest, puzzleId: '2026-09-26' },
    altered({ refillQueue: latest.encounter.refillQueue + 'E' }),
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
  assert.equal(canUpgradeMeaningVocabulary(latest, latest), false)
})

test('compact and former full v10 saves gain defined neutral words without changing progress or writing during load', () => {
  for (const compact of [true, false]) {
    const storage = new MemoryStorage()
    const { game, raw } = historicalRun([[2, 1, 3]], compact, 1) // BAR
    storage.setItem(key, raw)
    const loaded = loadDailySession(latest, storage)
    assert.equal(loaded.error, null)
    assert.equal(loaded.game!.encounter, latest.encounter)
    assert.deepEqual(position(loaded.game!), position(game))
    assert.equal(loaded.revision, 4)
    assert.equal(loaded.undosUsed, 1)
    assert.equal(loaded.undosRemaining, 2)
    assert.equal(storage.getItem(key), raw)
    assert.equal(loaded.undoHistory[0].encounter, latest.encounter)
    assert.deepEqual(position(loaded.undoHistory[0]), position(createLetterStrikeGame(archived.encounter)))
    const andIds = [15, 12, 5]
    assert.ok(submitLetterStrike(game, andIds).error, 'The fixture must expose the former coverage hole.')
    const next = submitLetterStrike(loaded.game!, andIds)
    assert.equal(next.error, null)
    assert.equal(next.playedWords.at(-1)!.word, 'AND')
    assert.equal(next.playedWords.at(-1)!.semanticLabel, 'NEUTRAL')
    const committed = saveDailyRun(latest, next, storage, at, 'normal', loaded.revision)
    assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 11)
    assert.equal(committed.undosUsed, 1)
    assert.deepEqual(loadDailySession(latest, storage).game, next)
    const undone = undoDailyRun(latest, storage, committed.revision)
    assert.deepEqual(position(undone.game!), position(game))
    assert.equal(undone.game!.encounter, latest.encounter)
    assert.equal(undone.undosUsed, 2)
    assert.equal(undone.game!.encounter.meaningLexicon!.words.AND.source, 'wiktionary-en')
    assert.deepEqual(loadDailySession(latest, storage).game, undone.game)
  }
})

test('an undo immediately after a vocabulary upgrade writes v11 and retains the corrected dictionary at the start', () => {
  const storage = new MemoryStorage()
  const { raw } = historicalRun([[2, 1, 3]], true, 1)
  storage.setItem(key, raw)
  const loaded = loadDailySession(latest, storage)
  const undone = undoDailyRun(latest, storage, loaded.revision)
  assert.equal(undone.game!.playedWords.length, 0)
  assert.equal(undone.undosUsed, 2)
  assert.equal(undone.game!.encounter, latest.encounter)
  assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 11)
  assert.deepEqual(loadDailySession(latest, storage).game, undone.game)
})

test('a previously scored CALM turn stays on v10 when corrected semantics would change its outcome', () => {
  const storage = new MemoryStorage()
  const ids = [8, 15, 10, 14] // CALM, selecting the Revive A rather than Hit A.
  const { game, raw } = historicalRun([ids])
  assert.equal(game.playedWords[0].word, 'CALM')
  assert.equal(game.playedWords[0].semanticLabel, 'NEUTRAL')
  const corrected = submitLetterStrike(createLetterStrikeGame(latest.encounter), ids)
  assert.equal(corrected.error, null)
  assert.equal(corrected.playedWords[0].semanticLabel, 'COUNTER')
  assert.notEqual(corrected.playedWords[0].strikes, game.playedWords[0].strikes)
  storage.setItem(key, raw)
  const loaded = loadDailySession(latest, storage)
  assert.equal(loaded.error, null)
  assert.equal(loaded.game!.encounter, archived.encounter)
  assert.deepEqual(loaded.game, game)
  assert.equal(storage.getItem(key), raw)
  const retained = saveDailyRun(latest, loaded.game!, storage, at, 'normal', loaded.revision)
  assert.equal(retained.game!.encounter, archived.encounter)
  assert.equal(JSON.parse(storage.getItem(key)!).puzzleVersion, 10)
  resetDailyPuzzle(latest.puzzleId, storage)
  const restarted = loadDailySession(latest, storage)
  assert.equal(restarted.game!.encounter, latest.encounter)
  assert.equal(submitLetterStrike(restarted.game!, ids).playedWords[0].semanticLabel, 'COUNTER')
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
    const resultKey = getResultStorageKey(latest.puzzleId)
    const resultBytes = JSON.stringify({ saveVersion: SAVE_VERSION, result: expected })
    if (separateResult) storage.setItem(resultKey, resultBytes)
    const loaded = loadDailySession(latest, storage)
    assert.equal(loaded.error, null)
    assert.equal(loaded.game!.encounter, archived.encounter)
    assert.deepEqual(loaded.result, expected)
    assert.equal(storage.getItem(key), fixture.raw)
    assert.equal(storage.getItem(resultKey), separateResult ? resultBytes : null)
    const committed = saveDailyRun(latest, createLetterStrikeGame(latest.encounter), storage)
    assert.deepEqual(committed.result, expected)
    assert.equal(storage.getItem(resultKey), resultBytes)
  }
})

test('vocabulary upgrades validate old evidence before replay and reject stale tabs without changing saved bytes', () => {
  const { game, raw } = historicalRun([[2, 1, 3]])
  const storage = new MemoryStorage()
  storage.setItem(key, raw)
  const loaded = loadDailySession(latest, storage)
  assert.throws(() => saveDailyRun(latest, game, storage, at, 'normal', loaded.revision), /different encounter/)
  assert.equal(storage.getItem(key), raw)
  const corrupted = JSON.parse(raw)
  corrupted.playedWords[0].preview.strikes++
  const corruptBytes = JSON.stringify(corrupted)
  storage.setItem(key, corruptBytes)
  assert.match(loadDailySession(latest, storage).error!, /does not match/)
  assert.equal(storage.getItem(key), corruptBytes)
})
