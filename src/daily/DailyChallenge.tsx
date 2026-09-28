import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import BattleScreen, { BattlePanel } from '../components/BattleScreen'
import BattleResult from '../components/BattleResult'
import PuzzleLoading from '../components/PuzzleLoading'
import type { LetterStrikeEncounter } from '../game/letterStrike'
import { useUserPreferences } from '../useUserPreferences'
import { getDailyPuzzleId } from './date'
import { decodeScheduledPuzzle, latestScheduledPuzzle, scheduledPuzzle } from './scheduledPuzzle'
import type { ScheduledPuzzle } from './scheduledPuzzle'
import { challengeBestSolution, challengeHistory, challengeKey, challengeLives, challengeStars, openChallenge, readChallenge, restartChallenge, saveChallenge } from './challengeProgress'
import type { ChallengeRecord } from './challengeProgress'
import { shareResult } from './shareResult'
import { challengeShareText } from './scoreShare'
import { puzzleLocation } from './calendar'
import { getPuzzleGuide } from './guides'
import './DailyChallenge.css'

const TutorialBattle = lazy(() => import('../tutorial/TutorialBattle'))
const PuzzleCalendar = lazy(() => import('./PuzzleCalendar'))
const calendar = () => window.location.assign(`${import.meta.env.BASE_URL}?calendar`)

