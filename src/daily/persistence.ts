import { createGame, submitWord } from '../game/game.ts'
import type { GameState } from '../game/types.ts'
import { validatePuzzleId } from './date.ts'
import { getDailyPuzzle } from './puzzle.ts'
import { buildDailyResult } from './results.ts'
import type { DailyPuzzleDefinition, DailyResult, DailyRun, DailySession, StorageLike } from './types.ts'
import { GAME_VERSION, PUZZLE_VERSION, SAVE_VERSION } from './versions.ts'

export const RUN_STORAGE_PREFIX = 'wyrmle:daily:run:'
export const RESULT_STORAGE_PREFIX = 'wyrmle:daily:result:'

export function getRunStorageKey(puzzleId: string): string {
  return RUN_STORAGE_PREFIX + validatePuzzleId(puzzleId)
}

export function getResultStorageKey(puzzleId: string): string {
  return RESULT_STORAGE_PREFIX + validatePuzzleId(puzzleId)
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Structural comparison accepts reordered JSON object keys, but never altered
// tile identities, combat outcomes, turn evidence or unexpected snapshot fields.
function sameData(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameData(value, right[index]))
  }
  if (!record(left) || !record(right)) return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameData(left[key], right[key]))
}

function assertVersions(value: Record<string, unknown>, puzzle: DailyPuzzleDefinition, checkSave = true): void {
  if ((checkSave && value.saveVersion !== SAVE_VERSION)
    || value.gameVersion !== puzzle.gameVersion || value.puzzleVersion !== puzzle.puzzleVersion) {
    throw new Error('This save uses an unsupported game, puzzle, or save version.')
  }
  if (value.puzzleId !== puzzle.puzzleId) throw new Error('The saved puzzle date does not match this day.')
}

