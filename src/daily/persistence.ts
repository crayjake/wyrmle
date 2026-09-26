import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import { validatePuzzleId } from './date.ts'
import { getDailyPuzzle, getDailyPuzzleForVersion, getSupportedDailyPuzzles } from './puzzle.ts'
import { buildDailyResult } from './results.ts'
import { undoLimit } from './modes.ts'
import { captureUndoSnapshot, restoreUndoSnapshot } from './undo.ts'
import type { DailyPuzzleDefinition, DailyResult, DailyRun, DailySession, DifficultyMode, StorageLike } from './types.ts'
import { LEGACY_GAME_VERSION, MEANING_GAME_VERSION, MEANING_PUZZLE_VERSION, MEANING_COVERAGE_PUZZLE_VERSION, SAVE_VERSION } from './versions.ts'

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

const vocabularyUpgradeChecks = new WeakMap<LetterStrikeEncounter, WeakMap<LetterStrikeEncounter, boolean>>()

/** One explicitly reviewed correction, never a general rule-version migration. */
export function canUpgradeMeaningVocabulary(from: DailyPuzzleDefinition, to: DailyPuzzleDefinition): boolean {
  if (from.puzzleId !== '2026-09-25' || to.puzzleId !== from.puzzleId
    || from.gameVersion !== MEANING_GAME_VERSION || to.gameVersion !== MEANING_GAME_VERSION
    || from.puzzleVersion !== MEANING_PUZZLE_VERSION || to.puzzleVersion !== MEANING_COVERAGE_PUZZLE_VERSION) return false
  // Only the exact reviewed publications qualify. This also pins permitted
  // semantic corrections; an arbitrary edited table cannot authorize itself.
  if (!sameData(from.encounter, getDailyPuzzleForVersion(from.puzzleId, from.gameVersion, from.puzzleVersion).encounter)
    || !sameData(to.encounter, getDailyPuzzleForVersion(to.puzzleId, to.gameVersion, to.puzzleVersion).encounter)) return false
  const immutable = Object.isFrozen(from.encounter) && Object.isFrozen(to.encounter)
  const cached = immutable ? vocabularyUpgradeChecks.get(from.encounter)?.get(to.encounter) : undefined
  if (cached !== undefined) return cached
  const physicalRules = (encounter: LetterStrikeEncounter) => {
    const { id: _id, meaningLexicon: _meanings, enemy, ...rules } = encounter
    const { semanticRelations: _mirroredMeanings, ...concept } = enemy
    return { ...rules, enemy: concept }
  }
  const compatible = from.encounter.meaningLexicon?.dictionaryVersion === 'oewn-2025-meanings-v1'
    && to.encounter.meaningLexicon?.dictionaryVersion === 'wyrmle-defined-dictionary-v2'
    && sameData(physicalRules(from.encounter), physicalRules(to.encounter))
  if (immutable) {
    let checks = vocabularyUpgradeChecks.get(from.encounter)
    if (!checks) vocabularyUpgradeChecks.set(from.encounter, checks = new WeakMap())
    checks.set(to.encounter, compatible)
  }
  return compatible
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
    || version === 4
    || version === 3
    || (version === 2 && puzzle.puzzleVersion <= 3)
    || (version === 1 && puzzle.gameVersion === LEGACY_GAME_VERSION)
}

function assertMode(mode: unknown): asserts mode is DifficultyMode {
  if (mode !== 'normal' && mode !== 'hard' && mode !== 'hardcore') throw new Error('The saved difficulty mode is invalid.')
}

function storedMode(data: Record<string, unknown>, saveVersion: unknown): DifficultyMode {
  // Earlier schemas never carried a preference or a run-specific difficulty.
  if (typeof saveVersion !== 'number' || saveVersion < 4) return 'normal'
  assertMode(data.mode)
  if (saveVersion === 4 && data.mode === 'hardcore') throw new Error('The saved difficulty mode is invalid.')
  return data.mode
}

function withoutMode<T extends { mode: DifficultyMode }>(data: T): Omit<T, 'mode'> {
  const { mode: _mode, ...historical } = data
  return historical
}

function withoutUndoRun(run: DailyRun) {
  const { revision: _revision, undosUsed: _undosUsed, undoHistory: _undoHistory, ...historical } = run
  return historical
}