export default function DailyChallenge() {
  const preferences = useUserPreferences()
  const [tutorial, setTutorial] = useState(!preferences.preferences.hasCompletedOnboarding)
  const [today, setToday] = useState(getDailyPuzzleId)
  const [location] = useState(() => puzzleLocation(window.location.search, window.location.pathname))
  const entry = location.date && location.date <= today ? scheduledPuzzle(location.date) : latestScheduledPuzzle(today)
  useEffect(() => {
    if (location.replacement) window.history.replaceState(null, '', `${import.meta.env.BASE_URL}${location.replacement}`)
  }, [location])
  useEffect(() => {
    const update = () => setToday(getDailyPuzzleId())
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    const timer = window.setInterval(update, 30_000)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [])
  function finishTutorial() {
    preferences.update({ hasCompletedOnboarding: true, hasChosenMode: true })
    setTutorial(false)
  }
  if (location.calendar) return <Suspense fallback={<PuzzleLoading />}><PuzzleCalendar today={today} requestedMonth={location.month} /></Suspense>
  if (tutorial) return <Suspense fallback={<PuzzleLoading />}><TutorialBattle onComplete={finishTutorial} onSkip={finishTutorial} /></Suspense>
  if (!entry) return <main className="container"><h2>No puzzle scheduled for this date</h2><button className="daily-button" onClick={calendar}>Calendar</button></main>
  return <LoadDaily key={entry.asset} entry={entry} today={today} onTutorial={() => setTutorial(true)} />
}

function LoadDaily({ entry, today, onTutorial }: { entry: ScheduledPuzzle; today: string; onTutorial: () => void }) {
  const [loaded, setLoaded] = useState<LetterStrikeEncounter | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${import.meta.env.BASE_URL}${entry.asset}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Download failed'); return response.json() })
      .then(data => { if (!controller.signal.aborted) setLoaded(decodeScheduledPuzzle(data, entry)) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [entry])
  if (error) return <main className="container"><h2>Could not load this puzzle</h2><button className="daily-button" onClick={() => window.location.reload()}>Try again</button><button className="daily-button" onClick={calendar}>Calendar</button></main>
  return loaded ? <DailyAttempt entry={entry} encounter={loaded} today={today} onTutorial={onTutorial} /> : <PuzzleLoading />
}

function DailyAttempt({ entry, encounter, today, onTutorial }: {
  entry: ScheduledPuzzle; encounter: LetterStrikeEncounter; today: string; onTutorial: () => void
}) {
  const [epoch, setEpoch] = useState(0)
  const [stats, setStats] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(() => {
    try { return openChallenge(entry.date, entry.asset, encounter, window.localStorage) }
    catch { return openChallenge(entry.date, entry.asset, encounter, { getItem: () => null }) }
  })
  const current = useRef(session.record)
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== null && event.key !== challengeKey(entry.date)) return
      reload()
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  })
  function reload() {
    try {
      const next = openChallenge(entry.date, entry.asset, encounter, window.localStorage)
      current.current = next.record; setSession(next); setEpoch(value => value + 1); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Saved progress is unavailable.') }
  }
  function restart() {
    try {
      const saved = readChallenge(entry.date, window.localStorage)
      const latest = saved?.asset === entry.asset ? saved : openChallenge(entry.date, entry.asset, encounter, window.localStorage).record
      current.current = restartChallenge(latest, window.localStorage)
      reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Progress could not be saved.') }
  }
  const record = session.record
  const lives = challengeLives(record.bestWords)
  const title = `${entry.date}${entry.date !== today ? ' · earlier daily' : ''}`
  return <>
    <BattleScreen key={epoch} encounter={session.game.encounter} initial={session} title={title} guide={getPuzzleGuide(entry.id)}
      bestStars={challengeStars(record.bestWords)} puzzleDate={entry.date !== today ? entry.date : undefined}
      onSave={(game, started, hintStep) => {
        try {
          const next = saveChallenge(current.current, game, started, window.localStorage, hintStep)
          current.current = next; setSession({ record: next, game, started, hintStep }); setError(''); return true
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Progress could not be saved.'); return false }
      }} onRestart={restart} onExit={() => window.location.assign(`?calendar=${entry.date.slice(0, 7)}`)}
      menu={<>
        <button className="daily-button" onClick={() => setStats(true)}>Statistics</button>
        <button className="daily-button" onClick={onTutorial}>Tutorial</button>
      </>}
      renderBestResult={record.bestWords === null ? undefined : close => <BattleResult
        best={{ enemy: encounter.enemy.word, wordCount: record.bestWords!, solution: challengeBestSolution(record) }}
        onRetry={close} nudge={null} actions={<>
          <DailyShare record={record} />
          <button className="daily-button" onClick={close}>Back to puzzle</button>
        </>} />}
      renderResult={game => <BattleResult game={game} onRetry={restart}
        nudge={lives === 1 ? 'Next challenge: find the one-word win.' : 'Next challenge: solve it with 2 lives.'}
        actions={<>
          <button className="daily-button bingo-result-primary" onClick={restart}>
            {game.status !== 'won' ? 'Try again' : record.bestWords === 1 ? 'Play again' : lives === 1 ? 'Try the bingo' : 'Try 2 lives'}
          </button>
          <DailyShare record={record} />
          <button className="daily-button" onClick={() => setStats(true)}>Statistics</button>
          {!(game.status === 'won' && game.playedWords.length === 1) && <p className="daily-best">{record.bestWords ? `Best: ${'★'.repeat(challengeStars(record.bestWords))} · ${record.bestWords} ${record.bestWords === 1 ? 'word' : 'words'}` : 'Replay as often as you like.'}</p>}
        </>} />}
    />
    {error && <BattlePanel title="Progress could not be saved" onClose={() => setError('')}>
      <p>{error}</p><div className="dev-controls"><button className="daily-button" onClick={reload}>Reload saved attempt</button><button className="daily-button" onClick={restart}>Restart puzzle</button></div>
    </BattlePanel>}
    {stats && <DailyStats onClose={() => setStats(false)} current={record} />}
  </>
}

function DailyShare({ record }: { record: ChallengeRecord }) {
  const [status, setStatus] = useState('')
  const busy = useRef(false)
  const text = challengeShareText(record)
  return <><button className="daily-button" onClick={() => {
    if (busy.current) return
    busy.current = true
    void shareResult(text, navigator).then(result => setStatus(result === 'copied' ? 'Copied' : result === 'manual' ? 'Sharing unavailable' : '')).finally(() => { busy.current = false })
  }}>Share</button>{status && <p role="status">{status}</p>}</>
}
function DailyStats({ onClose, current }: { onClose: () => void; current: ChallengeRecord }) {
  let history: ChallengeRecord[] = []
  try { history = challengeHistory(window.localStorage) } catch { /* Keep this result usable if storage is blocked. */ }
  const solved = history.filter(record => record.bestWords !== null)
  return <BattlePanel title="Statistics" onClose={onClose}>
    <p>{solved.length} solved · {history.length} played</p>
    <div className="daily-star-totals">
      {[3, 2, 1].map(stars => <div key={stars}><span aria-label={`${stars} stars`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span><strong>{solved.filter(record => challengeStars(record.bestWords) === stars).length}</strong></div>)}
    </div>
    <p className="daily-best">Your best result for each day. Replays improve it.</p>
    <ul className="daily-recent">{history.slice(0, 7).map(record => <li key={record.date}><a href={`?daily=${record.date}`}>{record.date}</a><span>{record.bestWords ? '★'.repeat(challengeStars(record.bestWords)) : 'In progress'}</span></li>)}</ul>
    <DailyShare record={current} />
  </BattlePanel>
}
