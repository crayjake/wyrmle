import { useEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import WyrmCharacter from '../../components/WyrmCharacter'
import type { LetterStrikeState } from '../../game/letterStrike'
import type { GameState } from '../../game/types'
import { bingoStars } from './progress'

export default function BingoResult({ game, onRetry, onNext, onChoose, onHints }: {
  game: LetterStrikeState | GameState
  onRetry: () => void
  onNext?: () => void
  onChoose?: () => void
  onHints?: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const won = game.status === 'won'
  const words = game.playedWords.length
  const bingo = won && words === 1
  const stars = won ? bingoStars(words) : 0
  return <section className="bingo-result" data-bingo={bingo || undefined} aria-labelledby="bingo-result-title">
    <div className="bingo-result-story">
      <p className="bingo-result-enemy">{game.encounter.enemy.word}</p>
      {won && <div className="bingo-result-stars" role="img" aria-label={`${stars} of 3 stars`}>
        {bingo && <span className="bingo-result-wyrm" aria-hidden="true"><WyrmCharacter idle /></span>}
        {[1, 2, 3].map(star => <Star key={star} aria-hidden="true" data-earned={star <= stars}
          style={{ animationDelay: `${bingo ? 350 + (star - 1) * 500 : star * 100}ms` }} />)}
      </div>}
      <h1 id="bingo-result-title" ref={heading} tabIndex={-1}>{bingo ? 'Bingo!' : won ? 'Solved!' : 'Another try?'}</h1>
      <p className="bingo-result-caption">{bingo ? 'Every letter. One word.' : won ? `Solved in ${words} words.`
        : game.playerResolve === 0 ? 'Out of lives.' : 'No playable words remain.'}</p>
      {bingo ? <p className="bingo-result-word">{game.playedWords[0].word}</p>
        : <ol className="bingo-result-words" aria-label="Your words">
          {game.playedWords.map((move, index) => <li key={index}>{move.word}</li>)}
        </ol>}
      {won && !bingo && <p className="bingo-result-nudge">Can you find the one-word win?</p>}
    </div>
    <div className="bingo-result-actions">
      <button type="button" className="daily-button bingo-result-primary" onClick={bingo ? onNext ?? onChoose ?? onRetry : onRetry}>
        {bingo ? onNext ? 'Next puzzle' : 'All puzzles' : won ? 'Find the bingo' : 'Try again'}
      </button>
      {bingo ? <button type="button" className="daily-button" onClick={onRetry}>Play again</button>
        : won && onNext ? <button type="button" className="daily-button" onClick={onNext}>Next puzzle</button>
          : !won && onHints ? <button type="button" className="daily-button" onClick={onHints}>Get a hint</button> : null}
      {onChoose && (!bingo || onNext) && <button type="button" className="bingo-result-link" onClick={onChoose}>All puzzles</button>}
    </div>
  </section>
}
