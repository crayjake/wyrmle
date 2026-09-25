import { useLayoutEffect, useRef, useState } from 'react'
import type { LetterStrikeState } from '../game/letterStrike'
import { describeRefillGroups, getRefillGroups } from './refillSupply'
import type { RefillGroup } from './refillSupply'
import './BattleResources.css'

function MiniLetter({ letter }: { letter: string }) {
  const textRef = useRef<SVGTextElement>(null)
  const [position, setPosition] = useState({ x: 6, y: 14 })
  useLayoutEffect(() => {
    let active = true
    const measure = () => {
      const text = textRef.current
      if (!active || !text) return
      const font = getComputedStyle(text)
      const context = document.createElement('canvas').getContext('2d')
      if (!context) return
      // SVG's text box includes unused ascent/descent, while measurements at
      // mini-tile size round the ink edges to whole pixels. Measure the actual
      // font at a larger size, then centre its visible ink with subpixel accuracy.
      const scale = 64
      context.font = `${font.fontStyle} ${font.fontWeight} ${parseFloat(font.fontSize) * scale}px ${font.fontFamily}`
      context.textAlign = 'left'
      context.textBaseline = 'alphabetic'
      context.direction = 'ltr'
      const ink = context.measureText(letter)
      setPosition({
        x: 10 + (ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / (2 * scale),
        y: 10 + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / (2 * scale),
      })
    }
    measure()
    const text = textRef.current
    if (text) void document.fonts.load(getComputedStyle(text).font, letter).then(measure, measure)
    document.fonts.addEventListener('loadingdone', measure)
    return () => {
      active = false
      document.fonts.removeEventListener('loadingdone', measure)
    }
  }, [letter])
  return <svg viewBox="0 0 20 20" className="refill-letter" aria-hidden="true" focusable="false">
    <text ref={textRef} x={position.x} y={position.y}>{letter}</text>
  </svg>
}

export default function RefillSupply({ game }: { game: LetterStrikeState }) {
  const groups = getRefillGroups(game)
  if (!groups) return null
  return <div className="refill-supply" role="img" aria-label={describeRefillGroups(groups)}>
    {groups.map(group => <RefillCount group={group} key={group.letter ?? 'other'} />)}
    <span className="refill-label" aria-hidden="true">REFILLS</span>
  </div>
}

function RefillCount({ group }: { group: RefillGroup }) {
  return <span className="refill-group" aria-hidden="true">
    <span className={`refill-square${group.letter ? ' refill-known' : ''}`}>
      {group.letter && <MiniLetter letter={group.letter} />}
      <span className="refill-count">{group.count}</span>
    </span>
  </span>
}
