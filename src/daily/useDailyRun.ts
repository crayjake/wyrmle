import { useCallback, useEffect, useRef, useState } from 'react'
import { clearLetterStrikeSelection, createLetterStrikeGame, submitLetterStrike, toggleLetterStrikeTile } from '../game/letterStrike.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { getInProgressPuzzleIds, loadDailySession, loadResults, saveDailyRun } from './persistence.ts'
import type { DailyPuzzleDefinition, DailyResult, DailySession } from './types.ts'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Local storage is unavailable.'
}

function readSession(puzzle: DailyPuzzleDefinition): DailySession {
  try {
    return loadDailySession(puzzle, window.localStorage)
  } catch (error) {
    return { game: null, result: null, resumed: false, error: errorMessage(error) }
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
export function useDailyRun(puzzle: DailyPuzzleDefinition) {
  const [session, setSession] = useState(() => readSession(puzzle))
  const sessionRef = useRef(session)
  const [history, setHistory] = useState(readHistory)
  const pending = useRef<{ game: LetterStrikeState; completedAt: string } | null>(null)
  const game = session.game ?? createLetterStrikeGame(puzzle.encounter)

  const updateSession = useCallback((next: DailySession) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const refresh = useCallback(() => {
    // A failed write must be explicitly retried before this tab can advance.
    if (pending.current) return
    updateSession(readSession(puzzle))
    setHistory(readHistory())
  }, [puzzle, updateSession])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('wyrmle:letter-strike:daily:v1:')) refresh()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [refresh])

  function commit(nextGame: LetterStrikeState, completedAt = new Date().toISOString()): boolean {
    try {
      const saved = saveDailyRun(puzzle, nextGame, window.localStorage, completedAt)
      pending.current = null
      updateSession({ ...saved, resumed: sessionRef.current.resumed })
      setHistory(readHistory())
      return saved.error === null
    } catch (error) {
      const recovered = readSession(puzzle)
      if (recovered.result) {
        // The result-first write succeeded even if updating the run snapshot failed.
        pending.current = null
        updateSession(recovered)
        setHistory(readHistory())
        return true
      }
      pending.current = { game: nextGame, completedAt }
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
    if (!current.game || current.error || current.result) return
    const next = submitLetterStrike(current.game)
    if (next.playedWords.length === current.game.playedWords.length) {
      updateSession({ ...current, game: next })
    } else {
      commit(next)
    }
  }

  function retry() {
    if (pending.current) commit(pending.current.game, pending.current.completedAt)
    else refresh()
  }

  return {
    game, result: session.result, resumed: session.resumed,
    error: session.error, history, select, clear, attack, retry,
    reloadSaved: () => { pending.current = null; refresh() },
    start: () => !sessionRef.current.error && commit(game),
  }
}
