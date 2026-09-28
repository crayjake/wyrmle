import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import BingoStars from './BingoStars'
import type { LetterStrikeState } from '../game/letterStrike'
import { winStars } from '../game/rating'

type ResultSource = { game: LetterStrikeState; best?: never } | {
  game?: never
  best: { enemy: string; wordCount: number; solution?: string[]; bingoHunt?: boolean }
}

export default function BattleResult({ game, best, onRetry, onNext, onChoose, onHints, actions, nudge, allowRetry = true }: ResultSource & {
  onRetry: () => void
  onNext?: () => void
  onChoose?: () => void
  onHints?: () => void
  actions?: ReactNode
  nudge?: string | null
  allowRetry?: boolean
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const won = best !== undefined || game.status === 'won'
  const words = best?.wordCount ?? game!.playedWords.length
  const solution = best ? best.solution : game.playedWords.map(move => move.word)
  const bingo = won && words === 1
  const hunt = Boolean(best?.bingoHunt ?? game?.encounter.bingoHunt)
  const stars = won ? winStars(words) : 0
  return <section className="bingo-result" data-bingo={bingo || undefined} aria-labelledby="bingo-result-title">
    <div className="bingo-result-story">
      <p className="bingo-result-enemy">{best?.enemy ?? game!.encounter.enemy.word}</p>
      {won && (bingo ? <BingoStars /> : <div className="bingo-result-stars" role="img" aria-label={`${stars} of 3 stars`}>
        {[1, 2, 3].map(star => <Star key={star} aria-hidden="true" data-earned={star <= stars}
          style={{ animationDelay: `${star * 100}ms` }} />)}
      </div>)}
      <h1 id="bingo-result-title" ref={heading} tabIndex={-1}>{bingo ? 'Bingo!' : won ? hunt ? 'Bingo found!' : 'Solved!' : allowRetry ? 'Another try?' : 'Out of lives'}</h1>
      <p className="bingo-result-caption">{bingo ? 'Every letter. One word.' : won ? hunt ? `Found in ${words} guesses.` : `Solved in ${words} words.`
        : game?.playerResolve === 0 ? 'Out of lives.' : 'No playable words remain.'}</p>
      {solution?.length ? bingo ? <p className="bingo-result-word">{solution[0]}</p>
        : <ol className="bingo-result-words" aria-label="Your words">
          {solution.map((word, index) => <li key={index}>{word}</li>)}
        </ol> : null}
      {won && !bingo && !hunt && nudge !== null && <p className="bingo-result-nudge">{nudge ?? 'Can you find the one-word win?'}</p>}
    </div>
    <div className="bingo-result-actions">
      {actions ?? <>
      <button type="button" className="daily-button bingo-result-primary" onClick={bingo ? onNext ?? onChoose ?? onRetry : onRetry}>
        {bingo ? onNext ? 'Next puzzle' : 'All puzzles' : won ? 'Find the bingo' : 'Try again'}
      </button>
      {bingo ? <button type="button" className="daily-button" onClick={onRetry}>Play again</button>
        : won && onNext ? <button type="button" className="daily-button" onClick={onNext}>Next puzzle</button>
          : !won && onHints ? <button type="button" className="daily-button" onClick={onHints}>Get a hint</button> : null}
      {onChoose && (!bingo || onNext) && <button type="button" className="bingo-result-link" onClick={onChoose}>All puzzles</button>}
      </>}
    </div>
  </section>
}
