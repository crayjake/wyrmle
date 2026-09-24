import { useEffect, useRef, useState } from 'react'
import { validatePuzzleId } from '../daily/date.ts'
import { clearDailyHistory, inspectDailyStorage, resetDailyPuzzle } from '../daily/persistence.ts'
import { playDevOutcome } from '../daily/dev.ts'
import type { DailyPuzzleDefinition } from '../daily/types.ts'

type Props = {
  puzzle: DailyPuzzleDefinition
  onLoad: (id: string) => void
  onPlaytest: (mode: 'damage' | 'letter-strike') => void
  onClose: () => void
}

export default function DevPanel({ puzzle, onLoad, onPlaytest, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [date, setDate] = useState(puzzle.puzzleId)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  function act(action: () => void) {
    try { action(); setError(null) }
    catch (error) { setError(error instanceof Error ? error.message : 'Development action failed.') }
  }

  if (!import.meta.env.DEV) return null
  return (
    <dialog className="daily-panel" ref={dialog} onCancel={onClose} aria-labelledby="dev-title">
      <div className="daily-panel-heading">
        <h2 id="dev-title">Development</h2>
        <button type="button" className="daily-button" onClick={onClose}>Close</button>
      </div>
      <p>Combat playtests start fresh and do not save to daily history.</p>
      <div className="dev-controls" aria-label="Combat playtest mode">
        <button className="daily-button" onClick={() => onPlaytest('damage')}>DAMAGE MODE</button>
        <button className="daily-button" onClick={() => onPlaytest('letter-strike')}>LETTER-STRIKE MODE</button>
      </div>
      <p>Daily tools. Resets remove this browser’s completion records.</p>
      <form className="dev-controls" onSubmit={event => {
        event.preventDefault()
        act(() => onLoad(validatePuzzleId(date)))
      }}>
        <label htmlFor="dev-date">Puzzle date / ID (UTC)</label>
        <input id="dev-date" type="date" value={date} onChange={event => setDate(event.target.value)} required />
        <button className="daily-button" type="submit">Load puzzle</button>
      </form>
      <div className="dev-controls">
        <button className="daily-button" onClick={() => act(() => {
          resetDailyPuzzle(puzzle.puzzleId, window.localStorage); onLoad(puzzle.puzzleId)
        })}>Reset current puzzle</button>
        <button className="daily-button" onClick={() => act(() => {
          clearDailyHistory(window.localStorage); onLoad(puzzle.puzzleId)
        })}>Clear local history & runs</button>
        <button className="daily-button" onClick={() => act(() => {
          setSnapshot(JSON.stringify(inspectDailyStorage(window.localStorage), null, 2))
        })}>Inspect saved state</button>
        {(['won', 'lost'] as const).map(outcome => (
          <button key={outcome} className="daily-button" onClick={() => act(() => {
            playDevOutcome(puzzle, outcome, window.localStorage); onLoad(puzzle.puzzleId)
          })}>Test {outcome === 'won' ? 'win' : 'loss'} (replace attempt)</button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {snapshot && <pre className="dev-snapshot">{snapshot}</pre>}
    </dialog>
  )
}
