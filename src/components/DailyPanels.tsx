import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { getCompletedResults } from '../daily/results.ts'
import { buildShareText } from '../daily/share.ts'
import { calculateStats } from '../daily/stats.ts'
import type { DailyResult } from '../daily/types.ts'
import './DailyPanels.css'

type PanelProps = { onClose: () => void }

function DailyDialog({ title, subtitle, onClose, children }: PanelProps & {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const subtitleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="daily-panel"
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="daily-panel-heading">
        <div>
          <p id={subtitleId} className="daily-panel-kicker">{subtitle}</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button type="button" className="daily-panel-close" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose} autoFocus>
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return <div className="daily-stat"><dt>{label}</dt><dd>{children}</dd></div>
}

export function ResultPanel({ result, onClose, onShowStats }: PanelProps & {
  result: DailyResult
  onShowStats: () => void
}) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle')
  const shareText = buildShareText(result)
  const shareId = useId()
  const shareRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (copyStatus === 'manual') {
      shareRef.current?.focus()
      shareRef.current?.select()
    }
  }, [copyStatus])

  async function copyResult() {
    setCopyStatus('copying')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(shareText)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('manual')
    }
  }

  return (
    <DailyDialog title={result.won ? 'Enemy defeated' : 'Run failed'} subtitle={`Daily · ${result.date} · UTC`} onClose={onClose}>
      <p className={`daily-result-outcome ${result.won ? 'is-won' : 'is-lost'}`}>
        {result.won ? `${result.enemyWord} has fallen.` : 'Your Resolve is spent.'}
      </p>
      <dl className="daily-stats-grid">
        <Stat label="Resolve">{result.resolveRemaining}<span className="daily-stat-unit"> / {result.startingResolve}</span></Stat>
        <Stat label="Attacks">{result.attacks}</Stat>
        <Stat label="Strongest hit">{result.strongestHit}<span className="daily-stat-unit"> dmg</span></Stat>
        <Stat label="Counters">{result.counters}</Stat>
        <Stat label="Specials used">{result.specialTilesTriggered}</Stat>
        <Stat label="Total damage">{result.totalDamage}</Stat>
      </dl>
      <details className="daily-words">
        <summary>Words played ({result.wordsPlayed.length})</summary>
        <p>{result.wordsPlayed.length > 0 ? result.wordsPlayed.join(' · ') : 'No words played.'}</p>
      </details>
      <p className="daily-panel-note">This result is saved. Daily puzzles begin at midnight UTC.</p>
      <div className="daily-panel-actions">
        <button type="button" className="daily-panel-primary" onClick={copyResult} disabled={copyStatus === 'copying'}>
          {copyStatus === 'copying' ? 'Copying…' : copyStatus === 'copied' ? 'Copied!' : 'Share result'}
        </button>
        <button type="button" onClick={onShowStats}>Statistics</button>
      </div>
      <p className="daily-share-status" role="status">
        {copyStatus === 'copied' ? 'Copied to clipboard. No words or enemy spoilers.' : copyStatus === 'manual' ? 'Clipboard unavailable. Select and copy your result below.' : 'Share a spoiler-free summary of your run.'}
      </p>
      <p className="daily-share-legend" aria-label="Share symbols">
        <span>🟩 Counter</span><span>⬜ Neutral</span><span>🟨 Resisted</span><span>✦ Special</span><span>◇ Resolve protected</span>
      </p>
      {copyStatus === 'manual' && (
        <div className="daily-share-fallback">
          <label htmlFor={shareId}>Your share result</label>
          <textarea id={shareId} ref={shareRef} readOnly value={shareText} rows={Math.min(10, shareText.split('\n').length + 1)} onFocus={(event) => event.currentTarget.select()} />
        </div>
      )}
    </DailyDialog>
  )
}

