import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import BattleScreen from '../components/BattleScreen'
import type { LetterStrikeEncounter } from '../game/letterStrike'
import { bingoPreviews, bingoPreviewHref, leaveBingoPreviewHref } from './bingo/catalog'
import type { BingoPreviewEntry, BingoPreviewRequest } from './bingo/catalog'
import { decodeBingoPreview } from './bingo/previewData'
import { getBingoGuide } from './bingo/guides'
import { BINGO_PROGRESS_PREFIX, bingoProgressKey, describeBingoProgress, readBingoProgress, restartBingoAttempt, resumeBingoAttempt, saveBingoAttempt } from './bingo/progress'
import './BingoPreview.css'

const exit = () => window.location.assign(leaveBingoPreviewHref(window.location.href))
const readProgress = () => Object.fromEntries([
  ...bingoPreviews.map(entry => [entry.id, readBingoProgress(bingoProgressKey(entry))]),
])

export default function BingoPreview({ request }: { request: BingoPreviewRequest }) {
  if (request.id === 'bingos') return <PreviewLibrary />
  const entry = bingoPreviews.find(entry => entry.id === request.id)
  if (!entry) return <PreviewLibrary missing />
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

function PreviewLibrary({ missing = false }: { missing?: boolean }) {
  const [progress, setProgress] = useState(readProgress)
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(BINGO_PROGRESS_PREFIX)) setProgress(readProgress())
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])
  return <PreviewFrame title="Bingo previews">
    <p role={missing ? 'status' : undefined}>{missing
      ? 'Preview not found. Choose a draft puzzle below.'
      : 'Best win: ★★★ bingo · ★★ 2 words · ★ 3 words'}</p>
    <ul className="bingo-preview-list">
      {bingoPreviews.map(entry => {
        const summary = describeBingoProgress(progress[entry.id], 3)
        return <li key={entry.id}>
          <a href={bingoPreviewHref(entry.id)} data-progress={summary.status} aria-label={`${entry.title}, ${summary.accessible}`}>
            <strong>{entry.title}</strong><ProgressBadge progress={summary} />
          </a>
        </li>
      })}
    </ul>
  </PreviewFrame>
}

function ProgressBadge({ progress }: { progress: ReturnType<typeof describeBingoProgress> }) {
  return <span className="bingo-progress" aria-hidden="true">
    {progress.stars > 0 && <span className="bingo-progress-stars" aria-hidden="true">{'★'.repeat(progress.stars)}{'☆'.repeat(3 - progress.stars)}</span>}
    <span aria-hidden="true">{progress.label}</span>
  </span>
}

function PreviewPuzzle({ entry, request }: { entry: BingoPreviewEntry; request: BingoPreviewRequest }) {
  const [loaded, setLoaded] = useState<{ encounter: LetterStrikeEncounter } | { error: true } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const title = entry.title
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
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

  const next = bingoPreviews[bingoPreviews.findIndex(candidate => candidate.id === request.id) + 1]
  const progressKey = bingoProgressKey(entry)
  return <BattleScreen key={attempt} encounter={loaded.encounter}
    initial={attempt === 0 ? resumeBingoAttempt(progressKey, loaded.encounter) : undefined}
    onSave={(game, started, step) => saveBingoAttempt(progressKey, game, started, step)}
    title={title} guide={getBingoGuide(request.id)} onChoose={() => window.location.assign(
      bingoPreviewHref('bingos', request.lives))}
    onNext={next ? () => window.location.assign(bingoPreviewHref(next.id, request.lives)) : undefined}
    onRestart={() => { restartBingoAttempt(progressKey, request.lives); setAttempt(current => current + 1) }} onExit={exit} />
}
