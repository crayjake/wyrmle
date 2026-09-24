import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { getCompletedResults } from '../daily/results.ts'
import { buildShareText } from '../daily/share.ts'
import { calculateStats } from '../daily/stats.ts'
import type { DailyResult, DifficultyMode } from '../daily/types.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { getLetterStrikeBattleEvents } from '../game/letterStrikeHud.ts'
import { MyInfo } from './HealthInfo'
import { ModeChoices } from './ModeSelection'
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

export function SettingsPanel({ preferredMode, runMode, started, error, onChangeMode, onDev, onClose }: PanelProps & {
  preferredMode: DifficultyMode
  runMode: DifficultyMode
  started: boolean
  error: string | null
  onChangeMode: (mode: DifficultyMode) => void
  onDev?: () => void
}) {
  return <DailyDialog title="Settings" subtitle="This browser" onClose={onClose}>
    <ModeChoices value={preferredMode} onChange={onChangeMode} />
    <p className="mode-note">{started
      ? `This Daily stays in ${runMode.toUpperCase()}. Your preference applies to your next run.`
      : 'Your choice applies when you begin. Both modes use the same Daily puzzle.'}</p>
    {error && <p className="mode-save-error" role="status">{error}</p>}
    {import.meta.env.DEV && onDev && <div className="daily-panel-actions">
      <button type="button" onClick={onDev}>Development tools</button>
    </div>}
  </DailyDialog>
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
    <DailyDialog title={result.won ? 'Victory' : 'Defeat'} subtitle={`Daily · ${result.date} · ${result.mode.toUpperCase()} · UTC`} onClose={onClose}>
      <p className={`daily-result-outcome ${result.won ? 'is-won' : 'is-lost'}`}>
        {result.won ? `${result.enemyWord} has fallen.` : `${result.enemyWord} remains. Your Resolve is spent.`}
      </p>
      <div className="daily-result-resolve">
        <MyInfo name="RESOLVE" health={result.resolveRemaining} maxHealth={result.startingResolve} />
      </div>
      <dl className="daily-stats-grid">
        <Stat label="Counter">{result.counters}</Stat>
        <Stat label="Neutral">{result.neutral}</Stat>
        <Stat label="Resisted">{result.resisted}</Stat>
      </dl>
      <dl className="daily-stats-list">
        <Stat label="Letters removed">{result.lettersDestroyed}</Stat>
        <Stat label="Armour breaks">{result.armourBroken}</Stat>
        <Stat label="Strike activations">{result.strikeActivations}</Stat>
        <Stat label="Ward saves">{result.wardSaves}</Stat>
        <Stat label="Most removed in one word">{result.largestRemoval}</Stat>
      </dl>
      <details className="daily-words">
        <summary>Words played ({result.wordsPlayed.length})</summary>
        <p>{result.wordsPlayed.length > 0 ? result.wordsPlayed.join(' · ') : 'No words played.'}</p>
      </details>
      <p className="daily-panel-note">This result is saved. Daily puzzles begin at midnight UTC.</p>
      <details className="daily-share-details">
        <summary>Share preview &amp; symbols</summary>
        <pre className="daily-share-preview" aria-label="Spoiler-free share preview">{shareText}</pre>
        <p className="daily-share-legend" aria-label="Share symbols">
          <span>C Counter</span><span>N Neutral</span><span>R Resisted</span>
          <span>· Untouched</span><span>◐ Armour broken</span><span>■ Removed</span>
          <span>▣ Armour broken + removed</span><span>◇ Ward</span><span>◆ Strike</span>
        </p>
      </details>
      <div className="daily-panel-actions">
        <button type="button" className="daily-panel-primary" onClick={copyResult} disabled={copyStatus === 'copying'}>
          {copyStatus === 'copying' ? 'Copying…' : copyStatus === 'copied' ? 'Copied!' : 'Share result'}
        </button>
        <button type="button" onClick={onShowStats}>Statistics</button>
      </div>
      <p className="daily-share-status" role="status">
        {copyStatus === 'copied' ? 'Copied to clipboard. No words or enemy spoilers.' : copyStatus === 'manual' ? 'Clipboard unavailable. Select and copy your result below.' : 'Share a spoiler-free summary of your run.'}
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
        <Stat label="Enemy letters removed">{stats.totalLettersDestroyed}</Stat>
        <Stat label="Counter moves">{stats.totalCounters}</Stat>
        <Stat label="Neutral moves">{stats.totalNeutral}</Stat>
        <Stat label="Resisted moves">{stats.totalResisted}</Stat>
        <Stat label="Strike activations">{stats.totalStrikeActivations}</Stat>
        <Stat label="Ward saves">{stats.totalWardSaves}</Stat>
        <Stat label="Armour broken">{stats.totalArmourBroken}</Stat>
        <Stat label="Best Resolve remaining">{stats.gamesPlayed > 0 ? stats.bestResolveRemaining : '—'}</Stat>
        <Stat label="Largest turn by strikes">{stats.largestSingleTurnStrikes}</Stat>
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
              <span className="daily-history-detail">{result.enemyWord} · {result.resolveRemaining}/{result.startingResolve} Resolve · {result.attacks} words · {result.lettersDestroyed} letters removed</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="daily-panel-note">A streak counts wins on consecutive UTC days. Your history is stored locally in this browser.</p>
    </DailyDialog>
  )
}

