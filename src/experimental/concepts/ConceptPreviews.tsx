import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Share2, Star, X } from 'lucide-react'
import BattleScreen from '../../components/BattleScreen'
import BattleResult from '../../components/BattleResult'
import PuzzleLoading from '../../components/PuzzleLoading'
import BingoHuntIntro from '../../components/BingoHuntIntro'
import type { LetterStrikeEncounter } from '../../game/letterStrike'
import { conceptPath, conceptPreviews, conceptProgressKey, decodeConceptPuzzle } from './catalog'
import type { ConceptEntry } from './catalog'
import { bingoStars, describeBingoProgress, readBingoProgress, restartBingoAttempt, resumeBingoAttempt, saveBingoAttempt } from '../bingo/progress'
import './ConceptPreviews.css'

const base = import.meta.env.BASE_URL
type PreviewGroup = 'antonyms' | 'power' | 'family' | 'hunt'
const entryGroup = (entry?: ConceptEntry): PreviewGroup => entry?.bingoHunt ? 'hunt' : entry?.family ? 'family' : entry?.powers ? 'power' : 'antonyms'

export default function ConceptPreviews() {
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('puzzle'))
  const [group, setGroup] = useState<PreviewGroup>(() => new URLSearchParams(window.location.search).get('mode') === 'hunt'
    ? 'hunt' : entryGroup(conceptPreviews.find(entry => entry.id === selected)))
  const [page, setPage] = useState(0)
  useEffect(() => {
    const sync = () => setSelected(new URLSearchParams(window.location.search).get('puzzle'))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  function navigate(id?: string) {
    window.history.pushState(null, '', conceptPath(id, !id && group === 'hunt'))
    setSelected(id ?? null)
    if (id) setGroup(entryGroup(conceptPreviews.find(entry => entry.id === id)))
  }
  const entry = conceptPreviews.find(item => item.id === selected)
  return entry ? <LoadPreview key={entry.id} entry={entry} onBack={() => navigate()} />
    : <PreviewHub onSelect={navigate} group={group} onGroup={next => { setGroup(next); setPage(0) }} page={page} onPage={setPage} />
}

function PreviewHub({ onSelect, group, onGroup, page, onPage }: { onSelect: (id: string) => void; group: PreviewGroup; onGroup: (group: PreviewGroup) => void; page: number; onPage: (page: number) => void }) {
  const [shareStatus, setShareStatus] = useState('')
  const [, refresh] = useState(0)
  useEffect(() => {
    const sync = () => refresh(value => value + 1)
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  async function share() {
    const url = new URL(conceptPath(undefined, group === 'hunt'), window.location.href).href
    try {
      if (navigator.share) await navigator.share({ title: 'Wyrmle · Concept previews', text: 'Try Wyrmle’s new puzzle ideas. Each has a bingo.', url })
      else { await navigator.clipboard.writeText(url); setShareStatus('Link copied') }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareStatus('Send this page’s address to share.')
    }
  }
  const entries = conceptPreviews.filter(entry => group === 'hunt' ? entry.bingoHunt : !entry.bingoHunt && (group === 'family' ? Boolean(entry.family)
    : !entry.family && Boolean(entry.powers) === (group === 'power')))
  const pages = Math.ceil(entries.length / 2)
  const current = Math.min(page, pages - 1)
  return <main className="container concept-hub">
    <header className="concept-heading"><div><a href={base} className="concept-brand">WYRMLE</a><h1>Concept previews</h1></div>
      <nav aria-label="Preview navigation">
        <button className="icon-button" onClick={() => void share()} aria-label="Share previews" title="Share previews"><Share2 size={20} /></button>
        <a className="icon-button" href={base} aria-label="Back to Daily"><X size={20} /></a>
      </nav></header>
    <p className="concept-intro">{group === 'hunt' ? 'Find the bingo. Simpler antonyms remove spare tiles.' : 'Three lives. Clear every enemy letter. A one-word win is a bingo.'}</p>
    <div className="concept-tabs" role="group" aria-label="Preview rules">
      {([['antonyms', 'Antonyms'], ['hunt', 'Bingo hunt'], ['power', '+ POWER'], ['family', 'One family']] as const).map(([id, label]) =>
        <button key={id} aria-pressed={group === id} onClick={() => onGroup(id)}>{label}</button>)}
    </div>
    <section className="concept-group" aria-labelledby="concept-rule-title">
      <h2 id="concept-rule-title">{group === 'hunt' ? 'One word to win. Three chances.' : group === 'family' ? 'One opposing idea' : group === 'power' ? 'Antonyms + POWER' : 'Same word type. Opposite meaning.'}</h2>
      <p>{group === 'hunt' ? 'Letters stay when you play. Each simpler opposite costs a life and removes spare tiles. On your last life, just the bingo letters remain.' : group === 'family'
        ? 'Every counter belongs to one named family. SEARS keeps verbs against a verb. DIRT uses cleaning verbs against a noun.'
        : 'Find opposites of the meaning shown: adjectives against adjectives, nouns against nouns. Their matching letters hit.'}</p>
      {(group === 'power' || group === 'family') && <p className="concept-extra">Each blue tile in a counter hits one extra enemy letter. Its power is used up.</p>}
      <div className="concept-cards">{entries.slice(current * 2, current * 2 + 2).map(entry => {
        const progress = describeBingoProgress(readBingoProgress(conceptProgressKey(entry)), 3)
        return <button className="concept-card" key={entry.id} data-progress={progress.status}
          onClick={() => onSelect(entry.id)} aria-label={`${entry.enemy}, ${entry.powers ? 'with POWER, ' : ''}${progress.accessible}`}>
          <strong>{entry.enemy}</strong>
          <span className="concept-stars" aria-hidden="true">{[1, 2, 3].map(star => <Star key={star} data-earned={star <= progress.stars} size={16} />)}</span>
          {entry.family && <span className="concept-family">{entry.family}</span>}
          <span className="concept-status">{progress.label}</span>
        </button>
      })}</div>
    </section>
    {pages > 1 && <nav className="concept-pages" aria-label="More preview puzzles">
      <button className="icon-button" aria-label="Previous puzzles" disabled={current === 0} onClick={() => onPage(current - 1)}><ChevronLeft size={20} /></button>
      <span aria-live="polite">{current + 1} / {pages}</span>
      <button className="icon-button" aria-label="Next puzzles" disabled={current === pages - 1} onClick={() => onPage(current + 1)}><ChevronRight size={20} /></button>
    </nav>}
    <p className="concept-common-rule">{group === 'hunt' ? 'Only antonyms count. Other words cost no lives.' : 'Other words do no damage. Every word uses one life.'}</p>
    <footer className="concept-footer">
      <p>Best: ★ 3 words · ★★ 2 · ★★★ bingo<br />Progress stays on this device. Daily is separate.</p>
      <span className="concept-share-status" role="status">{shareStatus}</span>
    </footer>
  </main>
}

function LoadPreview({ entry, onBack }: { entry: ConceptEntry; onBack: () => void }) {
  const [encounter, setEncounter] = useState<LetterStrikeEncounter | null>(null)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${base}${entry.asset}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Download failed'); return response.json() })
      .then(value => { if (!controller.signal.aborted) setEncounter(decodeConceptPuzzle(value, entry)) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [entry, reload])
  if (failed) return <main className="container"><h1>Could not load this preview</h1>
    <button className="daily-button" onClick={() => { setFailed(false); setReload(value => value + 1) }}>Try again</button>
    <button className="daily-button" onClick={onBack}>All previews</button></main>
  return encounter ? <ConceptBattle encounter={encounter} entry={entry} onBack={onBack} /> : <PuzzleLoading />
}

function ConceptBattle({ encounter, entry, onBack }: { encounter: LetterStrikeEncounter; entry: ConceptEntry; onBack: () => void }) {
  const key = conceptProgressKey(entry)
  const [attempt, setAttempt] = useState(0)
  const [best, setBest] = useState(() => readBingoProgress(key).bestWords)
  const [saveError, setSaveError] = useState(false)
  const [initial, setInitial] = useState(() => resumeBingoAttempt(key, encounter))
  const [introSeen, setIntroSeen] = useState(initial.started)
  const restart = () => {
    if (!restartBingoAttempt(key, 3)) { setSaveError(true); return }
    setSaveError(false)
    setInitial(resumeBingoAttempt(key, encounter))
    setIntroSeen(false)
    setAttempt(value => value + 1)
  }
  if (entry.bingoHunt && !introSeen) return <BingoHuntIntro enemy={encounter.enemy} partOfSpeech={entry.counterPartOfSpeech}
    onClose={onBack} closeLabel="All previews" error={saveError ? 'Could not save your progress. Please try again.' : undefined}
    onStart={() => {
      if (!saveBingoAttempt(key, initial.game, true, initial.hintStep)) { setSaveError(true); return }
      setSaveError(false); setIntroSeen(true)
    }} />
  return <BattleScreen key={attempt} encounter={encounter} initial={initial} title="Preview settings" autoBegin={entry.bingoHunt}
    guide={entry.guide} bestStars={best === null ? 0 : bingoStars(best)} onRestart={restart} onExit={onBack} exitLabel="All previews"
    onSave={(game, started, hintStep) => {
      const saved = saveBingoAttempt(key, game, started, hintStep)
      if (game.status === 'won') setBest(current => Math.min(current ?? Infinity, game.playedWords.length))
      return saved
    }}
    notice={<div className="concept-battle-bar">
      <button onClick={onBack}><ArrowLeft size={15} />Previews</button>
      <span>{saveError ? 'Could not save restart' : entry.bingoHunt ? 'Bingo hunt' : entry.family ? `${entry.family} · ${entry.counterPartOfSpeech}s` : entry.powers ? 'Antonyms + POWER' : 'Antonyms'}</span>
    </div>}
    menu={<a className="daily-button" href={base}>Daily puzzle</a>}
    renderBestResult={best === null ? undefined : close => <BattleResult best={{ enemy: entry.enemy, wordCount: best, bingoHunt: entry.bingoHunt }} onRetry={close}
      actions={<button className="daily-button" onClick={close}>Back to puzzle</button>} />}
    renderResult={game => <BattleResult game={game} onRetry={restart} nudge={entry.bingoHunt ? null : undefined} actions={<>
      <button className="daily-button bingo-result-primary" onClick={restart}>{entry.bingoHunt ? 'Restart preview' : game.status === 'won' ? game.playedWords.length === 1 ? 'Play again' : 'Find the bingo' : 'Try again'}</button>
      <button className="daily-button" onClick={onBack}>All previews</button>
    </>} />}
  />
}
