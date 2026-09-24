import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { validatePuzzleId } from './date.ts'
import { getDailyPuzzle, getDailyPuzzleForVersion, getSupportedDailyPuzzles } from './puzzle.ts'
import { buildDailyResult } from './results.ts'
import type { DailyPuzzleDefinition, DailyResult, DailyRun, DailySession, DifficultyMode, StorageLike } from './types.ts'
import { LEGACY_GAME_VERSION, SAVE_VERSION } from './versions.ts'

// Letter health is a different game/schema. Legacy numeric-damage keys remain
// untouched and are never interpreted, reset or counted as letter-strike saves.
export const RUN_STORAGE_PREFIX = 'wyrmle:letter-strike:daily:v1:run:'
export const RESULT_STORAGE_PREFIX = 'wyrmle:letter-strike:daily:v1:result:'

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
  if ((checkSave && !supportedSaveVersion(value.saveVersion, puzzle))
    || value.gameVersion !== puzzle.gameVersion || value.puzzleVersion !== puzzle.puzzleVersion) {
    throw new Error(`This save uses an unsupported game, puzzle, or save version for ${puzzle.puzzleId}.`)
  }
  if (value.puzzleId !== puzzle.puzzleId) throw new Error('The saved puzzle date does not match this day.')
}

function assertPuzzle(puzzle: DailyPuzzleDefinition): void {
  if (!sameData(puzzle, getDailyPuzzleForVersion(puzzle.puzzleId, puzzle.gameVersion, puzzle.puzzleVersion))) {
    throw new Error('This puzzle definition does not match the supported published version.')
  }
}

function storedPuzzle(puzzleId: string, raw: string, result: boolean): DailyPuzzleDefinition {
  const parsed: unknown = JSON.parse(raw)
  const data = result && record(parsed) ? parsed.result : parsed
  if (!record(data) || typeof data.gameVersion !== 'string' || typeof data.puzzleVersion !== 'number') {
    throw new Error(`This save uses an unsupported game or puzzle version for ${puzzleId}.`)
  }
  return getDailyPuzzleForVersion(puzzleId, data.gameVersion, data.puzzleVersion)
}

function puzzleForGame(puzzleId: string, game: LetterStrikeState): DailyPuzzleDefinition {
  const puzzle = getSupportedDailyPuzzles(puzzleId).find((definition) => sameData(definition.encounter, game.encounter))
  if (!puzzle) throw new Error('The run belongs to a different encounter.')
  return puzzle
}

function supportedSaveVersion(version: unknown, puzzle: DailyPuzzleDefinition): boolean {
  return version === SAVE_VERSION
    || version === 3
    || (version === 2 && puzzle.puzzleVersion <= 3)
    || (version === 1 && puzzle.gameVersion === LEGACY_GAME_VERSION)
}

function assertMode(mode: unknown): asserts mode is DifficultyMode {
  if (mode !== 'normal' && mode !== 'hard') throw new Error('The saved difficulty mode is invalid.')
}

function storedMode(data: Record<string, unknown>, saveVersion: unknown): DifficultyMode {
  // Earlier schemas never carried a preference or a run-specific difficulty.
  if (saveVersion !== SAVE_VERSION) return 'normal'
  assertMode(data.mode)
  return data.mode
}

function withoutMode<T extends { mode: DifficultyMode }>(data: T): Omit<T, 'mode'> {
  const { mode: _mode, ...historical } = data
  return historical
}

/** Exact historical shapes, used only for comparison with saveVersion 1 data.
 * No fields are removed from user data: every original field still has to match
 * a canonical v1 replay. Returned sessions use the enriched current shape.
 */
function legacyRunProjection(run: DailyRun): unknown {
  return {
    ...withoutMode(run),
    saveVersion: 1,
    playedWords: run.playedWords.map((turn) => {
      const preview: Record<string, unknown> = { ...turn.preview }
      delete preview.grammaticalModifier
      delete preview.grammaticalPartOfSpeech
      delete preview.letterOutcomes
      delete preview.longWordModifier
      return { ...turn, preview }
    }),
  }
}

