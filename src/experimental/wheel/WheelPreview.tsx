import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import BattleScreen from '../../components/BattleScreen'
import BattleResult from '../../components/BattleResult'
import PuzzleLoading from '../../components/PuzzleLoading'
import { createLetterStrikeGame } from '../../game/letterStrike'
import type { LetterStrikeEncounter } from '../../game/letterStrike'
import { decodeScheduledPuzzle, scheduledPuzzle } from '../../daily/scheduledPuzzle'
import './WheelPreview.css'

// A fixed, published board makes the two layouts directly comparable.
const entry = scheduledPuzzle('2026-09-28')!
const dailyUrl = import.meta.env.BASE_URL

export default function WheelPreview() {
  const [encounter, setEncounter] = useState<LetterStrikeEncounter | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${dailyUrl}${entry.asset}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Download failed'); return response.json() })
      .then(data => { if (!controller.signal.aborted) setEncounter(decodeScheduledPuzzle(data, entry)) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [])
  if (error) return <main className="container"><h2>Could not load the preview</h2>
    <button className="daily-button" onClick={() => window.location.reload()}>Try again</button>
    <a href={dailyUrl}>Daily puzzle</a></main>
  return encounter ? <PreviewBattle encounter={encounter} /> : <PuzzleLoading />
}

function PreviewBattle({ encounter }: { encounter: LetterStrikeEncounter }) {
  const [layout, setLayout] = useState<'grid' | 'wheel'>('wheel')
  const [attempt, setAttempt] = useState(0)
  const initial = useMemo(() => ({ game: createLetterStrikeGame(encounter), started: true }), [encounter])
  const restart = () => setAttempt(value => value + 1)
  return <BattleScreen key={attempt} encounter={encounter} initial={initial} boardLayout={layout}
    title="Anagram wheel preview" onSave={() => true} onRestart={restart}
    onExit={() => window.location.assign(`${dailyUrl}?calendar`)}
    notice={<div className="wheel-preview-bar">
      <span className="resource-label">PREVIEW</span>
      <div className="wheel-layout-switch" role="group" aria-label="Letter layout">
        {(['wheel', 'grid'] as const).map(value => <button key={value} type="button" aria-pressed={layout === value}
          onClick={() => setLayout(value)}>{value}</button>)}
      </div>
      <a className="icon-button" href={dailyUrl} aria-label="Close preview"><X size={18} /></a>
    </div>}
    menu={<p className="wheel-preview-note">Practice on the FURY board. Preview attempts don’t affect your daily progress.</p>}
    renderResult={game => <BattleResult game={game} onRetry={restart} nudge={null} actions={<>
      <button className="daily-button bingo-result-primary" onClick={restart}>Play again</button>
      <a className="daily-button" href={dailyUrl}>Daily puzzle</a>
    </>} />}
  />
}
