import { useEffect, useRef, useState } from 'react'
import { validatePuzzleId } from '../daily/date.ts'
import { clearDailyHistory, inspectDailyStorage, resetDailyPuzzle } from '../daily/persistence.ts'
import { playDevOutcome } from '../daily/dev.ts'
import type { DailyPuzzleDefinition, DifficultyMode } from '../daily/types.ts'
import MatchHintControls from './MatchHintControls'
import EnemyLayoutControls from './EnemyLayoutControls'
import type { MatchHintMode } from './tileMatchHints'

type Props = {
  puzzle: DailyPuzzleDefinition
  onLoad: (id: string) => void
  onPlaytest: (mode: 'damage' | 'letter-strike') => void
  onClose: () => void
  matchHint: MatchHintMode
  onMatchHintChange: (mode: MatchHintMode) => void
  enemyGrid: boolean
  onEnemyGridChange: (grid: boolean) => void
  onOnboarding: (action: 'replay' | 'tutorial' | 'reset' | 'preview') => void
  onForceMode: (mode: DifficultyMode | null) => void
}

export default function DevPanel({ puzzle, onLoad, onPlaytest, onClose, matchHint, onMatchHintChange,
  enemyGrid, onEnemyGridChange, onOnboarding, onForceMode }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [date, setDate] = useState(puzzle.puzzleId)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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
      <p>Letter-strike playtests use the latest prototype board and rules. Playtests start fresh and do not save to daily history.</p>
      <div className="dev-controls" aria-label="Combat playtest mode">
        <button className="daily-button" onClick={() => onPlaytest('damage')}>DAMAGE MODE</button>
        <button className="daily-button" onClick={() => onPlaytest('letter-strike')}>LETTER-STRIKE MODE</button>
      </div>
      <p>Daily tools. Resets remove this browser’s completion records.</p>
      <div className="dev-controls" aria-label="Onboarding tools">
        <button className="daily-button" onClick={() => onOnboarding('replay')}>Replay onboarding</button>
        <button className="daily-button" onClick={() => onOnboarding('tutorial')}>Launch tutorial directly</button>
        <button className="daily-button" onClick={() => {
          onOnboarding('reset'); setNotice('Onboarding flag reset. Reload to see the first-time flow.')
        }}>Reset onboarding flag</button>
        <button className="daily-button" onClick={() => onOnboarding('preview')}>Preview first-time flow</button>
      </div>
      <p>First-time preview keeps your preferences and Daily intact. Forced modes preview the presentation; the saved run mode stays fixed.</p>
      <div className="dev-controls" aria-label="Difficulty preview">
        <button className="daily-button" onClick={() => { onForceMode('normal'); onClose() }}>Force Normal</button>
        <button className="daily-button" onClick={() => { onForceMode('hard'); onClose() }}>Force Hard</button>
        <button className="daily-button" onClick={() => { onForceMode(null); onClose() }}>Use run mode</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      <MatchHintControls value={matchHint} onChange={onMatchHintChange} />
      <EnemyLayoutControls grid={enemyGrid} onChange={onEnemyGridChange} />
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
