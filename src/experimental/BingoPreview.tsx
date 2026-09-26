import { useState } from 'react'
import { PlaytestBattle } from './DevCombat'
import { bingoEncounter } from './bingo/puzzle'
import './BingoPreview.css'

export default function BingoPreview() {
  const [attempt, setAttempt] = useState(0)
  function exit() {
    const url = new URL(window.location.href)
    url.searchParams.delete('preview')
    window.location.assign(url.href)
  }
  return <PlaytestBattle key={attempt} mode="letter-strike" encounter={bingoEncounter} bingoPreview
    onMode={() => setAttempt(current => current + 1)} onExit={exit}
    matchHint="off" onMatchHintChange={() => {}} enemyGrid={false} onEnemyGridChange={() => {}} />
}
