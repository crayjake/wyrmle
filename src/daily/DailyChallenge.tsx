import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import BattleScreen, { BattlePanel } from '../components/BattleScreen'
import BattleResult from '../components/BattleResult'
import PuzzleLoading from '../components/PuzzleLoading'
import { ChartNoAxesColumn, GraduationCap, Share2 } from 'lucide-react'
import type { LetterStrikeEncounter } from '../game/letterStrike'
import { useUserPreferences } from '../useUserPreferences'
import { getDailyPuzzleId } from './date'
import { decodeScheduledPuzzle, scheduledPuzzle, puzzleSchedule } from './scheduledPuzzle'
import type { ScheduledPuzzle } from './scheduledPuzzle'
import { challengeBestSolution, challengeHistory, challengeKey, challengeStars, openChallenge, saveChallenge } from './challengeProgress'
import type { ChallengeRecord } from './challengeProgress'
import { shareResult } from './shareResult'
import { challengeShareText } from './scoreShare'
import { puzzleLocation } from './calendar'
import { getPuzzleGuide } from './guides'
import { winStreak } from './streak'
import './DailyChallenge.css'

const TutorialBattle = lazy(() => import('../tutorial/TutorialBattle'))
const PuzzleCalendar = lazy(() => import('./PuzzleCalendar'))
const calendar = () => window.location.assign(`${import.meta.env.BASE_URL}?calendar`)

export default function DailyChallenge() {
  const preferences = useUserPreferences()
  const [tutorial, setTutorial] = useState(!preferences.preferences.hasCompletedOnboarding)
  const [today, setToday] = useState(getDailyPuzzleId)
  const [location] = useState(() => puzzleLocation(window.location.search, window.location.pathname))
  const entry = scheduledPuzzle(location.date && location.date <= today ? location.date : today)
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
  if (tutorial && entry) return <Suspense fallback={<PuzzleLoading />}><TutorialBattle onComplete={finishTutorial} onSkip={finishTutorial} /></Suspense>
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
    return openChallenge(entry.date, entry.asset, encounter, window.localStorage)
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
  const record = session.record
  let streak = 0
  try { streak = winStreak(challengeHistory(window.localStorage), today).current } catch { /* Result remains usable. */ }
  return <>
    <BattleScreen key={epoch} encounter={session.game.encounter} initial={session} guide={getPuzzleGuide(entry.id)}
      completed={record.bestWords !== null || record.run.status === 'lost'}
      bestStars={challengeStars(record.bestWords)} puzzleDate={entry.date !== today ? entry.date : undefined}
      onSave={(game, started) => {
        try {
          const next = saveChallenge(current.current, game, started, window.localStorage)
          current.current = next; setSession({ record: next, game, started, hintStep: next.run.hintStep ?? 1 }); setError(''); return true
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Progress could not be saved.'); return false }
      }} onExit={() => window.location.assign(`?calendar=${entry.date.slice(0, 7)}`)}
      menu={<>
        <button className="settings-shortcut" onClick={() => setStats(true)}><ChartNoAxesColumn aria-hidden="true" /><span>Statistics</span></button>
        <button className="settings-shortcut" onClick={onTutorial}><GraduationCap aria-hidden="true" /><span>Practice</span></button>
      </>}
      renderBestResult={record.bestWords === null ? undefined : close => <BattleResult
        best={{ enemy: encounter.enemy.word, wordCount: record.bestWords!, solution: challengeBestSolution(record) }}
        date={entry.date} actions={<><DailyShare record={record} /><button className="bingo-result-link" onClick={close}>Close</button></>} />}
      renderResult={game => <BattleResult
        {...(record.bestWords !== null ? { best: { enemy: encounter.enemy.word, wordCount: record.bestWords,
          solution: challengeBestSolution(record) } } : { game })}
        date={entry.date} streak={entry.date === today && record.wonOn === record.date ? streak : undefined} answer={getPuzzleGuide(entry.id)}
        actions={<DailyShare record={record} />} />}
    />
    {error && <BattlePanel title="Progress could not be saved" onClose={() => setError('')}>
      <p>{error}</p><div className="dev-controls"><button className="daily-button" onClick={reload}>Reload saved attempt</button></div>
    </BattlePanel>}
    {stats && <DailyStats onClose={() => setStats(false)} current={record} />}

  </>
}

function DailyShare({ record }: { record: ChallengeRecord }) {
  const [status, setStatus] = useState('')
  const busy = useRef(false)
  const text = challengeShareText(record)
  return <><button className="daily-button bingo-result-primary share-button" onClick={() => {
    if (busy.current) return
    busy.current = true
    void shareResult(text, navigator).then(result => setStatus(result === 'copied' ? 'Copied' : result === 'manual' ? 'Sharing unavailable' : '')).finally(() => { busy.current = false })
  }}><Share2 size={18} aria-hidden="true" />Share result</button>{status && <p role="status">{status}</p>}</>
}
function DailyStats({ onClose, current }: { onClose: () => void; current: ChallengeRecord }) {
  let history: ChallengeRecord[] = []
  try { history = challengeHistory(window.localStorage).filter(record => puzzleSchedule.some(entry => entry.date === record.date && entry.asset === record.asset)) } catch { /* Keep this result usable if storage is blocked. */ }
  const streak = winStreak(history, getDailyPuzzleId())
  const solved = history.filter(record => record.bestWords !== null)
  return <BattlePanel title="Statistics" onClose={onClose}>
    <div className="daily-streak-totals"><div><strong>{streak.current}</strong><span>Current streak</span></div><div><strong>{streak.longest}</strong><span>Longest streak</span></div></div>
    <p className="streak-explanation">Win today’s puzzle to keep your streak. Any star counts.</p>
    <p>{solved.length} solved · {history.length} played</p>
    <div className="daily-star-totals">
      {[3, 2, 1].map(stars => <div key={stars}><span aria-label={`${stars} stars`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span><strong>{solved.filter(record => challengeStars(record.bestWords) === stars).length}</strong></div>)}
    </div>
    <p className="daily-best">Your results.</p>
    <ul className="daily-recent">{history.slice(0, 7).map(record => <li key={record.date}><a href={`?daily=${record.date}`}>{record.date}</a><span>{record.bestWords ? '★'.repeat(challengeStars(record.bestWords)) : record.run.status === 'lost' ? 'Unsolved' : 'In progress'}</span></li>)}</ul>
    <DailyShare record={current} />
  </BattlePanel>
}