export function HelpPanel({ onClose, strikeConsumesAllowance = false, longWordRule }: PanelProps & {
  strikeConsumesAllowance?: boolean
  longWordRule?: { minimumLength: number; bonusStrikes: number }
}) {
  return (
    <DailyDialog title="How to play" subtitle="One puzzle each day" onClose={onClose}>
      <div className="daily-help">
        <p>Choose tiles in any order to build an English word of at least three letters. Use each tile once per attack. Remove every letter of the enemy word to win.</p>
        <p><strong>COUNTER</strong> words strike with every matching tile. <strong>NEUTRAL</strong> words get one normal matching strike, in spelling order. <strong>RESISTED</strong> words have no normal strikes. Related words count as neutral.</p>
        {longWordRule && <p><strong>LONG +{longWordRule.bonusStrikes}</strong> gives neutral words of {longWordRule.minimumLength}+ letters an extra normal strike allowance. It stacks with grammar weaknesses, still needs matching tiles, and does not boost resisted words or counters.</p>}
        <p><span className="daily-help-gem">◆ Strike</span> guarantees its tile’s matching strike, even in a resisted word. {!strikeConsumesAllowance && 'It leaves the normal and grammar allowances available for other tiles. '}Each tile strikes at most once. A matching tile finishes wounded armour first, then targets from left to right.</p>
        <p>Highlighted enemy cells show exactly what your attack will do: blue <strong>−</strong> breaks armour; red <strong>×</strong> removes a letter. Armour loses its second outline on the first hit; defeated letters become centred <strong>·</strong> dots with no outline. Matching tiles resolve in your spelling order, so two strikes can break and remove the same armoured letter in one word.</p>
        <p>Grammar labels under the definition are green for weaknesses and red for resistances. For example, an <strong>ADJECTIVE +1 STRIKE</strong> weakness lets a resisted adjective strike its first matching tile, or a neutral adjective strike its first two. Counters already use every matching tile. Grammar never creates a hit without a matching letter.</p>
        <p>Resolve is your remaining turns. Each valid word normally costs one; <span className="daily-help-gem">◇ Ward</span> makes that turn free. Used tiles are replaced. Removing the final enemy letter wins even when it spends your final Resolve.</p>
        <p>Everyone receives the same daily puzzle. The day changes at <strong>midnight UTC</strong>. A win or loss completes that day permanently.</p>
        <p>Your committed attacks and results save automatically in this browser. Return here to resume an unfinished run. Clearing browser storage removes this local history.</p>
      </div>
      <div className="daily-panel-actions"><button type="button" className="daily-panel-primary" onClick={onClose}>Return to the puzzle</button></div>
    </DailyDialog>
  )
}

export function LogPanel({ game, date, onShowStats, onClose }: PanelProps & {
  game: LetterStrikeState
  date: string
  onShowStats: () => void
}) {
  const events = getLetterStrikeBattleEvents(game)
  return <DailyDialog title="Turn log" subtitle={`Daily · ${date} · UTC`} onClose={onClose}>
    {events.length > 0 ? <ol className="daily-turn-log" aria-label="All attacks, newest first">
      {events.map(event => {
        const attack = game.playedWords[event.id]
        const removed = attack.preview.letterOutcomes.filter(outcome => outcome.removed).length
        const broken = attack.preview.letterOutcomes.filter(outcome => outcome.armourBroken).length
        return <li key={event.id}>
          <div className="daily-turn-heading">
            <span className="daily-turn-word">{event.word}</span>
            <span>{event.damage} {event.damage === 1 ? 'STRIKE' : 'STRIKES'}</span>
          </div>
          <div className="daily-turn-effects">
            <span className={event.semanticLabel === 'COUNTER' ? 'is-won' : event.semanticLabel === 'RESISTED' ? 'is-lost' : undefined}>{event.semanticLabel}</span>
            {event.effectLabels.map(label => <span className="daily-help-gem" key={label}> · {label}</span>)}
            <span> · {removed} removed{broken > 0 ? ` · ${broken} armour broken` : ''}</span>
          </div>
        </li>
      })}
    </ol> : <p>No words submitted yet.</p>}
    <div className="daily-panel-actions"><button type="button" onClick={onShowStats}>Statistics</button></div>
  </DailyDialog>
}

export function HistoryErrorPanel({ error, onClose }: PanelProps & { error: string }) {
  return (
    <DailyDialog title="History unavailable" subtitle="Daily history · This browser" onClose={onClose}>
      <p role="alert">Your local history could not be loaded. {error}</p>
      <div className="daily-panel-actions"><button type="button" onClick={onClose}>Close</button></div>
    </DailyDialog>
  )
}
