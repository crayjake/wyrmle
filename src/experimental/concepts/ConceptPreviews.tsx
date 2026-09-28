import { useEffect, useState } from 'react'
import { ArrowLeft, Share2, Star, X } from 'lucide-react'
import BattleScreen from '../../components/BattleScreen'
import BattleResult from '../../components/BattleResult'
import PuzzleLoading from '../../components/PuzzleLoading'
import type { LetterStrikeEncounter } from '../../game/letterStrike'
import { conceptPath, conceptPreviews, conceptProgressKey, decodeConceptPuzzle } from './catalog'
import type { ConceptEntry } from './catalog'
import { bingoStars, describeBingoProgress, readBingoProgress, restartBingoAttempt, resumeBingoAttempt, saveBingoAttempt } from '../bingo/progress'
import './ConceptPreviews.css'

const base = import.meta.env.BASE_URL
type PreviewGroup = 'antonyms' | 'power' | 'family'
const entryGroup = (entry?: ConceptEntry): PreviewGroup => entry?.family ? 'family' : entry?.powers ? 'power' : 'antonyms'

export default function ConceptPreviews() {
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('puzzle'))
  const [group, setGroup] = useState<PreviewGroup>(() => entryGroup(conceptPreviews.find(entry => entry.id === selected)))
  useEffect(() => {
    const sync = () => setSelected(new URLSearchParams(window.location.search).get('puzzle'))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  function navigate(id?: string) {
    window.history.pushState(null, '', conceptPath(id))
    setSelected(id ?? null)
    if (id) setGroup(entryGroup(conceptPreviews.find(entry => entry.id === id)))
  }
  const entry = conceptPreviews.find(item => item.id === selected)
  return entry ? <LoadPreview key={entry.id} entry={entry} onBack={() => navigate()} />
    : <PreviewHub onSelect={navigate} group={group} onGroup={setGroup} />
}

function PreviewHub({ onSelect, group, onGroup }: { onSelect: (id: string) => void; group: PreviewGroup; onGroup: (group: PreviewGroup) => void }) {
  const [shareStatus, setShareStatus] = useState('')
  const [, refresh] = useState(0)
  useEffect(() => {
    const sync = () => refresh(value => value + 1)
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  async function share() {
    const url = new URL(conceptPath(), window.location.href).href
    try {
      if (navigator.share) await navigator.share({ title: 'Wyrmle · Concept previews', text: 'Try six Wyrmle puzzles: clear opposites and one-family counters. Each has a bingo.', url })
      else { await navigator.clipboard.writeText(url); setShareStatus('Link copied') }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareStatus('Send this page’s address to share.')
    }
  }
  return <main className="container concept-hub">
    <header className="concept-heading"><div><a href={base} className="concept-brand">WYRMLE</a><h1>Concept previews</h1></div>
      <nav aria-label="Preview navigation">
        <button className="icon-button" onClick={() => void share()} aria-label="Share previews" title="Share previews"><Share2 size={20} /></button>
        <a className="icon-button" href={base} aria-label="Back to Daily"><X size={20} /></a>
      </nav></header>
    <p className="concept-intro">Three lives. Clear every enemy letter. A one-word win is a bingo.</p>
    <div className="concept-tabs" role="group" aria-label="Preview rules">
      {([['antonyms', 'Antonyms'], ['power', '+ POWER'], ['family', 'One family']] as const).map(([id, label]) =>
        <button key={id} aria-pressed={group === id} onClick={() => onGroup(id)}>{label}</button>)}
    </div>
    <section className="concept-group" aria-labelledby="concept-rule-title">
      <h2 id="concept-rule-title">{group === 'family' ? 'One opposing idea' : group === 'power' ? 'Antonyms + POWER' : 'Same word type. Opposite meaning.'}</h2>
      <p>{group === 'family'
        ? 'Every counter belongs to one named family. SEARS keeps verbs against a verb. DIRT uses cleaning verbs against a noun.'
        : 'Find opposites of the meaning shown: adjectives against adjectives, nouns against nouns. Their matching letters hit.'}</p>
      {group !== 'antonyms' && <p className="concept-extra">Each blue tile in a counter hits one extra enemy letter. Its power is used up.</p>}
      <div className="concept-cards">{conceptPreviews.filter(entry => group === 'family' ? Boolean(entry.family)
        : !entry.family && Boolean(entry.powers) === (group === 'power')).map(entry => {
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
    <p className="concept-common-rule">Other words do no damage. Every word uses one life.</p>
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
  const restart = () => {
    if (!restartBingoAttempt(key, 3)) { setSaveError(true); return }
    setSaveError(false)
    setInitial(resumeBingoAttempt(key, encounter))
    setAttempt(value => value + 1)
  }
  return <BattleScreen key={attempt} encounter={encounter} initial={initial} title="Preview settings"
    guide={entry.guide} bestStars={best === null ? 0 : bingoStars(best)} onRestart={restart} onExit={onBack} exitLabel="All previews"
    onSave={(game, started, hintStep) => {
      const saved = saveBingoAttempt(key, game, started, hintStep)
      if (game.status === 'won') setBest(current => Math.min(current ?? Infinity, game.playedWords.length))
      return saved
    }}
    notice={<div className="concept-battle-bar">
      <button onClick={onBack}><ArrowLeft size={15} />Previews</button>
      <span>{saveError ? 'Could not save restart' : entry.family ? `${entry.family} · ${entry.counterPartOfSpeech}s` : entry.powers ? 'Antonyms + POWER' : 'Antonyms'}</span>
    </div>}
    menu={<a className="daily-button" href={base}>Daily puzzle</a>}
    renderBestResult={best === null ? undefined : close => <BattleResult best={{ enemy: entry.enemy, wordCount: best }} onRetry={close}
      actions={<button className="daily-button" onClick={close}>Back to puzzle</button>} />}
    renderResult={game => <BattleResult game={game} onRetry={restart} actions={<>
      <button className="daily-button bingo-result-primary" onClick={restart}>{game.status === 'won' ? game.playedWords.length === 1 ? 'Play again' : 'Find the bingo' : 'Try again'}</button>
      <button className="daily-button" onClick={onBack}>All previews</button>
    </>} />}
  />
}
