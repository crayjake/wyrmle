import { useReducedMotion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LetterStrikeState } from '../game/letterStrike'
import { introTimings } from '../intro/config'
import { describeRefillGroups, getRefillGroups } from './refillSupply'
import type { RefillGroup } from './refillSupply'
import './BattleResources.css'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@'
const letterPositions = new Map<string, { x: number; y: number }>()
let measuringContext: CanvasRenderingContext2D | null = null

function scrambleLetters(count: number) {
  return Array.from({ length: count }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
}

function MiniLetter({ letter, fontRevision }: { letter: string; fontRevision: number }) {
  const textRef = useRef<SVGTextElement>(null)
  const [position, setPosition] = useState({ x: 6, y: 13.2 })
  useLayoutEffect(() => {
    const text = textRef.current
    if (!text) return
    const font = getComputedStyle(text)
    const key = `${fontRevision}:${font.font}:${letter}`
    let measured = letterPositions.get(key)
    if (!measured) {
      measuringContext ??= document.createElement('canvas').getContext('2d')
      if (!measuringContext) return
      // Measure enlarged glyph ink to retain subpixel accuracy at this size.
      // Keep it a little above geometric centre for the small tile's optical
      // balance. Reuse both canvas and metrics while the letters scramble.
      const scale = 64
      measuringContext.font = `${font.fontStyle} ${font.fontWeight} ${parseFloat(font.fontSize) * scale}px ${font.fontFamily}`
      measuringContext.textAlign = 'left'
      measuringContext.textBaseline = 'alphabetic'
      measuringContext.direction = 'ltr'
      const ink = measuringContext.measureText(letter)
      measured = {
        x: 10 + (ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / (2 * scale),
        y: 9.2 + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / (2 * scale),
      }
      letterPositions.set(key, measured)
    }
    setPosition(measured)
  }, [letter, fontRevision])
  return <svg viewBox="0 0 20 20" className="refill-letter" aria-hidden="true" focusable="false">
    <text ref={textRef} x={position.x} y={position.y}>{letter}</text>
  </svg>
}

export default function RefillSupply({ game, decoded = true }: { game: LetterStrikeState; decoded?: boolean }) {
  const groups = getRefillGroups(game)
  const groupCount = groups?.length ?? 0
  const reducedMotion = useReducedMotion()
  const [displayLetters, setDisplayLetters] = useState(() => scrambleLetters(groupCount))
  const [fontRevision, setFontRevision] = useState(0)

  useEffect(() => {
    let active = true
    const refresh = () => {
      if (active) setFontRevision(revision => revision + 1)
    }
    void document.fonts.load('14px "Cutive Mono"', GLYPHS).then(refresh, refresh)
    document.fonts.addEventListener('loadingdone', refresh)
    return () => {
      active = false
      document.fonts.removeEventListener('loadingdone', refresh)
    }
  }, [])

  useEffect(() => {
    if (decoded || reducedMotion || !groupCount) return
    const interval = window.setInterval(() => setDisplayLetters(scrambleLetters(groupCount)), introTimings.tileScrambleMs)
    return () => window.clearInterval(interval)
  }, [decoded, reducedMotion, groupCount])

  if (!groups) return null
  return <div className="refill-supply" role="img" aria-label={decoded ? describeRefillGroups(groups) : 'Refills are decoding.'}>
    <span className="resource-label refill-label" aria-hidden="true">REFILLS</span>
    <span className="refill-tiles" aria-hidden="true">
      {groups.map((group, index) => <RefillCount key={group.letter ?? 'other'}
        letter={decoded ? group.letter : reducedMotion ? '?' : displayLetters[index] ?? '?'}
        count={decoded ? group.count : '?'} fontRevision={fontRevision} />)}
    </span>
  </div>
}

function RefillCount({ letter, count, fontRevision }: { letter: RefillGroup['letter']; count: number | '?'; fontRevision: number }) {
  return <span className="refill-group" aria-hidden="true">
    <span className={`refill-square${letter ? ' refill-known' : ''}`}>
      {letter && <MiniLetter letter={letter} fontRevision={fontRevision} />}
      <span className="refill-count">{count}</span>
    </span>
  </span>
}