function withoutAssistance(result: DailyResult) {
  const { puzzleDifficulty: _difficulty, undosUsed: _used, undosRemaining: _remaining, ...historical } = result
  return historical
}

/** Exact historical shapes, used only for comparison with saveVersion 1 data.
 * No fields are removed from user data: every original field still has to match
 * a canonical v1 replay. Returned sessions use the enriched current shape.
 */
function legacyRunProjection(run: DailyRun): unknown {
  return {
    ...withoutMode(withoutUndoRun(run)),
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
    ...withoutMode(withoutUndoRun(run)),
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
    ...withoutMode(withoutAssistance(result)),
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

function snapshot(
  puzzle: DailyPuzzleDefinition, game: LetterStrikeState, completedAt: string | null,
  mode: DifficultyMode, revision: number, undosUsed: number, undoHistory: LetterStrikeState[],
): DailyRun {
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
    revision,
    undosUsed,
    undoHistory,
  }
}

/** Meaning-era rules already belong to the version-pinned, immutable catalog. */
function durableRun(run: DailyRun) {
  return { ...run, undoHistory: run.undoHistory.map(snapshot => {
    if (!snapshot.encounter.meaningLexicon) return snapshot
    const { encounter: _encounter, ...position } = snapshot
    return position
  }) }
}

function replayWithSnapshots(puzzle: DailyPuzzleDefinition, tileIdsByTurn: unknown[]) {
  let game = createLetterStrikeGame(puzzle.encounter)
  const undoHistory: LetterStrikeState[] = []
  for (const ids of tileIdsByTurn) {
    if (!Array.isArray(ids) || ids.length > 16
      || ids.some((id) => !Number.isSafeInteger(id) || id < 0) || game.status !== 'playing') {
      throw new Error('The saved turn history is invalid.')
    }
    const next = submitLetterStrike(game, ids)
    if (next.error || next.playedWords.length !== game.playedWords.length + 1) {
      throw new Error('The saved turn history cannot be replayed with these rules.')
    }
    undoHistory.push(captureUndoSnapshot(game))
    game = next
  }
  return { game, undoHistory }
}

function replay(puzzle: DailyPuzzleDefinition, tileIdsByTurn: unknown[]): LetterStrikeState {
  return replayWithSnapshots(puzzle, tileIdsByTurn).game
}

function assertUndoCount(value: unknown, mode: DifficultyMode): asserts value is number {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 0 || value > undoLimit(mode)) {
    throw new Error('The saved undo count is invalid for this mode.')
  }
}

function assertPuzzleDifficulty(value: unknown): asserts value is DailyResult['puzzleDifficulty'] {
  if (value !== null && value !== 'EASY' && value !== 'MEDIUM' && value !== 'HARD' && value !== 'EXPERT') {
    throw new Error('The saved puzzle difficulty is invalid.')
  }
}

function readRun(puzzle: DailyPuzzleDefinition, raw: string) {
  const data: unknown = JSON.parse(raw)
  if (!record(data)) throw new Error('The saved run is damaged.')
  assertVersions(data, puzzle)
  const mode = storedMode(data, data.saveVersion)
  if (!Array.isArray(data.playedWords)) throw new Error('The saved turn history is missing.')
  const ids = data.playedWords.map((turn: unknown) => {
    if (!record(turn) || !Array.isArray(turn.tiles)) throw new Error('The saved turn history is damaged.')
    return turn.tiles.map((tile: unknown) => record(tile) ? tile.id : null)
  })
  const { game, undoHistory } = replayWithSnapshots(puzzle, ids)
  const undosUsed = data.saveVersion === SAVE_VERSION ? data.undosUsed : 0
  const revision = data.saveVersion === SAVE_VERSION ? data.revision : game.playedWords.length + 1
  assertUndoCount(undosUsed, mode)
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('The saved run revision is invalid.')
  }
  const completedAt = data.completedAt
  if ((game.status === 'playing' && completedAt !== null)
    || (game.status !== 'playing' && !validTimestamp(completedAt))) {
    throw new Error('The saved completion timestamp is invalid.')
  }
  const timestamp = typeof completedAt === 'string' ? completedAt : null
  const expected = snapshot(puzzle, game, timestamp, mode, revision, undosUsed, undoHistory)
  const expectedShape = data.saveVersion === 1 ? legacyRunProjection(expected)
    : data.saveVersion === 2 ? preLongRunProjection(expected)
      : data.saveVersion === 3 ? { ...withoutMode(withoutUndoRun(expected)), saveVersion: 3 }
        : data.saveVersion === 4 ? { ...withoutUndoRun(expected), saveVersion: 4 } : expected
  // Older schema-5 snapshots included the full encounter. Accept those exact
  // historical bytes too; new meaning-era saves store only positions. Both
  // forms are checked against a replay using the supported puzzle definition.
  const compactMatches = data.saveVersion === SAVE_VERSION && sameData(data, durableRun(expected))
  if (!compactMatches && !sameData(data, expectedShape)) {
    throw new Error('The saved run does not match its turn history.')
  }
  return { game, completedAt: timestamp, mode, revision, undosUsed, undosRemaining: undoLimit(mode) - undosUsed, undoHistory }
}