function assertPuzzle(puzzle: DailyPuzzleDefinition): void {
  if (puzzle.gameVersion !== GAME_VERSION || puzzle.puzzleVersion !== PUZZLE_VERSION
    || !sameData(puzzle, getDailyPuzzle(puzzle.puzzleId))) {
    throw new Error('This puzzle definition does not match the supported published version.')
  }
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function snapshot(puzzle: DailyPuzzleDefinition, game: GameState, completedAt: string | null): DailyRun {
  return {
    saveVersion: SAVE_VERSION,
    puzzleId: puzzle.puzzleId,
    gameVersion: puzzle.gameVersion,
    puzzleVersion: puzzle.puzzleVersion,
    enemyHp: game.enemyHp,
    playerResolve: game.playerResolve,
    tiles: game.tiles,
    refillIndex: game.refillIndex,
    nextTileId: game.nextTileId,
    playedWords: game.playedWords,
    status: game.status,
    completedAt,
  }
}

function replay(puzzle: DailyPuzzleDefinition, tileIdsByTurn: unknown[]): GameState {
  let game = createGame(puzzle.encounter)
  for (const ids of tileIdsByTurn) {
    if (!Array.isArray(ids) || ids.length > 16
      || ids.some((id) => !Number.isSafeInteger(id) || id < 0) || game.status !== 'playing') {
      throw new Error('The saved turn history is invalid.')
    }
    const next = submitWord(game, ids)
    if (next.error || next.playedWords.length !== game.playedWords.length + 1) {
      throw new Error('The saved turn history cannot be replayed with these rules.')
    }
    game = next
  }
  return game
}

function readRun(puzzle: DailyPuzzleDefinition, raw: string): { game: GameState; completedAt: string | null } {
  const data: unknown = JSON.parse(raw)
  if (!record(data)) throw new Error('The saved run is damaged.')
  assertVersions(data, puzzle)
  if (!Array.isArray(data.playedWords)) throw new Error('The saved turn history is missing.')
  const ids = data.playedWords.map((turn: unknown) => {
    if (!record(turn) || !Array.isArray(turn.tiles)) throw new Error('The saved turn history is damaged.')
    return turn.tiles.map((tile: unknown) => record(tile) ? tile.id : null)
  })
  const game = replay(puzzle, ids)
  const completedAt = data.completedAt
  if ((game.status === 'playing' && completedAt !== null)
    || (game.status !== 'playing' && !validTimestamp(completedAt))) {
    throw new Error('The saved completion timestamp is invalid.')
  }
  const timestamp = typeof completedAt === 'string' ? completedAt : null
  if (!sameData(data, snapshot(puzzle, game, timestamp))) {
    throw new Error('The saved run does not match its turn history.')
  }
  return { game, completedAt: timestamp }
}

function readResult(puzzle: DailyPuzzleDefinition, raw: string): { game: GameState; result: DailyResult } {
  const envelope: unknown = JSON.parse(raw)
  if (!record(envelope) || !record(envelope.result)) throw new Error('The saved result is damaged.')
  if (envelope.saveVersion !== SAVE_VERSION) throw new Error('This result uses an unsupported save version.')
  const data = envelope.result
  assertVersions(data, puzzle, false)
  if (!Array.isArray(data.turns) || !validTimestamp(data.completedAt)) {
    throw new Error('The saved result is missing valid turn evidence or a finish timestamp.')
  }
  const game = replay(puzzle, data.turns.map((turn: unknown) => record(turn) ? turn.tileIds : null))
  if (game.status === 'playing') throw new Error('The saved result does not describe a completed game.')
  const result = buildDailyResult(puzzle, game, data.completedAt)
  if (!sameData(data, result)) throw new Error('The saved result does not match its turn history.')
  return { game, result }
}

/** Read-only, safe to use while opening the game. Corruption never starts a new attempt. */
export function loadDailySession(puzzle: DailyPuzzleDefinition, storage: StorageLike): DailySession {
  try {
    assertPuzzle(puzzle)
    const rawResult = storage.getItem(getResultStorageKey(puzzle.puzzleId))
    if (rawResult !== null) {
      // Completion wins even if another tab/crash left the separate run stale.
      return { ...readResult(puzzle, rawResult), resumed: true, error: null }
    }
    const rawRun = storage.getItem(getRunStorageKey(puzzle.puzzleId))
    if (rawRun === null) return { game: createGame(puzzle.encounter), result: null, resumed: false, error: null }
    const { game, completedAt } = readRun(puzzle, rawRun)
    return {
      game,
      result: completedAt === null ? null : buildDailyResult(puzzle, game, completedAt),
      resumed: true,
      error: null,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Local storage is unavailable.'
    return { game: null, result: null, resumed: false, error: `${reason} Your saved data has been kept.` }
  }
}

/**
 * Save committed gameplay only. Completion is written FIRST, so any subsequent
 * interrupted/failed run write cannot make a completed day playable again.
 * Existing completions are final; stale tabs cannot replace their result.
 */
export function saveDailyRun(
  puzzle: DailyPuzzleDefinition,
  game: GameState,
  storage: StorageLike,
  completedAt: string = new Date().toISOString(),
): DailySession {
  const existing = loadDailySession(puzzle, storage)
  if (existing.error || !existing.game) throw new Error(existing.error ?? 'Unable to load this puzzle.')
  if (existing.result) {
    // This also repairs a missing result from a valid terminal run, preserving
    // its original finish time rather than replacing it with the current time.
    if (storage.getItem(getResultStorageKey(puzzle.puzzleId)) === null) {
      storage.setItem(getResultStorageKey(puzzle.puzzleId), JSON.stringify({ saveVersion: SAVE_VERSION, result: existing.result }))
    }
    return existing
  }
  if (!sameData(game.encounter, puzzle.encounter)) throw new Error('The run belongs to a different encounter.')
  const timestamp = game.status === 'playing' ? null : completedAt
  const serialized = JSON.stringify(snapshot(puzzle, game, timestamp))
  const canonical = readRun(puzzle, serialized).game
  if (existing.game.playedWords.length > canonical.playedWords.length
    || existing.game.playedWords.some((turn, index) => !sameData(turn, canonical.playedWords[index]))) {
    throw new Error('This puzzle changed in another tab. Reload the saved run before continuing.')
  }
  const result = timestamp === null ? null : buildDailyResult(puzzle, canonical, timestamp)
  if (result) storage.setItem(getResultStorageKey(puzzle.puzzleId), JSON.stringify({ saveVersion: SAVE_VERSION, result }))
  storage.setItem(getRunStorageKey(puzzle.puzzleId), serialized)
  return { game: canonical, result, resumed: existing.resumed, error: null }
}

function savedPuzzleIds(storage: StorageLike): string[] {
  const ids = new Set<string>()
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    const prefix = key?.startsWith(RESULT_STORAGE_PREFIX) ? RESULT_STORAGE_PREFIX
      : key?.startsWith(RUN_STORAGE_PREFIX) ? RUN_STORAGE_PREFIX : null
    if (key && prefix) ids.add(validatePuzzleId(key.slice(prefix.length)))
  }
  return [...ids].sort()
}

/**
 * Reopening after midnight resumes the most recent unfinished daily attempt.
 * Once today's run exists, today takes priority, including permanent results.
 * Future dates opened through DEV controls never change the normal opening day.
 */
export function getOpeningPuzzleId(todayId: string, storage: StorageLike): string {
  validatePuzzleId(todayId)
  if (storage.getItem(getRunStorageKey(todayId)) !== null
    || storage.getItem(getResultStorageKey(todayId)) !== null) return todayId
  const previousIds = savedPuzzleIds(storage).filter((puzzleId) => puzzleId < todayId).reverse()
  for (const puzzleId of previousIds) {
    const session = loadDailySession(getDailyPuzzle(puzzleId), storage)
    if (session.error) throw new Error(`${puzzleId}: ${session.error}`)
    if (session.game?.status === 'playing') return puzzleId
  }
  return todayId
}

/** History is derived from result records; terminal runs can recover a missing result in memory. */
export function loadResults(storage: StorageLike): DailyResult[] {
  return savedPuzzleIds(storage).flatMap((puzzleId) => {
    const session = loadDailySession(getDailyPuzzle(puzzleId), storage)
    if (session.error) throw new Error(`${puzzleId}: ${session.error}`)
    return session.result ? [session.result] : []
  })
}

export function getInProgressPuzzleIds(storage: StorageLike): string[] {
  return savedPuzzleIds(storage).filter((puzzleId) => {
    const session = loadDailySession(getDailyPuzzle(puzzleId), storage)
    if (session.error) throw new Error(`${puzzleId}: ${session.error}`)
    return session.resumed && session.game?.status === 'playing'
  })
}

/** Invoked only by DEV controls; production UI never exposes resets. */
export function resetDailyPuzzle(puzzleId: string, storage: StorageLike): void {
  storage.removeItem(getRunStorageKey(puzzleId))
  storage.removeItem(getResultStorageKey(puzzleId))
}

export function clearDailyHistory(storage: StorageLike): void {
  for (const key of Object.keys(inspectDailyStorage(storage))) storage.removeItem(key)
}

export function inspectDailyStorage(storage: StorageLike): Record<string, unknown> {
  const saved: Record<string, unknown> = {}
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key || (!key.startsWith(RUN_STORAGE_PREFIX) && !key.startsWith(RESULT_STORAGE_PREFIX))) continue
    const raw = storage.getItem(key)
    try { saved[key] = raw === null ? null : JSON.parse(raw) }
    catch { saved[key] = raw }
  }
  return saved
}