export function StatsPanel({ results, todayId, inProgressIds = [], onResume, onClose }: PanelProps & {
  results: DailyResult[]
  todayId: string
  inProgressIds?: string[]
  onResume?: (id: string) => void
}) {
  const stats = calculateStats(results, todayId)
  const recentResults = getCompletedResults(results).filter((result) => result.date <= todayId).slice(-7).reverse()
  const todayResult = recentResults.find((result) => result.puzzleId === todayId)
  const todayInProgress = inProgressIds.includes(todayId)
  const unfinishedDays = [...new Set(inProgressIds)]
    .filter((id) => id < todayId && !results.some((result) => result.puzzleId === id))
    .sort().reverse().slice(0, 3)

  return (
    <DailyDialog title="Your statistics" subtitle="Daily history · This browser" onClose={onClose}>
      <dl className="daily-stats-grid">
        <Stat label="Played">{stats.gamesPlayed}</Stat>
        <Stat label="Wins">{stats.wins}</Stat>
        <Stat label="Win rate">{Math.round(stats.winRate)}<span className="daily-stat-unit">%</span></Stat>
        <Stat label="Current streak">{stats.currentStreak}</Stat>
        <Stat label="Best streak">{stats.longestStreak}</Stat>
        <Stat label="Avg. win Resolve">{stats.wins > 0 ? stats.averageResolveOnWins.toFixed(1) : '—'}</Stat>
      </dl>
      <dl className="daily-stats-list">
        <Stat label="Average word length">{stats.gamesPlayed > 0 ? stats.averageWordLength.toFixed(1) : '—'}</Stat>
        <Stat label="Longest word">{stats.longestWord ?? '—'}</Stat>
        <Stat label="Counter hits">{stats.totalCounters}</Stat>
        <Stat label="Resisted hits">{stats.totalResisted}</Stat>
        <Stat label="Special tiles used">{stats.specialTilesUsed}</Stat>
        <Stat label="Different enemies defeated">{stats.uniqueEnemyDefeats}</Stat>
      </dl>
      {unfinishedDays.length > 0 && (
        <section className="daily-history" aria-label="Unfinished daily puzzles">
          <h3>Unfinished puzzles</h3>
          <ul>
            {unfinishedDays.map((id) => (
              <li key={id} className="daily-history-row daily-history-resume-row">
                <div><time dateTime={id}>{id}</time><span className="daily-history-detail"> · In progress</span></div>
                {onResume && <button type="button" className="daily-resume-button" onClick={() => onResume(id)} aria-label={`Resume puzzle for ${id}`}>Resume</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="daily-history" aria-label="Recent daily results">
        <h3>Recent days</h3>
        <ul>
          {!todayResult && (
            <li className="daily-history-row">
              <time dateTime={todayId}>{todayId}</time>
              <span className="daily-history-status">{todayInProgress ? 'In progress' : 'Unplayed'}</span>
              <span className={`daily-history-detail ${onResume && todayInProgress ? 'daily-history-detail-short' : ''}`}>Today · UTC</span>
              {onResume && todayInProgress && <button type="button" className="daily-resume-button" onClick={() => onResume(todayId)} aria-label={`Resume puzzle for ${todayId}`}>Resume</button>}
            </li>
          )}
          {recentResults.map((result) => (
            <li key={result.puzzleId} className="daily-history-row">
              <time dateTime={result.date}>{result.date}</time>
              <span className={`daily-history-status ${result.won ? 'is-won' : 'is-lost'}`}>{result.won ? 'Won' : 'Lost'}</span>
              <span className="daily-history-detail">{result.enemyWord} · {result.resolveRemaining}/{result.startingResolve} Resolve · {result.attacks} attacks</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="daily-panel-note">A streak counts wins on consecutive UTC days. Your history is stored locally in this browser.</p>
    </DailyDialog>
  )
}

export function HelpPanel({ onClose }: PanelProps) {
  return (
    <DailyDialog title="How to play" subtitle="One puzzle each day" onClose={onClose}>
      <div className="daily-help">
        <p>Choose tiles in any order to build an English word of at least three letters. Use each tile once per attack. Submit the word to damage the enemy.</p>
        <p>Longer words deal more damage. Opposites counter the enemy for a bonus; similar and related words are resisted. Watch your damage preview before attacking.</p>
        <p>Each attack costs one Resolve. <span className="daily-help-gem">◇ Ward</span> protects your Resolve for that attack. <span className="daily-help-gem">◆ Power</span> adds damage. Used tiles are replaced.</p>
        <p>Defeat the enemy before Resolve runs out. A finishing blow wins even when it spends your final Resolve.</p>
        <p>Everyone receives the same daily puzzle. The day changes at <strong>midnight UTC</strong>. A win or loss completes that day permanently.</p>
        <p>Your committed attacks and results save automatically in this browser. Return here to resume an unfinished run. Clearing browser storage removes this local history.</p>
      </div>
      <div className="daily-panel-actions"><button type="button" className="daily-panel-primary" onClick={onClose}>Return to the puzzle</button></div>
    </DailyDialog>
  )
}

export function HistoryErrorPanel({ error, onClose }: PanelProps & { error: string }) {
  return (
    <DailyDialog title="History unavailable" subtitle="Daily history · This browser" onClose={onClose}>
      <p role="alert">Your local history could not be loaded. {error}</p>
      <div className="daily-panel-actions"><button type="button" onClick={onClose}>Close</button></div>
    </DailyDialog>
  )
}
