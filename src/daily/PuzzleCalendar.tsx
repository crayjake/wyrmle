import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { availableMonths, calendarDays } from './calendar'
import { puzzleSchedule } from './scheduledPuzzle'
import { challengeStars, readChallenge, CHALLENGE_PREFIX } from './challengeProgress'
import './PuzzleCalendar.css'

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const describeDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

export default function PuzzleCalendar({ today, requestedMonth }: { today: string; requestedMonth: string | null }) {
  const months = availableMonths(today)
  const [month, setMonth] = useState(months.includes(requestedMonth ?? '') ? requestedMonth! : months.at(-1) ?? today.slice(0, 7))
  const [, refresh] = useState(0)
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (!event.key || event.key.startsWith(CHALLENGE_PREFIX)) refresh(n => n + 1) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const index = months.indexOf(month)
  function changeMonth(next: string) { setMonth(next); window.history.replaceState(null, '', `?calendar=${next}`) }
  const dates = calendarDays(month)
  return <main className="container puzzle-calendar">
    <header className="calendar-heading"><h1>Puzzles</h1><a className="daily-button" href={import.meta.env.BASE_URL}>Back to daily</a></header>
    <nav className="calendar-month" aria-label="Choose month">
      <button className="icon-button" aria-label="Previous month" disabled={index <= 0} onClick={() => changeMonth(months[index - 1])}><ChevronLeft size={22} /></button>
      <h2 aria-live="polite">{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))}</h2>
      <button className="icon-button" aria-label="Next month" disabled={index < 0 || index >= months.length - 1} onClick={() => changeMonth(months[index + 1])}><ChevronRight size={22} /></button>
    </nav>
    <section className="calendar-body" aria-label="Puzzle dates">
    <div className="calendar-weekdays" aria-hidden="true">{dayNames.map(day => <span key={day}>{day}</span>)}</div>
    <div className="calendar-days" style={{ gridTemplateRows: `repeat(${dates.length / 7}, minmax(0, 1fr))`, aspectRatio: `7 / ${dates.length / 7}` }}>
      {dates.map((date, i) => {
        if (!date) return <span key={`empty-${i}`} aria-hidden="true" />
        const entry = puzzleSchedule.find(entry => entry.date === date)
        const available = Boolean(entry && date <= today)
        let record = null
        try { record = available ? readChallenge(date, window.localStorage) : null } catch { /* Calendar remains usable without storage. */ }
        if (record?.asset !== entry?.asset) record = null
        const stars = challengeStars(record?.bestWords ?? null)
        const started = Boolean(record?.run.started)
        const status = stars ? `${stars} of 3 stars` : started ? record?.run.status === 'lost' ? 'Try again' : 'In progress' : 'Not played'
        const content = <><span className="calendar-day-number">{Number(date.slice(-2))}</span>
          <span className="calendar-day-stars" aria-hidden="true">{stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : started ? '·' : '\u00a0'}</span></>
        return available ? <a key={date} className="calendar-day" href={`?daily=${date}`} data-date={date} data-stars={stars}
          data-started={started || undefined} aria-current={date === today ? 'date' : undefined}
          aria-label={`${describeDate(date)}${date === today ? ', Today' : ''}, ${status}`}>{content}</a>
          : <span key={date} className="calendar-day is-unavailable" aria-label={`${describeDate(date)}, unavailable`}>{content}</span>
      })}
    </div>
    </section>
    <footer className="calendar-key"><span>★ 3 words</span><span>★★ 2 words</span><span>★★★ Bingo</span></footer>
  </main>
}
