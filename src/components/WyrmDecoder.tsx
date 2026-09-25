import { animate, motion, motionValue, useMotionValue, useReducedMotion } from 'framer-motion'
import { useLayoutEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { introTimings } from '../intro/config'
import type { TileRevealMode } from '../intro/config'
import { getTileRevealOrder } from '../intro/paths'
import type { Point } from '../intro/movement'
import { createDecodeTour } from '../intro/tour'
import { sampleWalkingPiece, smoothTravelDistance } from '../intro/walk'
import WyrmCharacter from './WyrmCharacter'
import { WyrmLifePart } from './WyrmLifeMeter'
import './WyrmDecoder.css'

type WyrmDecoderProps = {
  phase: 'waiting' | 'enemy' | 'tiles' | 'ready'
  containerRef: RefObject<HTMLElement | null>
  enemyLetters: RefObject<(HTMLDivElement | null)[]>
  tileElements: RefObject<(HTMLButtonElement | null)[]>
  refillElements: RefObject<(HTMLSpanElement | null)[]>
  dockRef: RefObject<HTMLSpanElement | null>
  lifeSegments?: number
  enemyCount: number
  tileCount: number
  tilePath?: TileRevealMode
  seed?: number | string
  onEnemyReveal: (index: number) => void
  onTileReveal: (index: number) => void
  onRefillReveal: (index: number) => void
  onEnemyDecoded: () => void
  onTilesDecoded: () => void
}

// Ignore reveal transforms: the wyrm follows the resting tile, not its bounce.
function layoutCenter(element: HTMLElement | null, container: HTMLElement | null): Point {
  if (!element || !container) return { x: 0, y: 0 }
  let x = element.offsetWidth / 2
  let y = element.offsetHeight / 2
  let current: HTMLElement | null = element
  while (current && current !== container) {
    x += current.offsetLeft
    y += current.offsetTop
    const parent = current.offsetParent as HTMLElement | null
    if (parent && parent !== container) {
      x += parent.clientLeft
      y += parent.clientTop
    }
    current = parent
  }
  for (let parent = element.parentElement; parent && parent !== container; parent = parent.parentElement) {
    x -= parent.scrollLeft
    y -= parent.scrollTop
  }
  return { x, y }
}

const travelDuration = 10.2
const settleDuration = 0.35
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

export default function WyrmDecoder({
  phase, containerRef, enemyLetters, tileElements, refillElements, dockRef, lifeSegments,
  enemyCount, tileCount, tilePath, seed,
  onEnemyReveal, onTileReveal, onRefillReveal, onEnemyDecoded, onTilesDecoded,
}: WyrmDecoderProps) {
  const reducedMotion = useReducedMotion()
  const active = phase === 'enemy' || phase === 'tiles'
  const [visible, setVisible] = useState(false)
  const [routeStage, setRouteStage] = useState('enemy')
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useMotionValue(0)
  const pieces = useMemo(() => Array.from({ length: lifeSegments ?? 0 }, () => ({
    x: motionValue(0), y: motionValue(0), heading: motionValue(0),
    scaleX: motionValue(1), scaleY: motionValue(1),
  })), [lifeSegments])

  useLayoutEffect(() => {
    if (!active) return
    const container = containerRef.current
    const dock = dockRef.current
    if (!container || !dock) return
    const bounds = container.getBoundingClientRect()
    const center = (element: HTMLElement): Point => {
      const rect = element.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2 - bounds.left - container.clientLeft + container.scrollLeft,
        y: rect.top + rect.height / 2 - bounds.top - container.clientTop + container.scrollTop,
      }
    }
    const resting = [...dock.querySelectorAll<HTMLElement>('.wyrm-life-segment, .wyrm-life-head')].map(center)
    const dockHead = resting.at(-1) ?? center(dock)
    const offsets = pieces.map((_, index) => dockHead.x - (resting[index]?.x ?? dockHead.x))
    const enemies = enemyLetters.current.slice(0, enemyCount).map(element => layoutCenter(element, container))
    const tiles = tileElements.current.slice(0, tileCount).map(element => layoutCenter(element, container))
    const refills = refillElements.current.filter((element): element is HTMLSpanElement => Boolean(element)).map(center)
    const { route, events } = createDecodeTour({
      width: container.clientWidth, dock: dockHead, enemies, refills, tiles,
      order: getTileRevealOrder(tileCount, tilePath, seed),
    })
    let finished = false
    let nextEvent = 0
    let stage = 'enemy'
    let enemyDone = false
    let stop: (() => void) | undefined
    function revealThrough(distance: number) {
      while (nextEvent < events.length && events[nextEvent].distance <= distance) {
        const event = events[nextEvent++]
        if (stage !== event.kind) {
          stage = event.kind
          setRouteStage(stage)
        }
        if (event.kind === 'enemy') onEnemyReveal(event.index)
        else if (event.kind === 'refills') onRefillReveal(event.index)
        else onTileReveal(event.index)
        if (!enemyDone && (nextEvent === events.length || events[nextEvent].kind !== 'enemy')) {
          enemyDone = true
          onEnemyDecoded()
        }
      }
      if (nextEvent === events.length && stage !== 'dock') {
        stage = 'dock'
        setRouteStage(stage)
      }
    }
    function finish() {
      if (finished) return
      finished = true
      stop?.()
      revealThrough(Infinity)
      setVisible(false)
      onTilesDecoded()
    }
    function place(elapsed: number) {
      const distance = smoothTravelDistance(elapsed, travelDuration, route.length)
      const amount = smooth(elapsed / 0.35) * (1 - smooth((elapsed - travelDuration + 0.45) / 0.75))
      const settling = smooth((elapsed - travelDuration + 0.25) / (settleDuration + 0.25))
      const head = route.sample(distance)
      x.set(mix(head.x, dockHead.x, settling))
      y.set(mix(head.y, dockHead.y, settling))
      rotate.set(mix(head.angle, Math.round(head.angle / 360) * 360, settling))
      pieces.forEach((piece, index) => {
        const pose = sampleWalkingPiece(route, distance, offsets[index], elapsed, amount, index)
        const rest = resting[index] ?? dockHead
        piece.x.set(mix(pose.x, rest.x, settling))
        piece.y.set(mix(pose.y, rest.y, settling))
        piece.heading.set(index === pieces.length - 1 ? mix(pose.angle, Math.round(pose.angle / 360) * 360, settling) : 0)
        piece.scaleX.set(pose.scaleX)
        piece.scaleY.set(pose.scaleY)
      })
      revealThrough(distance)
    }

    // One clock and one geometry snapshot for the whole trip. Stage callbacks
    // don't restart it, and glyph updates never force new layout measurements.
    place(0)
    setRouteStage('enemy')
    setVisible(!reducedMotion)
    const playback = reducedMotion
      ? animate(0, 1, { duration: introTimings.reducedStage, onComplete: finish })
      : animate(0, travelDuration + settleDuration, {
        duration: travelDuration + settleDuration, ease: 'linear', onUpdate: place, onComplete: finish,
      })
    stop = () => playback.stop()

    // A rotation or a viewport reflow should finish the intro, never teleport
    // a moving body onto a newly measured route. Gameplay then uses fresh layout.
    const initialWidth = container.clientWidth
    const initialHeight = container.clientHeight
    const observer = new ResizeObserver(() => {
      if (container.clientWidth !== initialWidth || container.clientHeight !== initialHeight) finish()
    })
    const fontsChanged = () => {
      const moved = (element: HTMLElement | null, before: Point) => {
        const after = layoutCenter(element, container)
        return Math.hypot(after.x - before.x, after.y - before.y) > 1
      }
      if (enemies.some((point, index) => moved(enemyLetters.current[index], point))
        || tiles.some((point, index) => moved(tileElements.current[index], point))) finish()
    }
    observer.observe(container)
    document.fonts.addEventListener('loadingdone', fontsChanged)
    return () => {
      finished = true
      stop?.()
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', fontsChanged)
    }
  }, [active, reducedMotion, containerRef, enemyLetters, tileElements, refillElements, dockRef, enemyCount, tileCount,
    tilePath, seed, onEnemyReveal, onTileReveal, onRefillReveal, onEnemyDecoded, onTilesDecoded, pieces, x, y, rotate])

  if (!active || !visible || reducedMotion) return null
  if (lifeSegments === undefined) return <motion.div className="wyrm-decoder" data-route={routeStage} aria-hidden="true"
    style={{ x, y, rotate }}>
    <span className="wyrm-decoder-visual"><WyrmCharacter idle={false} /></span>
  </motion.div>
  return <div className="wyrm-decoder wyrm-decoder-snake" data-route={routeStage} aria-hidden="true">
    {pieces.map((piece, index) => <motion.span key={index} className="wyrm-decoder-piece"
      data-piece={index} style={{ x: piece.x, y: piece.y, rotate: piece.heading, scaleX: piece.scaleX, scaleY: piece.scaleY }}>
      <WyrmLifePart kind={index === pieces.length - 1 ? 'head' : index === 0 ? 'tail' : 'body'} filled />
    </motion.span>)}
  </div>
}
