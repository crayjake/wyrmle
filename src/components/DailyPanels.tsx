import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { getCompletedResults } from '../daily/results.ts'
import { buildShareText } from '../daily/share.ts'
import { calculateStats } from '../daily/stats.ts'
import type { DailyResult, DifficultyMode } from '../daily/types.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { getDisplayEffectLabel, getLetterStrikeBattleEvents } from '../game/letterStrikeHud.ts'
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

export function SettingsPanel({ preferredMode, runMode, started, error, onChangeMode, onDev, onResetPuzzle, onResetTutorial, onClose }: PanelProps & {
  preferredMode: DifficultyMode
  runMode: DifficultyMode
  started: boolean
  error: string | null
  onChangeMode: (mode: DifficultyMode) => void
  onDev?: () => void
  onResetPuzzle: () => void
  onResetTutorial: () => void
}) {
  return <DailyDialog title="Settings" subtitle="This browser" onClose={onClose}>
    <ModeChoices value={preferredMode} onChange={onChangeMode} />
    <p className="mode-note">{started
      ? `This Daily stays in ${runMode.toUpperCase()}. Your preference applies to your next run.`
      : 'Your choice applies when you begin. Every mode uses the same Daily puzzle.'}</p>
    {error && <p className="mode-save-error" role="status">{error}</p>}
    <section className="settings-beta" aria-label="Beta tools">
      <h3>Beta tools</h3>
      <div className="daily-panel-actions">
        <button type="button" onClick={onResetPuzzle}>Reset puzzle</button>
        <button type="button" onClick={onResetTutorial}>Reset tutorial</button>
      </div>
      <p>Reset puzzle clears this day’s progress and result so you can play again. Other days stay saved.</p>
      <p>Reset tutorial starts the lessons again and keeps your puzzle progress.</p>
    </section>
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
        {result.won ? `${result.enemyWord} has fallen.` : result.resolveRemaining > 0
          ? `${result.enemyWord} remains. No playable words remain on the board.`
          : `${result.enemyWord} remains. You are out of lives.`}
      </p>
      <div className="daily-result-resolve">
        <MyInfo name="LIVES" health={result.resolveRemaining} maxHealth={result.startingResolve} />
      </div>
      <dl className="daily-stats-grid">
        <Stat label="Counter">{result.counters}</Stat>
        <Stat label="Neutral">{result.neutral}</Stat>
        <Stat label="Resisted">{result.resisted}</Stat>
      </dl>
      <dl className="daily-stats-list">
        <Stat label="Puzzle difficulty">{result.puzzleDifficulty ?? 'Unrated'}</Stat>
        <Stat label="Undos used">{result.undosUsed}</Stat>
        <Stat label="Undos remaining">{result.undosRemaining}</Stat>
        <Stat label="Letters removed">{result.lettersDestroyed}</Stat>
        <Stat label="Armour breaks">{result.armourBroken}</Stat>
        <Stat label="Hit tiles used">{result.strikeActivations}</Stat>
        <Stat label="Lives saved">{result.wardSaves}</Stat>
        {result.regenRecoveries !== undefined && <Stat label="Enemy recoveries">{result.regenRecoveries}</Stat>}
        <Stat label="Most removed in one word">{result.largestRemoval}</Stat>
      </dl>
      <details className="daily-words">
        <summary>Words played ({result.wordsPlayed.length})</summary>
        <p>{result.wordsPlayed.length > 0 ? result.wordsPlayed.join(' · ') : 'No words played.'}</p>
      </details>
      <p className="daily-panel-note">Result saved. During beta, Settings → Reset puzzle lets you play again. Daily puzzles begin at midnight UTC.</p>
      <details className="daily-share-details">
        <summary>Share preview &amp; symbols</summary>
        <pre className="daily-share-preview" aria-label="Spoiler-free share preview">{shareText}</pre>
        <p className="daily-share-legend" aria-label="Share symbols">
          <span>C Counter</span><span>N Neutral</span><span>R Resisted</span>
          <span>· Untouched</span><span>◐ Armour broken</span><span>■ Removed</span>
          <span>▣ Armour broken + removed</span><span>▪ Life tile</span><span>◆ Hit tile</span>
          {result.regenRecoveries !== undefined && <span>↺ Enemy recovery</span>}
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
        <Stat label="Avg. lives after a win">{stats.wins > 0 ? stats.averageResolveOnWins.toFixed(1) : '—'}</Stat>
      </dl>
      <dl className="daily-stats-list">
        <Stat label="Average word length">{stats.gamesPlayed > 0 ? stats.averageWordLength.toFixed(1) : '—'}</Stat>
        <Stat label="Longest word">{stats.longestWord ?? '—'}</Stat>
        <Stat label="Enemy letters removed">{stats.totalLettersDestroyed}</Stat>
        <Stat label="Counter moves">{stats.totalCounters}</Stat>
        <Stat label="Neutral moves">{stats.totalNeutral}</Stat>
        <Stat label="Resisted moves">{stats.totalResisted}</Stat>
        <Stat label="Hit tiles used">{stats.totalStrikeActivations}</Stat>
        <Stat label="Lives saved">{stats.totalWardSaves}</Stat>
        <Stat label="Armour broken">{stats.totalArmourBroken}</Stat>
        <Stat label="Most lives remaining">{stats.gamesPlayed > 0 ? stats.bestResolveRemaining : '—'}</Stat>
        <Stat label="Most hits in one word">{stats.largestSingleTurnStrikes}</Stat>
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
              <span className="daily-history-detail">{result.enemyWord} · {result.resolveRemaining}/{result.startingResolve} lives · {result.attacks} words · {result.mode.toUpperCase()} · {result.undosUsed} {result.undosUsed === 1 ? 'undo' : 'undos'}{result.puzzleDifficulty ? ` · ${result.puzzleDifficulty} puzzle` : ''}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="daily-panel-note">A streak counts wins on consecutive UTC days. Your history is stored locally in this browser.</p>
    </DailyDialog>
  )
}

