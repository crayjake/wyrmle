import { useCallback, useEffect, useRef, useState } from 'react'
import { clearLetterStrikeSelection, createLetterStrikeGame, submitLetterStrike, toggleLetterStrikeTile } from '../game/letterStrike.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { getInProgressPuzzleIds, loadDailySession, loadResults, saveDailyRun, setDailyUndosUsed, undoDailyRun } from './persistence.ts'
import { undoLimit } from './modes.ts'
import type { DailyPuzzleDefinition, DailyResult, DailySession, DifficultyMode } from './types.ts'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Local storage is unavailable.'
}

function readSession(puzzle: DailyPuzzleDefinition, preferredMode: DifficultyMode): DailySession {
  try {
    return loadDailySession(puzzle, window.localStorage, preferredMode)
  } catch (error) {
    return { game: null, mode: preferredMode, started: false, result: null, resumed: false, error: errorMessage(error),
      revision: 0, undosUsed: 0, undosRemaining: undoLimit(preferredMode), undoHistory: [] }
  }
}

function readHistory() {
  try {
    return {
      results: loadResults(window.localStorage),
      inProgressIds: getInProgressPuzzleIds(window.localStorage),
      error: null as string | null,
    }
  } catch (error) {
    return { results: [] as DailyResult[], inProgressIds: [] as string[], error: errorMessage(error) }
  }
}

/** UI orchestration only. Storage and engine transitions remain separate modules. */
export function useDailyRun(puzzle: DailyPuzzleDefinition, preferredMode: DifficultyMode = 'normal') {
  const [session, setSession] = useState(() => readSession(puzzle, preferredMode))
  const sessionRef = useRef(session)
  const [history, setHistory] = useState(readHistory)
  const pending = useRef<
    | { kind: 'save'; game: LetterStrikeState; completedAt: string; mode: DifficultyMode; revision: number }
    | { kind: 'undo'; revision: number }
    | { kind: 'setUndo'; revision: number; undosUsed: number }
    | null
  >(null)
  const game = session.game ?? createLetterStrikeGame(puzzle.encounter)
  const mode = session.started ? session.mode : preferredMode

  const updateSession = useCallback((next: DailySession) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const refresh = useCallback(() => {
    // A failed write must be explicitly retried before this tab can advance.
    if (pending.current) return
    updateSession(readSession(puzzle, preferredMode))
    setHistory(readHistory())
  }, [puzzle, preferredMode, updateSession])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('wyrmle:letter-strike:daily:v1:')) refresh()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [refresh])

  function commit(
    nextGame: LetterStrikeState,
    completedAt = new Date().toISOString(),
    runMode = sessionRef.current.started ? sessionRef.current.mode : preferredMode,
    revision = sessionRef.current.revision,
  ): boolean {
    try {
      const saved = saveDailyRun(puzzle, nextGame, window.localStorage, completedAt, runMode, revision)
      pending.current = null
      updateSession({ ...saved, resumed: sessionRef.current.resumed })
      setHistory(readHistory())
      return saved.error === null
    } catch (error) {
      const recovered = readSession(puzzle, preferredMode)
      if (recovered.result) {
        // The result-first write succeeded even if updating the run snapshot failed.
        pending.current = null
        updateSession(recovered)
        setHistory(readHistory())
        return true
      }
      pending.current = { kind: 'save', game: nextGame, completedAt, mode: runMode, revision }
      // Keep the selected word available for retry; never claim an unsaved turn succeeded.
      updateSession({ ...sessionRef.current, error: errorMessage(error) })
      return false
    }
  }

  function select(tileId: number) {
    const current = sessionRef.current
    if (!current.game || current.error || current.result) return
    updateSession({ ...current, game: toggleLetterStrikeTile(current.game, tileId) })
  }

  function clear() {
    const current = sessionRef.current
    if (!current.game || current.error || current.result) return
    updateSession({ ...current, game: clearLetterStrikeSelection(current.game) })
  }

  function attack() {
    const current = sessionRef.current
    if (!current.started || !current.game || current.error || current.result) return
    const next = submitLetterStrike(current.game)
    if (next.playedWords.length === current.game.playedWords.length) {
      updateSession({ ...current, game: next })
    } else {
      commit(next)
    }
  }

  function undo(revision = sessionRef.current.revision) {
    try {
      const restored = undoDailyRun(puzzle, window.localStorage, revision)
      pending.current = null
      updateSession(restored)
      setHistory(readHistory())
      return true
    } catch (error) {
      pending.current = { kind: 'undo', revision }
      updateSession({ ...sessionRef.current, error: errorMessage(error) })
      return false
    }
  }

  function setUndosUsed(undosUsed: number, revision = sessionRef.current.revision) {
    try {
      updateSession(setDailyUndosUsed(puzzle, window.localStorage, undosUsed, revision))
      pending.current = null
      return true
    } catch (error) {
      pending.current = { kind: 'setUndo', revision, undosUsed }
      updateSession({ ...sessionRef.current, error: errorMessage(error) })
      return false
    }
  }

  function retry() {
    const action = pending.current
    if (action?.kind === 'save') commit(action.game, action.completedAt, action.mode, action.revision)
    else if (action?.kind === 'undo') undo(action.revision)
    else if (action?.kind === 'setUndo') setUndosUsed(action.undosUsed, action.revision)
    else refresh()
  }

  return {
    game, mode, started: session.started, result: session.result, resumed: session.resumed,
    error: session.error, history, select, clear, attack, retry,
    undo: () => undo(), setUndosUsed: (used: number) => setUndosUsed(used),
    undoLimit: undoLimit(mode),
    undosUsed: session.undosUsed,
    undosRemaining: session.started ? session.undosRemaining : undoLimit(mode),
    canUndo: session.started && !session.error && !session.result && game.status === 'playing'
      && session.undosRemaining > 0 && session.undoHistory.length > 0,
    reloadSaved: () => { pending.current = null; refresh() },
    start: () => !sessionRef.current.error && commit(game),
  }
}