/** Schema 2 predates LONG; all its other preview fields are still mandatory. */
function preLongRunProjection(run: DailyRun): unknown {
  return {
    ...withoutMode(run),
    saveVersion: 2,
    playedWords: run.playedWords.map((turn) => {
      const preview: Record<string, unknown> = { ...turn.preview }
      delete preview.longWordModifier
      return { ...turn, preview }
    }),
  }
}

function legacyResultProjection(result: DailyResult): unknown {
  const legacy: Record<string, unknown> = {
    ...withoutMode(result),
    turns: result.turns.map((turn) => {
      const historicalTurn: Record<string, unknown> = { ...turn }
      delete historicalTurn.letterOutcomes
      return historicalTurn
    }),
  }
  delete legacy.enemyLetterCount
  delete legacy.largestRemoval
  return legacy
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function snapshot(puzzle: DailyPuzzleDefinition, game: LetterStrikeState, completedAt: string | null, mode: DifficultyMode): DailyRun {
  return {
    saveVersion: SAVE_VERSION,
    mode,
    puzzleId: puzzle.puzzleId,
    gameVersion: puzzle.gameVersion,
    puzzleVersion: puzzle.puzzleVersion,
    enemyLetters: game.enemyLetters,
    playerResolve: game.playerResolve,
    tiles: game.tiles,
    refillIndex: game.refillIndex,
    nextTileId: game.nextTileId,
    playedWords: game.playedWords,
    status: game.status,
    completedAt,
  }
}

function replay(puzzle: DailyPuzzleDefinition, tileIdsByTurn: unknown[]): LetterStrikeState {
  let game = createLetterStrikeGame(puzzle.encounter)
  for (const ids of tileIdsByTurn) {
    if (!Array.isArray(ids) || ids.length > 16
      || ids.some((id) => !Number.isSafeInteger(id) || id < 0) || game.status !== 'playing') {
      throw new Error('The saved turn history is invalid.')
    }
    const next = submitLetterStrike(game, ids)
    if (next.error || next.playedWords.length !== game.playedWords.length + 1) {
      throw new Error('The saved turn history cannot be replayed with these rules.')
    }
    game = next
  }
  return game
}

function readRun(puzzle: DailyPuzzleDefinition, raw: string): { game: LetterStrikeState; completedAt: string | null; mode: DifficultyMode } {
  const data: unknown = JSON.parse(raw)
  if (!record(data)) throw new Error('The saved run is damaged.')
  assertVersions(data, puzzle)
  const mode = storedMode(data, data.saveVersion)
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
  const expected = snapshot(puzzle, game, timestamp, mode)
  const expectedShape = data.saveVersion === 1 ? legacyRunProjection(expected)
    : data.saveVersion === 2 ? preLongRunProjection(expected)
      : data.saveVersion === 3 ? { ...withoutMode(expected), saveVersion: 3 } : expected
  if (!sameData(data, expectedShape)) {
    throw new Error('The saved run does not match its turn history.')
  }
  return { game, completedAt: timestamp, mode }
}

function readResult(puzzle: DailyPuzzleDefinition, raw: string): { game: LetterStrikeState; result: DailyResult; mode: DifficultyMode } {
  const envelope: unknown = JSON.parse(raw)
  if (!record(envelope) || !record(envelope.result)) throw new Error('The saved result is damaged.')
  if (!supportedSaveVersion(envelope.saveVersion, puzzle)) throw new Error('This result uses an unsupported save version.')
  const data = envelope.result
  assertVersions(data, puzzle, false)
  const mode = storedMode(data, envelope.saveVersion)
  if (!Array.isArray(data.turns) || !validTimestamp(data.completedAt)) {
    throw new Error('The saved result is missing valid turn evidence or a finish timestamp.')
  }
  const game = replay(puzzle, data.turns.map((turn: unknown) => record(turn) ? turn.tileIds : null))
  if (game.status === 'playing') throw new Error('The saved result does not describe a completed game.')
  const result = buildDailyResult(puzzle, game, data.completedAt, mode)
  const expected = envelope.saveVersion === 1 ? legacyResultProjection(result)
    : envelope.saveVersion === SAVE_VERSION ? result : withoutMode(result)
  if (!sameData(data, expected)) {
    throw new Error('The saved result does not match its turn history.')
  }
  return { game, result, mode }
}

/** Read-only, safe to use while opening the game. Corruption never starts a new attempt. */
export function loadDailySession(puzzle: DailyPuzzleDefinition, storage: StorageLike, preferredMode: DifficultyMode = 'normal'): DailySession {
  try {
    assertMode(preferredMode)
    assertPuzzle(puzzle)
    const rawResult = storage.getItem(getResultStorageKey(puzzle.puzzleId))
    if (rawResult !== null) {
      // Completion wins even if another tab/crash left the separate run stale.
      const pinned = storedPuzzle(puzzle.puzzleId, rawResult, true)
      return { ...readResult(pinned, rawResult), started: true, resumed: true, error: null }
    }
    const rawRun = storage.getItem(getRunStorageKey(puzzle.puzzleId))
    const latest = getDailyPuzzle(puzzle.puzzleId)
    if (rawRun === null) return { game: createLetterStrikeGame(latest.encounter), mode: preferredMode, started: false, result: null, resumed: false, error: null }
    const pinned = storedPuzzle(puzzle.puzzleId, rawRun, false)
    const { game, completedAt, mode } = readRun(pinned, rawRun)
    // A validated Begin-only snapshot has no committed choices or outcome to
    // preserve. Upgrade it in memory; the next commit writes the latest version.
    const untouched = game.status === 'playing' && game.playedWords.length === 0
    return {
      game: untouched ? createLetterStrikeGame(latest.encounter) : game,
      mode,
      started: true,
      result: completedAt === null ? null : buildDailyResult(pinned, game, completedAt, mode),
      resumed: true,
      error: null,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Local storage is unavailable.'
    return { game: null, mode: 'normal', started: false, result: null, resumed: false, error: `${reason} Your saved data has been kept.` }
  }
}

/**
 * Save committed gameplay only. Completion is written FIRST, so any subsequent
 * interrupted/failed run write cannot make a completed day playable again.
 * Existing completions are final; stale tabs cannot replace their result.
 */
export function saveDailyRun(
  puzzle: DailyPuzzleDefinition,
  game: LetterStrikeState,
  storage: StorageLike,
  completedAt: string = new Date().toISOString(),
  requestedMode?: DifficultyMode,
): DailySession {
  if (requestedMode !== undefined) assertMode(requestedMode)
  const existing = loadDailySession(puzzle, storage, requestedMode)
  if (existing.error || !existing.game) throw new Error(existing.error ?? 'Unable to load this puzzle.')
  if (existing.result) {
    // This also repairs a missing result from a valid terminal run, preserving
    // its original finish time rather than replacing it with the current time.
    if (storage.getItem(getResultStorageKey(puzzle.puzzleId)) === null) {
      storage.setItem(getResultStorageKey(puzzle.puzzleId), JSON.stringify({ saveVersion: SAVE_VERSION, result: existing.result }))
    }
    return existing
  }
  if (existing.started && requestedMode !== undefined && requestedMode !== existing.mode) {
    throw new Error('This Daily has already begun in another mode. Reload the saved run before continuing.')
  }
  const mode = existing.mode
  // The caller may hold the latest dated definition while this attempt remains
  // pinned to older rules. Existing committed progress decides the version.
  const activePuzzle = puzzleForGame(puzzle.puzzleId, existing.game)
  if (!sameData(game.encounter, activePuzzle.encounter)) throw new Error('The run belongs to a different encounter. Reload the saved run before continuing.')
  const timestamp = game.status === 'playing' ? null : completedAt
  const serialized = JSON.stringify(snapshot(activePuzzle, game, timestamp, mode))
  const canonical = readRun(activePuzzle, serialized).game
  if (existing.game.playedWords.length > canonical.playedWords.length
    || existing.game.playedWords.some((turn, index) => !sameData(turn, canonical.playedWords[index]))) {
    throw new Error('This puzzle changed in another tab. Reload the saved run before continuing.')
  }
  const result = timestamp === null ? null : buildDailyResult(activePuzzle, canonical, timestamp, mode)
  if (result) storage.setItem(getResultStorageKey(puzzle.puzzleId), JSON.stringify({ saveVersion: SAVE_VERSION, result }))
  storage.setItem(getRunStorageKey(puzzle.puzzleId), serialized)
  return { game: canonical, mode, started: true, result, resumed: existing.resumed, error: null }
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
