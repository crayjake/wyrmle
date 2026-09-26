import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Share, X } from 'lucide-react'
import { getCompletedResults } from '../daily/results.ts'
import { buildShareText } from '../daily/share.ts'
import { shareResult } from '../daily/shareResult.ts'
import type { ShareResultStatus } from '../daily/shareResult.ts'
import { calculateStats, winWordDistribution } from '../daily/stats.ts'
import type { DailyResult, DifficultyMode } from '../daily/types.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { getDisplayEffectLabel, getLetterStrikeBattleEvents } from '../game/letterStrikeHud.ts'
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

function ShareActions({ result, children }: { result: DailyResult; children?: ReactNode }) {
  const [status, setStatus] = useState<ShareResultStatus | 'idle' | 'sharing'>('idle')
  const pending = useRef(false)
  const shareText = buildShareText(result)
  const shareId = useId()
  const shareRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (status === 'manual') {
      shareRef.current?.focus()
      shareRef.current?.select()
    }
  }, [status])

  function share() {
    if (pending.current) return
    pending.current = true
    setStatus('sharing')
    // No work is awaited before invoking the native sheet from this gesture.
    void shareResult(shareText, navigator).then(setStatus).finally(() => { pending.current = false })
  }

  return <>
    <div className="daily-panel-actions daily-share-actions">
      <button type="button" className="daily-panel-primary" onClick={share} disabled={status === 'sharing'}>
        <Share size={16} aria-hidden="true" />
        {status === 'sharing' ? 'Sharing…' : status === 'copied' ? 'Copied!' : 'Share result'}
      </button>
      {children}
    </div>
    <p className="daily-share-status" role="status">
      {status === 'copied' ? 'Copied to clipboard.' : status === 'manual' ? 'Select and copy your result below.' : ''}
    </p>
    {status === 'manual' && <div className="daily-share-fallback">
      <label htmlFor={shareId}>Your share result</label>
      <textarea id={shareId} ref={shareRef} readOnly value={shareText} rows={Math.min(10, shareText.split('\n').length + 1)} onFocus={event => event.currentTarget.select()} />
    </div>}
  </>
}

