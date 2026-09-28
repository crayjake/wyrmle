import { X } from 'lucide-react'
import BingoHuntInstructions from './BingoHuntInstructions'

export default function BingoHuntIntro({ enemy, partOfSpeech, onStart, onClose, closeLabel, error, daily = false }: {
  enemy: { word: string; definition: string }
  partOfSpeech: string
  onStart: () => void
  onClose: () => void
  closeLabel: string
  error?: string
  daily?: boolean
}) {
  return <main className="container hunt-intro">
    <header className="hunt-intro-heading"><h1>Find the bingo</h1>
      <button className="icon-button" aria-label={closeLabel} onClick={onClose}><X size={20} /></button></header>
    <div className="hunt-intro-enemy"><strong>{enemy.word}</strong><span>{enemy.definition} · {partOfSpeech}</span></div>
    <BingoHuntInstructions partOfSpeech={partOfSpeech} daily={daily} />
    {error && <p role="alert">{error}</p>}
    <button className="daily-button bingo-result-primary" onClick={onStart}>{daily ? 'Play daily' : 'Play puzzle'}</button>
  </main>
}