export function HelpPanel({ onClose, strikeConsumesAllowance = false, longWordRule, onReplayTutorial, anyRecognizedGrammar = false, finiteRefills = false }: PanelProps & {
  strikeConsumesAllowance?: boolean
  longWordRule?: { minimumLength: number; bonusStrikes: number }
  onReplayTutorial?: () => void
  anyRecognizedGrammar?: boolean
  finiteRefills?: boolean
}) {
  return (
    <DailyDialog title="How to play" subtitle="One puzzle each day" onClose={onClose}>
      <div className="daily-help">
        <p>Remove every enemy letter to win. Tap tiles in spelling order to build an English word of at least three letters. Tiles do not need to touch. Use each tile once per word; tap a selected tile again to remove it from your word.</p>
        <p><strong>COUNTER</strong> words hit with every matching tile. <strong>NEUTRAL</strong> words get one normal matching hit, in spelling order. <strong>RESISTED</strong> words have no normal hits. Related words count as neutral.</p>
        {longWordRule && <p><strong>LONG +{longWordRule.bonusStrikes}</strong> gives neutral words of {longWordRule.minimumLength}+ letters an extra normal hit. It stacks with grammar weaknesses, still needs matching tiles, and does not boost resisted words or counters.</p>}
        <p><span className="daily-help-gem">◆ Hit tile</span> guarantees its tile’s matching hit, even in a resisted word. {!strikeConsumesAllowance && 'It leaves the normal and grammar allowances available for other tiles. '}Each tile hits at most once. A matching tile finishes wounded armour first, then targets from left to right.</p>
        <p><span className="daily-help-regen">REVIVE</span> helps the enemy after all your hits. Each used Revive tile restores one matching enemy letter by one step: a dead letter returns unarmoured; a living unarmoured letter gains armour. Armour never exceeds two hits. Dead matches recover first, then living unarmoured matches, from left to right. If none can recover, it does nothing. The red <strong>+</strong> preview marks recovery before you play.</p>
        <p>Highlighted enemy cells show exactly what your word will do: blue <strong>−</strong> breaks armour; red <strong>×</strong> removes a letter. Armour loses its second outline on the first hit; defeated letters become centred <strong>·</strong> dots with no outline. Matching tiles hit in your spelling order, so two hits can break and remove the same armoured letter in one word.</p>
        <p>Grammar labels under the enemy are green for weaknesses and red for resistances. For example, an <strong>ADJECTIVE +1 HIT</strong> weakness lets a recognized adjective hit one extra matching tile. {anyRecognizedGrammar ? 'Any recognized word type can qualify; a word with several types receives its best applicable modifier once. Unknown word types receive no grammar bonus.' : 'This saved puzzle uses the original rules: unknown or multiple word types receive no grammar bonus.'} Check the live preview to see what applies. Counters already use every matching tile. Grammar never creates a hit without a matching letter.</p>
        <p>Meaning labels use reviewed enemy meanings and dictionary relations. Related does not mean similar: WORRY is related to DESPAIR, so it is neutral. A word with no listed relationship also plays as neutral; that is a fallback, not a claim that its meaning is unrelated.</p>
        <p>Each valid word normally costs one life. A <span className="daily-help-life">▪ LIFE tile</span> saves that life for its turn, so your lives stay the same. {finiteRefills ? 'Used tiles are replaced while refills remain.' : 'Used tiles are replaced.'} Removing the final enemy letter wins even when it spends your final life.</p>
        {finiteRefills && <p><strong>REFILLS</strong> shows the finite reserve: letter tiles count copies of surviving enemy letters; the blank tile groups all other letters. These are counts, not the next letters in order. When the reserve runs out, used slots stay empty. Keep spelling with the tiles left on the board. An empty reserve alone does not end your run; you lose when no playable words remain or your lives run out.</p>}
        <p>Normal shows the definition and allows <strong>3 undos</strong>; Hard hides the definition and allows <strong>1 undo</strong>; Hardcore hides it and has <strong>no undos</strong>. The puzzle is identical. Your mode stays fixed when you begin. Use Undo in the turn log to restore the complete state before your last word. A saved result cannot be undone.</p>
        <p>The difficulty label rates the puzzle itself and is the same in every mode. The day changes at <strong>midnight UTC</strong>. During beta, use <strong>Settings → Reset puzzle</strong> to start the current day again, including after a win or loss. This clears that day’s saved progress and result. <strong>Reset tutorial</strong> restarts the lessons without changing your puzzle.</p>
        <p>Your played words and results save automatically in this browser. Return here to resume an unfinished run. Clearing browser storage removes this local history.</p>
        <p className="daily-panel-note">Word types and dictionary relations are adapted from <a href="https://en-word.net/" target="_blank" rel="noreferrer">Open English Wordnet 2025</a>, by the Open English Wordnet contributors, under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. WYRMLE combines categories, adds regular word forms and selects enemy meanings. Some valid words have no word-type data.</p>
      </div>
      <div className="daily-panel-actions">
        <button type="button" className="daily-panel-primary" onClick={onClose}>Return to the puzzle</button>
        {onReplayTutorial && <button type="button" onClick={onReplayTutorial}>Replay tutorial</button>}
      </div>
    </DailyDialog>
  )
}

