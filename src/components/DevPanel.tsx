import { useEffect, useRef, useState } from 'react'
import { validatePuzzleId } from '../daily/date.ts'
import { clearDailyHistory, inspectDailyStorage, resetDailyPuzzle } from '../daily/persistence.ts'
import { playDevOutcome } from '../daily/dev.ts'
import type { DailyPuzzleDefinition, DifficultyMode } from '../daily/types.ts'
import MatchHintControls from './MatchHintControls'
import EnemyLayoutControls from './EnemyLayoutControls'
import type { MatchHintMode } from './tileMatchHints'
import { tutorialSteps, type TutorialStep } from '../tutorial/tutorial.ts'
import difficultyReports from '../generator/data/daily-difficulty.json'

type Props = {
  puzzle: DailyPuzzleDefinition
  onLoad: (id: string) => void
  onPlaytest: (mode: 'damage' | 'letter-strike') => void
  onGenerator: () => void
  onClose: () => void
  matchHint: MatchHintMode
  onMatchHintChange: (mode: MatchHintMode) => void
  enemyGrid: boolean
  onEnemyGridChange: (grid: boolean) => void
  onOnboarding: (action: 'replay' | 'tutorial' | 'reset' | 'preview') => void
  onForceMode: (mode: DifficultyMode | null) => void
  onTutorialStep?: (step: TutorialStep) => void
  onSetUndosUsed?: (used: number) => boolean | void
  undosUsed?: number
  undoLimit?: number
}

export default function DevPanel({ puzzle, onLoad, onPlaytest, onGenerator, onClose, matchHint, onMatchHintChange,
  enemyGrid, onEnemyGridChange, onOnboarding, onForceMode, onTutorialStep,
  onSetUndosUsed, undosUsed = 0, undoLimit = 3 }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [date, setDate] = useState(puzzle.puzzleId)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('goal')
  const [undoDraft, setUndoDraft] = useState(undosUsed)
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
        <button className="daily-button" onClick={onGenerator}>GENERATOR / SOLVER</button>
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
      {onTutorialStep && <>
        <form className="dev-controls" onSubmit={event => {
          event.preventDefault()
          onTutorialStep(tutorialStep)
        }}>
          <label htmlFor="dev-tutorial-step">Demo / optional example</label>
          <select id="dev-tutorial-step" value={tutorialStep} onChange={event => setTutorialStep(event.target.value as TutorialStep)}>
            {tutorialSteps.map(step => <option key={step.id} value={step.id}>{step.label}</option>)}
          </select>
          <button type="submit" className="daily-button">Open practice</button>
        </form>
        <div className="dev-controls" aria-label="Load tutorial fixtures">
          {([
            ['goal', 'Basic'], ['armour', 'Armour'], ['resisted', 'Resistance'], ['bingo', 'Bingo'],
          ] as const).map(([step, label]) => <button className="daily-button" key={step}
            onClick={() => onTutorialStep(step)}>Load {label} fixture</button>)}
        </div>
      </>}
      <p>First-time preview keeps your preferences and Daily intact. Forced modes preview the presentation; the saved run mode stays fixed.</p>
      <div className="dev-controls" aria-label="Difficulty preview">
        <button className="daily-button" onClick={() => { onForceMode('normal'); onClose() }}>Force Normal</button>
        <button className="daily-button" onClick={() => { onForceMode('hard'); onClose() }}>Force Hard</button>
        <button className="daily-button" onClick={() => { onForceMode('hardcore'); onClose() }}>Force Hardcore</button>
        <button className="daily-button" onClick={() => { onForceMode(null); onClose() }}>Use run mode</button>
      </div>
      {onSetUndosUsed && <form className="dev-controls" onSubmit={event => {
        event.preventDefault()
        act(() => {
          if (onSetUndosUsed(undoDraft) === false) throw new Error('Could not update the undo count. Check the saved run.')
          setNotice(`Undo usage set to ${undoDraft}/${undoLimit}.`)
        })
      }}>
        <label htmlFor="dev-undo-count">Undos used (active Daily)</label>
        <input id="dev-undo-count" type="number" min={0} max={undoLimit} step={1}
          value={undoDraft} onChange={event => setUndoDraft(Number(event.target.value))} required />
        <button type="submit" className="daily-button">Set undo count</button>
      </form>}
      <details className="daily-share-details">
        <summary>Full puzzle difficulty analysis · DEV spoilers</summary>
        <pre className="dev-snapshot">{JSON.stringify((difficultyReports as Record<string, unknown>)[puzzle.encounter.id]
          ?? { label: puzzle.difficulty ?? null, evidence: 'No stored solver analysis for this encounter.' }, null, 2)}</pre>
      </details>
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
