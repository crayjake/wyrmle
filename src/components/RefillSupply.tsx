import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LetterStrikeState } from '../game/letterStrike'
import { introTimings } from '../intro/config'
import { describeRefillGroups, getRefillGroups } from './refillSupply'
import type { RefillGroup } from './refillSupply'
import './BattleResources.css'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@'
type LetterPosition = { x: number; y: number }
const letterPositions = new Map<string, ReadonlyMap<string, LetterPosition>>()
const fallbackPosition = { x: 6, y: 13.2 }
let measuringContext: CanvasRenderingContext2D | null = null

function scrambleLetters(count: number) {
  return Array.from({ length: count }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
}

function MiniLetter({ letter, fontRevision }: { letter: string; fontRevision: number }) {
  const textRef = useRef<SVGTextElement>(null)
  const [positions, setPositions] = useState<ReadonlyMap<string, LetterPosition>>(new Map())
  useLayoutEffect(() => {
    const text = textRef.current
    if (!text) return
    const font = getComputedStyle(text)
    const key = `${fontRevision}:${font.font}`
    let measured = letterPositions.get(key)
    if (!measured) {
      measuringContext ??= document.createElement('canvas').getContext('2d')
      if (!measuringContext) return
      // Measure enlarged glyph ink to retain subpixel accuracy at this size.
      // Keep it a little above geometric centre for the small tile's optical
      // balance. Measure the whole alphabet once so scrambling only changes
      // text and coordinates, without further style reads or layout effects.
      const scale = 64
      measuringContext.font = `${font.fontStyle} ${font.fontWeight} ${parseFloat(font.fontSize) * scale}px ${font.fontFamily}`
      measuringContext.textAlign = 'left'
      measuringContext.textBaseline = 'alphabetic'
      measuringContext.direction = 'ltr'
      measured = new Map(Array.from(GLYPHS, glyph => {
        const ink = measuringContext!.measureText(glyph)
        return [glyph, {
          x: 10 + (ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / (2 * scale),
          y: 9.2 + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / (2 * scale),
        }]
      }))
      letterPositions.set(key, measured)
    }
    setPositions(measured)
  }, [fontRevision])
  const position = positions.get(letter) ?? fallbackPosition
  return <svg viewBox="0 0 20 20" className="refill-letter" aria-hidden="true" focusable="false">
    <text ref={textRef} x={position.x} y={position.y}>{letter}</text>
  </svg>
}

interface RefillSupplyProps {
  game: LetterStrikeState
  decoded?: boolean
  revealed?: readonly boolean[]
  registerTile?: (index: number, element: HTMLSpanElement | null) => void
}

export default function RefillSupply({ game, decoded = true, revealed, registerTile }: RefillSupplyProps) {
  const groups = getRefillGroups(game)
  const groupCount = groups?.length ?? 0
  const reducedMotion = useReducedMotion()
  const [displayLetters, setDisplayLetters] = useState(() => scrambleLetters(groupCount))
  const [fontRevision, setFontRevision] = useState(0)
  const allDecoded = decoded || (groups?.every((_, index) => revealed?.[index]) ?? true)

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
    if (allDecoded || reducedMotion || !groupCount) return
    const interval = window.setInterval(() => setDisplayLetters(scrambleLetters(groupCount)), introTimings.tileScrambleMs)
    return () => window.clearInterval(interval)
  }, [allDecoded, reducedMotion, groupCount])

  if (!groups) return null
  return <div className="refill-supply" role="img" aria-label={allDecoded ? describeRefillGroups(groups) : 'Refills are decoding.'}>
    <span className="resource-label refill-label" aria-hidden="true">REFILLS</span>
    <span className="refill-tiles" aria-hidden="true">
      {groups.map((group, index) => {
        const isDecoded = decoded || !!revealed?.[index]
        return <RefillCount key={group.letter ?? 'other'} index={index} registerTile={registerTile}
          letter={isDecoded ? group.letter : reducedMotion ? '?' : displayLetters[index] ?? '?'}
          count={isDecoded ? group.count : '?'} fontRevision={fontRevision} />
      })}
    </span>
  </div>
}

function RefillCount({ letter, count, fontRevision, index, registerTile }: {
  letter: RefillGroup['letter']
  count: number | '?'
  fontRevision: number
  index: number
  registerTile?: RefillSupplyProps['registerTile']
}) {
  const register = useCallback((element: HTMLSpanElement | null) => registerTile?.(index, element), [index, registerTile])
  return <span className="refill-group" aria-hidden="true">
    <span ref={register} className={`refill-square${letter ? ' refill-known' : ''}`}>
      {letter && <MiniLetter letter={letter} fontRevision={fontRevision} />}
      <span className="refill-count">{count}</span>
    </span>
  </span>
}