export function LogPanel({ game, date, onShowStats, onClose, onUndo, canUndo = false, undosRemaining = 0, undosUsed = 0 }: PanelProps & {
  game: LetterStrikeState
  date: string
  onShowStats: () => void
  onUndo?: () => void
  canUndo?: boolean
  undosRemaining?: number
  undosUsed?: number
}) {
  const events = getLetterStrikeBattleEvents(game)
  return <DailyDialog title="Turn log" subtitle={`Daily · ${date} · UTC`} onClose={onClose}>
    {onUndo && <div className="daily-undo-control">
      <button type="button" className="daily-resume-button" onClick={onUndo} disabled={!canUndo}>Undo last word</button>
      <span>{undosRemaining} {undosRemaining === 1 ? 'undo' : 'undos'} left · {undosUsed} used</span>
      <p>{game.status === 'playing' ? 'Restores the board, enemy and lives before your last word.' : 'This result is saved and cannot be undone.'}</p>
    </div>}
    {events.length > 0 ? <ol className="daily-turn-log" aria-label="All played words, newest first">
      {events.map(event => {
        const attack = game.playedWords[event.id]
        const removed = attack.preview.letterOutcomes.filter(outcome => outcome.removed).length
        const broken = attack.preview.letterOutcomes.filter(outcome => outcome.armourBroken).length
        return <li key={event.id}>
          <div className="daily-turn-heading">
            <span className="daily-turn-word">{event.word}</span>
            <span>{event.damage} {event.damage === 1 ? 'HIT' : 'HITS'}</span>
          </div>
          <div className="daily-turn-effects">
            <span className={event.semanticLabel === 'COUNTER' ? 'is-won' : event.semanticLabel === 'RESISTED' ? 'is-lost' : undefined}>{event.semanticLabel}</span>
            {event.effectLabels.map(label => <span className={label === 'REGEN' ? 'daily-help-regen' : 'daily-help-gem'} key={label}> · {getDisplayEffectLabel(label)}</span>)}
            <span> · {removed} removed{broken > 0 ? ` · ${broken} armour broken` : ''}</span>
            {attack.preview.recoveries && <span className="daily-help-regen"> · {attack.preview.recoveries.length} {attack.preview.recoveries.length === 1 ? 'recovery' : 'recoveries'}</span>}
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
