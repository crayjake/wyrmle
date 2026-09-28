import { useEffect, useMemo, useState } from 'react'
import { Circle, Square, X } from 'lucide-react'
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
  const [layout, setLayout] = useState<'grid' | 'wheel' | 'ring'>(() => {
    const value = new URLSearchParams(window.location.search).get('layout')
    return value === 'single' ? 'ring' : value === 'grid' ? 'grid' : 'wheel'
  })
  const [shape, setShape] = useState<'square' | 'circle'>(() =>
    new URLSearchParams(window.location.search).get('tiles') === 'circle' ? 'circle' : 'square')
  const [attempt, setAttempt] = useState(0)
  const initial = useMemo(() => ({ game: createLetterStrikeGame(encounter), started: true }), [encounter])
  const restart = () => setAttempt(value => value + 1)
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('layout', layout === 'ring' ? 'single' : layout === 'wheel' ? 'double' : 'grid')
    url.searchParams.set('tiles', shape)
    window.history.replaceState(null, '', url)
  }, [layout, shape])
  return <BattleScreen key={attempt} encounter={encounter} initial={initial} boardLayout={layout} tileShape={shape}
    title="Anagram wheel preview" onSave={() => true} onRestart={restart}
    onExit={() => window.location.assign(`${dailyUrl}?calendar`)}
    notice={<div className="wheel-preview-bar">
      <div className="wheel-layout-switch" role="group" aria-label="Letter layout">
        {([{ value: 'grid', label: 'Grid' }, { value: 'wheel', label: '2 rings' }, { value: 'ring', label: '1 ring' }] as const)
          .map(({ value, label }) => <button key={value} type="button" aria-pressed={layout === value}
            onClick={() => setLayout(value)}>{label}</button>)}
      </div>
      <button type="button" className="icon-button wheel-shape-toggle" aria-pressed={shape === 'circle'}
        aria-label={shape === 'circle' ? 'Use square tiles' : 'Use circular tiles'} title={shape === 'circle' ? 'Use square tiles' : 'Use circular tiles'}
        onClick={() => setShape(value => value === 'square' ? 'circle' : 'square')}>
        {shape === 'circle' ? <Square size={20} /> : <Circle size={20} />}
      </button>
      <a className="icon-button" href={dailyUrl} aria-label="Close preview"><X size={18} /></a>
    </div>}
    menu={<p className="wheel-preview-note">Practice on the FURY board. Preview attempts don’t affect your daily progress.</p>}
    renderResult={game => <BattleResult game={game} onRetry={restart} nudge={null} actions={<>
      <button className="daily-button bingo-result-primary" onClick={restart}>Play again</button>
      <a className="daily-button" href={dailyUrl}>Daily puzzle</a>
    </>} />}
  />
}
