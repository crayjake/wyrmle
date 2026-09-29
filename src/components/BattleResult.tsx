import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import BingoStars from './BingoStars'
import type { LetterStrikeState } from '../game/letterStrike'
import { winStars } from '../game/rating'

type ResultSource = { game: LetterStrikeState; best?: never } | {
  game?: never
  best: { enemy: string; wordCount: number; solution?: string[] }
}

/** The same saved result is shown immediately and whenever the puzzle is reopened. */
export default function BattleResult({ game, best, actions, date, answer, streak }: ResultSource & {
  actions: ReactNode
  date?: string
  streak?: number
  answer?: { answer: string; explanation: string }
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const won = best !== undefined || game.status === 'won'
  const words = best?.wordCount ?? game!.playedWords.length
  const solution = best ? best.solution : game.playedWords.map(move => move.word)
  const bingo = won && words === 1
  const stars = won ? winStars(words) : 0
  const winningWord = won ? solution?.at(-1) : revealed ? answer?.answer : undefined
  return <section className="bingo-result" data-bingo={bingo || undefined} aria-labelledby="bingo-result-title">
    <div className="bingo-result-story">
      {date && <time className="result-date resource-label" dateTime={date}>{new Intl.DateTimeFormat('en-GB', {
        day: 'numeric', month: 'long', timeZone: 'UTC',
      }).format(new Date(`${date}T00:00:00Z`))}</time>}
      {bingo ? <BingoStars /> : <div className="bingo-result-stars" role="img" aria-label={`${stars} of 3 stars`}>
        {[1, 2, 3].map(star => <Star key={star} aria-hidden="true" data-earned={star <= stars}
          style={{ animationDelay: `${star * 120}ms` }} />)}
      </div>}
      <h1 id="bingo-result-title" ref={heading} tabIndex={-1}>{bingo ? 'Bingo!' : won ? 'Found it.' : 'So close.'}</h1>
      <p className="bingo-result-caption">{bingo ? 'Straight there. One word.' : won ? `You found it in ${words} guesses.` : 'No lives left for this puzzle.'}</p>
      <div className="result-word-pair">
        <p className="bingo-result-enemy">{best?.enemy ?? game!.encounter.enemy.word}</p>
        <span className="result-connector" aria-hidden="true" />
        {winningWord ? <p className="bingo-result-word">{winningWord}</p>
          : !won && answer ? <button className="bingo-result-link" onClick={() => setRevealed(true)}>Reveal the answer</button>
            : <p className="bingo-result-caption">{won ? 'Puzzle complete' : 'Attempt complete'}</p>}
      </div>
      {solution && solution.length > (won ? 1 : 0) && <ol className="bingo-result-words" aria-label="Earlier guesses">
        {(won ? solution.slice(0, -1) : solution).map((word, index) => <li key={index}><span>{index + 1}</span>{word}</li>)}
      </ol>}
      {Boolean(streak) && <p className="result-streak">{streak} DAY WIN STREAK</p>}
    </div>
    <div className="bingo-result-actions">{actions}</div>
  </section>
}
