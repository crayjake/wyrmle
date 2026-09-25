import { useEffect, useState } from 'react'
import type { LetterStrikeState } from '../game/letterStrike'
import { describeRefillGroups, getRefillGroups } from './refillSupply'
import type { RefillGroup } from './refillSupply'
import './BattleResources.css'

function MiniLetter({ letter }: { letter: string }) {
  const [position, setPosition] = useState({ x: 8, y: 11.5 })
  useEffect(() => {
    let active = true
    // Font advance boxes have unequal side bearings. Position the visible ink,
    // using the same loaded font as the main tiles, inside the 16px square.
    void document.fonts.ready.then(() => {
      const context = document.createElement('canvas').getContext('2d')
      if (!active || !context) return
      context.font = '13px "Cutive Mono", monospace'
      const ink = context.measureText(letter)
      setPosition({
        x: 8 + (ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / 2,
        y: 8 + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2,
      })
    })
    return () => { active = false }
  }, [letter])
  return <svg viewBox="0 0 16 16" className="refill-letter" aria-hidden="true" focusable="false">
    <text x={position.x} y={position.y}>{letter}</text>
  </svg>
}

export default function RefillSupply({ game }: { game: LetterStrikeState }) {
  const groups = getRefillGroups(game)
  if (!groups) return null
  return <div className="refill-supply" role="img" aria-label={describeRefillGroups(groups)}>
    {groups.slice(0, -1).map(group => <RefillCount group={group} key={group.letter ?? 'other'} />)}
    <span className="refill-end">
      <RefillCount group={groups.at(-1)!} />
      <span className="refill-label" aria-hidden="true">REFILLS</span>
    </span>
  </div>
}

function RefillCount({ group }: { group: RefillGroup }) {
  return <span className="refill-group" aria-hidden="true">
    <span className={`refill-square${group.letter ? ' refill-known' : ''}`}>
      {group.letter && <MiniLetter letter={group.letter} />}
    </span>
    {(group.letter === null || group.count !== 1) && <span className="refill-multiplier">×{group.count}</span>}
  </span>
}
