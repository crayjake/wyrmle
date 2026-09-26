import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PlaytestBattle } from './DevCombat'
import type { LetterStrikeEncounter } from '../game/letterStrike'
import { bingoPreviews, bingoPreviewHref, leaveBingoPreviewHref } from './bingo/catalog'
import type { BingoPreviewEntry, BingoPreviewRequest, PreviewLives } from './bingo/catalog'
import { decodeBingoPreview } from './bingo/previewData'
import './BingoPreview.css'

const exit = () => window.location.assign(leaveBingoPreviewHref(window.location.href))

export default function BingoPreview({ request }: { request: BingoPreviewRequest }) {
  if (request.id === 'bingos') return <PreviewLibrary lives={request.lives} />
  const entry = bingoPreviews.find(entry => entry.id === request.id)
  if (request.id !== 'bingo' && !entry) return <PreviewLibrary lives={request.lives} missing />
  return <PreviewPuzzle key={`${request.id}:${request.lives}`} entry={entry} request={request} />
}

function PreviewFrame({ title, children }: { title: string; children: ReactNode }) {
  return <main className="container bingo-library">
    <h1>{title}</h1>
    {children}
    <button className="daily-button" onClick={exit}>Back to daily</button>
  </main>
}

function PreviewLibrary({ lives, missing = false }: { lives: PreviewLives; missing?: boolean }) {
  const [selectedLives, setSelectedLives] = useState(lives)
  return <PreviewFrame title="Bingo previews">
    {missing && <p role="status">That preview was not found. Choose a puzzle below.</p>}
    <p>Find the hidden one-word win, or take another route. These draft puzzles are still having their meanings reviewed. Practice never changes your daily progress or stats.</p>
    <label className="bingo-lives-select">Starting lives
      <select value={selectedLives} onChange={event => {
        const next = Number(event.target.value) as PreviewLives
        setSelectedLives(next)
        window.history.replaceState(null, '', bingoPreviewHref('bingos', next))
      }}>
        {[3, 4, 5].map(value => <option key={value} value={value}>{value} lives</option>)}
      </select>
    </label>
    <ul className="bingo-preview-list">
      {bingoPreviews.map(entry => <li key={entry.id}>
        <a href={bingoPreviewHref(entry.id, selectedLives)}>
          <strong>{entry.title}</strong><span>{entry.enemyHP} enemy hits · {selectedLives} lives</span>
        </a>
      </li>)}
    </ul>
    <a className="bingo-original-link" href={bingoPreviewHref('bingo', selectedLives)}>Original CHAOS preview</a>
  </PreviewFrame>
}

function PreviewPuzzle({ entry, request }: { entry?: BingoPreviewEntry; request: BingoPreviewRequest }) {
  const [loaded, setLoaded] = useState<{ encounter: LetterStrikeEncounter } | { error: true } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const title = entry?.title ?? 'Original CHAOS'
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      if (!entry) {
        const { bingoEncounter } = await import('./bingo/puzzle')
        return { ...bingoEncounter, startingResolve: request.lives }
      }
      const response = await fetch(`${import.meta.env.BASE_URL}${entry.asset}`, { signal: controller.signal })
      if (!response.ok) throw new Error('Preview download failed.')
      return decodeBingoPreview(await response.json(), entry, request.lives)
    }
    void load().then(encounter => {
      if (!controller.signal.aborted) setLoaded({ encounter })
    }).catch(() => {
      if (!controller.signal.aborted) setLoaded({ error: true })
    })
    return () => controller.abort()
  }, [entry, request.lives])

  if (!loaded || 'error' in loaded) return <PreviewFrame title={title}>
    <p role="status">{loaded ? 'Could not load this preview. Try again or choose another puzzle.' : 'Loading puzzle…'}</p>
    {loaded && <button className="daily-button" onClick={() => window.location.reload()}>Try again</button>}
    <a href={bingoPreviewHref('bingos', request.lives)}>Choose a puzzle</a>
  </PreviewFrame>

  return <PlaytestBattle key={attempt} mode="letter-strike" encounter={loaded.encounter} bingoPreview
    previewName={title} onChoosePreview={() => window.location.assign(bingoPreviewHref('bingos', request.lives))}
    onMode={() => setAttempt(current => current + 1)} onExit={exit}
    matchHint="off" onMatchHintChange={() => {}} enemyGrid={false} onEnemyGridChange={() => {}} />
}