export function ResultPanel({ result, onClose, onShowStats }: PanelProps & {
  result: DailyResult
  onShowStats: () => void
}) {
  return (
    <DailyDialog title={result.won ? 'Victory' : 'Defeat'} subtitle={`Daily · ${result.date} · ${result.mode.toUpperCase()}`} onClose={onClose}>
      <p className={`daily-result-outcome ${result.won ? 'is-won' : 'is-lost'}`}>
        {result.won ? `${result.enemyWord} has fallen.` : result.resolveRemaining > 0
          ? 'No playable words remain.' : 'No lives left. A new puzzle awaits tomorrow.'}
      </p>
      <dl className="daily-stats-grid daily-result-summary">
        <Stat label="Words">{result.attacks}</Stat>
        <Stat label="Lives left">{result.resolveRemaining}<span className="daily-stat-unit">/{result.startingResolve}</span></Stat>
        <Stat label="Undos">{result.undosUsed}</Stat>
      </dl>
      <div className="daily-share-card">
        <pre className="daily-share-preview" aria-label="Spoiler-free share preview">{buildShareText(result)}</pre>
      </div>
      <ShareActions result={result}>
        <button type="button" onClick={onShowStats}>Statistics</button>
      </ShareActions>
      <details className="daily-disclosure daily-run-details">
        <summary>Run details</summary>
        <p className="daily-word-recap"><strong>Words played</strong><br />{result.wordsPlayed.join(' · ') || 'No words played.'}</p>
        <dl className="daily-stats-list">
          <Stat label="Counter words">{result.counters}</Stat>
          <Stat label="Neutral words">{result.neutral}</Stat>
          <Stat label="Resisted words">{result.resisted}</Stat>
          {result.puzzleDifficulty && <Stat label="Puzzle difficulty">{result.puzzleDifficulty}</Stat>}
          <Stat label="Letters removed">{result.lettersDestroyed}</Stat>
          <Stat label="Armour breaks">{result.armourBroken}</Stat>
          <Stat label="Hit tiles used">{result.strikeActivations}</Stat>
          <Stat label="Lives saved">{result.wardSaves}</Stat>
          {result.regenRecoveries !== undefined && <Stat label="Enemy recoveries">{result.regenRecoveries}</Stat>}
          <Stat label="Most removed in one word">{result.largestRemoval}</Stat>
        </dl>
        <p className="daily-panel-note">Each share row shows the enemy after a word: 🟩 removed, 🟨 weakened armour, ⬜ still standing, 🟥 recovered that turn. No letters are revealed.</p>
      </details>
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
  const distribution = winWordDistribution(results, todayId)
  const largestBucket = Math.max(1, ...distribution)
  const recentResults = getCompletedResults(results).filter(result => result.date <= todayId).slice(-7).reverse()
  const todayResult = recentResults.find(result => result.puzzleId === todayId)
  const todayInProgress = inProgressIds.includes(todayId)
  const unfinishedDays = [...new Set(inProgressIds)]
    .filter(id => id < todayId && !results.some(result => result.puzzleId === id))
    .sort().reverse().slice(0, 3)

  return (
    <DailyDialog title="Statistics" subtitle="Your daily puzzles" onClose={onClose}>
      <dl className="daily-stats-grid daily-stats-headline">
        <Stat label="Played">{stats.gamesPlayed}</Stat>
        <Stat label="Win %">{Math.round(stats.winRate)}</Stat>
        <Stat label="Streak">{stats.currentStreak}</Stat>
        <Stat label="Best streak">{stats.longestStreak}</Stat>
      </dl>
      <section className="daily-distribution" aria-label="Words to win">
        <h3>Words to win</h3>
        {stats.wins === 0 ? <p className="daily-panel-note">Your first win will start the chart.</p> : <ol>
          {distribution.map((count, index) => {
            const label = index === 5 ? '6+' : String(index + 1)
            const isToday = todayResult?.won && Math.min(todayResult.attacks, 6) === index + 1
            return <li key={label} aria-label={`${label} words: ${count} ${count === 1 ? 'win' : 'wins'}${isToday ? ', today' : ''}`}>
              <span className="daily-distribution-label" aria-hidden="true">{label}</span>
              <div className="daily-distribution-track" aria-hidden="true">
                <span className={`daily-distribution-bar ${isToday ? 'is-today' : ''}`} style={{ width: `${count / largestBucket * 100}%` }} />
                <span className="daily-distribution-count">{count}</span>
              </div>
            </li>
          })}
        </ol>}
      </section>
      {todayResult && <ShareActions result={todayResult} />}
      {!todayResult && <p className="daily-panel-note">{todayInProgress ? 'Today’s puzzle is in progress.' : 'Today’s puzzle is waiting.'}</p>}
      {!todayResult && todayInProgress && onResume && <div className="daily-panel-actions">
        <button type="button" onClick={() => onResume(todayId)}>Continue today’s puzzle</button>
      </div>}
      <details className="daily-disclosure">
        <summary>Recent days</summary>
        {unfinishedDays.length > 0 && <section className="daily-history" aria-label="Unfinished daily puzzles">
          <h3>Unfinished puzzles</h3>
          <ul>{unfinishedDays.map(id => <li key={id} className="daily-history-row daily-history-resume-row">
            <time dateTime={id}>{id}</time>
            {onResume && <button type="button" className="daily-resume-button" onClick={() => onResume(id)} aria-label={`Resume puzzle for ${id}`}>Resume</button>}
          </li>)}</ul>
        </section>}
        <section className="daily-history" aria-label="Recent daily results">
          {!recentResults.length && <p className="daily-panel-note">Completed puzzles will appear here.</p>}
          <ul>{recentResults.map(result => <li key={result.puzzleId} className="daily-history-row">
            <time dateTime={result.date}>{result.date}</time>
            <span className={`daily-history-status ${result.won ? 'is-won' : 'is-lost'}`}>{result.won ? `${result.attacks} words` : 'Lost'}</span>
            <span className="daily-history-detail">{result.enemyWord} · {result.mode.toUpperCase()} · {result.resolveRemaining}/{result.startingResolve} lives</span>
          </li>)}</ul>
        </section>
      </details>
      <details className="daily-disclosure">
        <summary>More statistics</summary>
        <dl className="daily-stats-list">
          <Stat label="Wins">{stats.wins}</Stat>
          <Stat label="Average lives after a win">{stats.wins ? stats.averageResolveOnWins.toFixed(1) : '—'}</Stat>
          <Stat label="Average word length">{stats.gamesPlayed ? stats.averageWordLength.toFixed(1) : '—'}</Stat>
          <Stat label="Longest word">{stats.longestWord ?? '—'}</Stat>
          <Stat label="Enemy letters removed">{stats.totalLettersDestroyed}</Stat>
          <Stat label="Counter words">{stats.totalCounters}</Stat>
          <Stat label="Neutral words">{stats.totalNeutral}</Stat>
          <Stat label="Resisted words">{stats.totalResisted}</Stat>
          <Stat label="Hit tiles used">{stats.totalStrikeActivations}</Stat>
          <Stat label="Lives saved">{stats.totalWardSaves}</Stat>
          <Stat label="Armour broken">{stats.totalArmourBroken}</Stat>
          <Stat label="Most lives remaining">{stats.gamesPlayed ? stats.bestResolveRemaining : '—'}</Stat>
          <Stat label="Most hits in one word">{stats.largestSingleTurnStrikes}</Stat>
          <Stat label="Different enemies defeated">{stats.uniqueEnemyDefeats}</Stat>
        </dl>
        <p className="daily-panel-note daily-stats-footnote">Saved on this browser · New puzzle at midnight UTC.</p>
      </details>
    </DailyDialog>
  )
}

export function HelpPanel({ onClose, strikeConsumesAllowance = false, longWordRule, onReplayTutorial, anyRecognizedGrammar = false, hasGrammarModifiers = false, definitionBacked = false, finiteRefills = false }: PanelProps & {
  strikeConsumesAllowance?: boolean
  longWordRule?: { minimumLength: number; bonusStrikes: number }
  onReplayTutorial?: () => void
  anyRecognizedGrammar?: boolean
  hasGrammarModifiers?: boolean
  definitionBacked?: boolean
  finiteRefills?: boolean
}) {
  return (
    <DailyDialog title="How to play" subtitle="One puzzle each day" onClose={onClose}>
      <div className="daily-help">
        <p>Remove every enemy letter to win. Tap or swipe across tiles in spelling order to build an English word of at least three letters. You can start with a swipe and finish with taps. Tiles do not need to touch. Use each tile once per word; tap a selected tile again to remove it from your word.</p>
        <p><strong>Meaning drives your hits.</strong> Words that counter the enemy hit with every matching tile. Neutral words get one normal matching hit, in spelling order. Similar meanings are resisted and get no normal hits. The word preview shows your meaning match and total hits before you play.</p>
        {definitionBacked && <p>This puzzle accepts words with a stored dictionary definition and meaning classification. A word outside that vocabulary cannot be played; the preview tells you before you spend a life.</p>}
        {longWordRule && <p><strong>LONG +{longWordRule.bonusStrikes}</strong> gives neutral words of {longWordRule.minimumLength}+ letters an extra normal hit. It stacks with grammar weaknesses, still needs matching tiles, and does not boost resisted words or counters.</p>}
        <p><span className="daily-help-gem">◆ Hit tile</span> guarantees its tile’s matching hit, even in a resisted word. {!strikeConsumesAllowance && 'It leaves normal hits available for other tiles. '}Each tile hits at most once. A matching tile finishes wounded armour first, then targets from left to right.</p>
        <p><span className="daily-help-regen">REVIVE</span> helps the enemy after all your hits. Each used Revive tile restores one matching enemy letter by one step: a dead letter returns unarmoured; a living unarmoured letter gains armour. Armour never exceeds two hits. Dead matches recover first, then living unarmoured matches, from left to right. If none can recover, it does nothing. The red <strong>+</strong> preview marks recovery before you play.</p>
        <p>Highlighted enemy cells show exactly what your word will do: blue <strong>−</strong> breaks armour; red <strong>×</strong> removes a letter. Armour loses its second outline on the first hit; defeated letters become centred <strong>·</strong> dots with no outline. Matching tiles hit in your spelling order, so two hits can break and remove the same armoured letter in one word.</p>
        {hasGrammarModifiers && <p>This saved puzzle also has word-type bonuses. Green labels under the enemy show weaknesses; red labels show resistances. For example, <strong>ADJECTIVE +1 HIT</strong> lets a recognized adjective hit one extra matching tile. {anyRecognizedGrammar ? 'A word with several types receives its best applicable modifier once.' : 'Unknown or multiple word types receive no grammar bonus.'} The preview lists any applied bonus. Counters already use every matching tile.</p>}
        <p>Counter meanings include opposites and ideas that overcome the enemy’s meaning. Related words are not necessarily counters or similar meanings. Matching letters still matter: a counter cannot hit a letter absent from your word.</p>
        <p>Each valid word normally costs one life. A <span className="daily-help-life">▪ LIFE tile</span> saves that life for its turn, so your lives stay the same. {finiteRefills ? 'Used tiles are replaced while refills remain.' : 'Used tiles are replaced.'} Removing the final enemy letter wins even when it spends your final life.</p>
        {finiteRefills && <p><strong>REFILLS</strong> shows the finite reserve: letter tiles count copies of surviving enemy letters; the blank tile groups all other letters. These are counts, not the next letters in order. When the reserve runs out, used slots stay empty. Keep spelling with the tiles left on the board. An empty reserve alone does not end your run; you lose when no playable words remain or your lives run out.</p>}
        <p>Normal shows the definition and allows <strong>3 undos</strong>; Hard hides the definition and allows <strong>1 undo</strong>; Hardcore hides it and has <strong>no undos</strong>. The puzzle is identical. Your mode stays fixed when you begin. Use Undo in the turn log to restore the complete state before your last word. A saved result cannot be undone.</p>
        <p>The difficulty label rates the puzzle itself and is the same in every mode. The day changes at <strong>midnight UTC</strong>. During beta, use <strong>Settings → Reset puzzle</strong> to start the current day again, including after a win or loss. This clears that day’s saved progress and result. <strong>Reset tutorial</strong> restarts the lessons without changing your puzzle.</p>
        <p>Your played words and results save automatically in this browser. Return here to resume an unfinished run. Clearing browser storage removes this local history.</p>
        <p className="daily-panel-note">Word types and dictionary relations are adapted from <a href="https://en-word.net/" target="_blank" rel="noreferrer">Open English Wordnet 2025</a>, by the Open English Wordnet contributors, under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. WYRMLE combines categories, adds regular word forms and selects enemy meanings. Some valid words have no word-type data.</p>
        {definitionBacked && <p className="daily-panel-note">Additional definitions are adapted from <a href="https://en.wiktionary.org/" target="_blank" rel="noreferrer">English Wiktionary contributors</a> via <a href="https://kaikki.org/dictionary/English/index.html" target="_blank" rel="noreferrer">Kaikki</a>, under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. WYRMLE filters word forms and selects display senses; meaning bonuses follow reviewed enemy concepts.</p>}
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
