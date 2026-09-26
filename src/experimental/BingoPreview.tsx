import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PlaytestBattle } from './DevCombat'
import type { LetterStrikeEncounter } from '../game/letterStrike'
import { bingoPreviews, bingoPreviewHref, leaveBingoPreviewHref } from './bingo/catalog'
import type { BingoPreviewEntry, BingoPreviewRequest, PreviewLives } from './bingo/catalog'
import { decodeBingoPreview } from './bingo/previewData'
import { getBingoGuide } from './bingo/guides'
import './BingoPreview.css'

const exit = () => window.location.assign(leaveBingoPreviewHref(window.location.href))

export default function BingoPreview({ request }: { request: BingoPreviewRequest }) {
  if (request.id === 'bingos') return <PreviewLibrary lives={request.lives} />
  const entry = bingoPreviews.find(entry => entry.id === request.id)
  if (request.id !== 'bingo' && !entry) return <PreviewLibrary lives={request.lives} missing />
  return <PreviewPuzzle key={`${request.id}:${request.lives}`} entry={entry} request={request} />
}

function PreviewFrame({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="container bingo-library">
    <h1>{title}</h1>
    {children}
    <div className="bingo-library-footer">
      {footer}
      <button className="daily-button" onClick={exit}>Back to daily</button>
    </div>
  </main>
}

function PreviewLibrary({ lives, missing = false }: { lives: PreviewLives; missing?: boolean }) {
  const [selectedLives, setSelectedLives] = useState(lives)
  const [collection, setCollection] = useState(() => new URLSearchParams(window.location.search).get('set') === 'earlier' ? 'earlier' : 'new')
  const hasNew = bingoPreviews.some(entry => entry.collection === 'new')
  const entries = hasNew ? bingoPreviews.filter(entry => (entry.collection === 'new') === (collection === 'new')) : bingoPreviews
  function libraryHref(nextLives: PreviewLives, nextCollection: string) {
    return `${bingoPreviewHref('bingos', nextLives)}${nextCollection === 'earlier' ? '&set=earlier' : ''}`
  }
  return <PreviewFrame title="Bingo previews" footer={
    <a className="daily-button" href={bingoPreviewHref('bingo', selectedLives)} aria-label="Original CHAOS preview">Original CHAOS</a>
  }>
    <p role={missing ? 'status' : undefined}>{missing
      ? 'Preview not found. Choose a draft puzzle below.'
      : 'Draft meanings. Daily progress stays saved.'}</p>
    <label className="bingo-lives-select">Starting lives
      <select value={selectedLives} onChange={event => {
        const next = Number(event.target.value) as PreviewLives
        setSelectedLives(next)
        window.history.replaceState(null, '', libraryHref(next, collection))
      }}>
        {[3, 4, 5].map(value => <option key={value} value={value}>{value} lives</option>)}
      </select>
    </label>
    {hasNew && <div className="bingo-collections" aria-label="Puzzle collection">
      {(['new', 'earlier'] as const).map(value => <button className="daily-button" key={value} aria-pressed={collection === value}
        onClick={() => { setCollection(value); window.history.replaceState(null, '', libraryHref(selectedLives, value)) }}>
        {value === 'new' ? 'Five new puzzles' : 'Earlier variants'}
      </button>)}
    </div>}
    <ul className="bingo-preview-list">
      {entries.map(entry => <li key={entry.id}>
        <a href={bingoPreviewHref(entry.id, selectedLives)}>
          <strong>{entry.title}</strong><span>{entry.enemyHP} enemy hits</span>
        </a>
      </li>)}
    </ul>
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
    previewName={title} bingoGuide={getBingoGuide(request.id)} onChoosePreview={() => window.location.assign(
      `${bingoPreviewHref('bingos', request.lives)}${entry?.collection === 'new' ? '' : '&set=earlier'}`)}
    onMode={() => setAttempt(current => current + 1)} onExit={exit}
    matchHint="off" onMatchHintChange={() => {}} enemyGrid={false} onEnemyGridChange={() => {}} />
}