function readResult(puzzle: DailyPuzzleDefinition, raw: string) {
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
  const undosUsed = envelope.saveVersion === SAVE_VERSION ? data.undosUsed : 0
  assertUndoCount(undosUsed, mode)
  const result = buildDailyResult(puzzle, game, data.completedAt, mode, undosUsed)
  if (envelope.saveVersion === SAVE_VERSION) {
    // Calibration may change without changing the authored puzzle or combat.
    // Permanent results retain the rating recorded when that run finished.
    assertPuzzleDifficulty(data.puzzleDifficulty)
    result.puzzleDifficulty = data.puzzleDifficulty
  }
  const expected = envelope.saveVersion === 1 ? legacyResultProjection(result)
    : envelope.saveVersion === SAVE_VERSION ? result
      : envelope.saveVersion === 4 ? withoutAssistance(result) : withoutMode(withoutAssistance(result))
  if (!sameData(data, expected)) {
    throw new Error('The saved result does not match its turn history.')
  }
  return { game, result, mode, revision: 0, undosUsed, undosRemaining: undoLimit(mode) - undosUsed, undoHistory: [] }
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
    if (rawRun === null) return { game: createLetterStrikeGame(latest.encounter), mode: preferredMode, started: false, result: null, resumed: false, error: null,
      revision: 0, undosUsed: 0, undosRemaining: undoLimit(preferredMode), undoHistory: [] }
    const pinned = storedPuzzle(puzzle.puzzleId, rawRun, false)
    const { game, completedAt, mode, revision, undosUsed, undosRemaining, undoHistory } = readRun(pinned, rawRun)
    // A validated Begin-only snapshot has no committed choices or outcome to
    // preserve. Upgrade it in memory; the next commit writes the latest version.
    const untouched = game.status === 'playing' && game.playedWords.length === 0 && undosUsed === 0
    // Played and undone attempts always retain their frozen scoring table.
    return {
      game: untouched ? createLetterStrikeGame(latest.encounter) : game,
      mode,
      revision, undosUsed, undosRemaining, undoHistory,
      started: true,
      result: completedAt === null ? null : buildDailyResult(pinned, game, completedAt, mode, undosUsed),
      resumed: true,
      error: null,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Local storage is unavailable.'
    return { game: null, mode: 'normal', started: false, result: null, resumed: false, error: `${reason} Your saved data has been kept.`,
      revision: 0, undosUsed: 0, undosRemaining: 3, undoHistory: [] }
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
  expectedRevision?: number,
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
  assertCurrentRevision(existing, expectedRevision)
  const mode = existing.mode
  // The caller may hold the latest dated definition while this attempt remains
  // pinned to older rules. Existing committed progress decides the version.
  const activePuzzle = puzzleForGame(puzzle.puzzleId, existing.game)
  if (!sameData(game.encounter, activePuzzle.encounter)) throw new Error('The run belongs to a different encounter. Reload the saved run before continuing.')
  const timestamp = game.status === 'playing' ? null : completedAt
  const replayed = replayWithSnapshots(activePuzzle, game.playedWords.map((turn) => turn.tiles.map((tile) => tile.id)))
  const revision = existing.revision + 1
  const serialized = JSON.stringify(durableRun(snapshot(activePuzzle, game, timestamp, mode, revision, existing.undosUsed, replayed.undoHistory)))
  const canonical = readRun(activePuzzle, serialized).game
  if (existing.game.playedWords.length > canonical.playedWords.length
    || existing.game.playedWords.some((turn, index) => !sameData(turn, canonical.playedWords[index]))) {
    throw new Error('This puzzle changed in another tab. Reload the saved run before continuing.')
  }
  const result = timestamp === null ? null : buildDailyResult(activePuzzle, canonical, timestamp, mode, existing.undosUsed)
  if (result) storage.setItem(getResultStorageKey(puzzle.puzzleId), JSON.stringify({ saveVersion: SAVE_VERSION, result }))
  storage.setItem(getRunStorageKey(puzzle.puzzleId), serialized)
  return { game: canonical, mode, started: true, result, resumed: existing.resumed, error: null,
    revision, undosUsed: existing.undosUsed, undosRemaining: existing.undosRemaining, undoHistory: replayed.undoHistory }
}

function assertCurrentRevision(existing: DailySession, expectedRevision: number | undefined) {
  // All interactive callers carry the revision read with their board. Older
  // import/DEV callers remain supported until an undo has introduced a branch.
  if ((expectedRevision !== undefined && existing.revision !== expectedRevision)
    || (expectedRevision === undefined && existing.undosUsed > 0)) {
    throw new Error('This puzzle changed in another tab. Reload the saved run before continuing.')
  }
}

/** A committed undo restores the saved whole state and consumes one allowance. */
export function undoDailyRun(
  puzzle: DailyPuzzleDefinition, storage: StorageLike, expectedRevision: number,
): DailySession {
  const existing = loadDailySession(puzzle, storage)
  if (existing.error || !existing.game) throw new Error(existing.error ?? 'Unable to load this puzzle.')
  if (existing.result || existing.game.status !== 'playing') throw new Error('This result has been finalized and cannot be undone.')
  assertCurrentRevision(existing, expectedRevision)
  if (!existing.started || existing.undoHistory.length === 0) throw new Error('Submit a word before using Undo.')
  if (existing.undosRemaining <= 0) throw new Error('No undos remain for this Daily.')
  const undoHistory = existing.undoHistory.slice(0, -1)
  const game = restoreUndoSnapshot(existing.undoHistory.at(-1)!)
  const activePuzzle = puzzleForGame(puzzle.puzzleId, game)
  const undosUsed = existing.undosUsed + 1
  const revision = existing.revision + 1
  const serialized = JSON.stringify(durableRun(snapshot(activePuzzle, game, null, existing.mode, revision, undosUsed, undoHistory)))
  // Validate the stored evidence before the single atomic run write.
  readRun(activePuzzle, serialized)
  storage.setItem(getRunStorageKey(puzzle.puzzleId), serialized)
  return { ...existing, game, revision, undosUsed, undosRemaining: undoLimit(existing.mode) - undosUsed, undoHistory }
}

/** DEV-only control. It changes forgiveness metadata, never the puzzle or board. */
export function setDailyUndosUsed(
  puzzle: DailyPuzzleDefinition, storage: StorageLike, undosUsed: number, expectedRevision: number,
): DailySession {
  const existing = loadDailySession(puzzle, storage)
  if (existing.error || !existing.game) throw new Error(existing.error ?? 'Unable to load this puzzle.')
  if (!existing.started || existing.result) throw new Error('Only an active Daily can change its DEV undo count.')
  assertCurrentRevision(existing, expectedRevision)
  assertUndoCount(undosUsed, existing.mode)
  const revision = existing.revision + 1
  const activePuzzle = puzzleForGame(puzzle.puzzleId, existing.game)
  storage.setItem(getRunStorageKey(puzzle.puzzleId), JSON.stringify(durableRun(snapshot(
    activePuzzle, existing.game, null, existing.mode, revision, undosUsed, existing.undoHistory,
  ))))
  return { ...existing, revision, undosUsed, undosRemaining: undoLimit(existing.mode) - undosUsed }
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

/** Explicit beta/DEV reset for this date only; other dates and preferences stay saved. */
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
