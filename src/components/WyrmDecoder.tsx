import { animate, motion, motionValue, useMotionValue, useReducedMotion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import type { RefObject } from "react"
import { introTimings } from "../intro/config"
import type { TileRevealMode } from "../intro/config"
import { getTileRevealOrder } from "../intro/paths"
import type { Point } from "../intro/movement"
import { createGridRoute, sampleSnake } from "../intro/snake"
import type { GridRoute } from "../intro/snake"
import WyrmCharacter from "./WyrmCharacter"
import { WyrmLifePart } from "./WyrmLifeMeter"
import "./WyrmDecoder.css"

type WyrmDecoderProps = {
  phase: "waiting" | "enemy" | "tiles" | "ready"
  containerRef: RefObject<HTMLElement | null>
  enemyLetters: RefObject<(HTMLDivElement | null)[]>
  tileElements: RefObject<(HTMLButtonElement | null)[]>
  dockRef: RefObject<HTMLSpanElement | null>
  titleRef: RefObject<HTMLDivElement | null>
  lifeSegments?: number
  enemyCount: number
  tileCount: number
  tilePath?: TileRevealMode
  seed?: number | string
  onEnemyReveal: (index: number) => void
  onTileReveal: (index: number) => void
  onEnemyDecoded: () => void
  onTilesDecoded: () => void
}

// Layout coordinates ignore the tiles' reveal translations/scales. The route
// must never chase the letter it just made bounce. Only read these on layout
// changes, rather than measuring animated bounding boxes on every frame.
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

export default function WyrmDecoder({
  phase, containerRef, enemyLetters, tileElements, dockRef, titleRef, lifeSegments,
  enemyCount, tileCount, tilePath, seed,
  onEnemyReveal, onTileReveal, onEnemyDecoded, onTilesDecoded,
}: WyrmDecoderProps) {
  const reducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [routeStage, setRouteStage] = useState("enemy")
  const opacity = useMotionValue(0)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useMotionValue(0)
  const pieces = useMemo(() => Array.from({ length: lifeSegments ?? 0 }, () => ({
    x: motionValue(0), y: motionValue(0), heading: motionValue(0),
  })), [lifeSegments])
  const enemyArrivals = useRef(new Set<number>())
  const tileArrivals = useRef(new Set<number>())

  useEffect(() => {
    if (phase === "waiting" || phase === "ready") return
    let cancelled = false
    let stopFrame: (() => void) | undefined
    let dirty = true
    const invalidate = () => { dirty = true }
    const observer = new ResizeObserver(invalidate)
    // Parents can reflow without changing a tile's own dimensions.
    const observed = new Set<HTMLElement>()
    for (const target of [containerRef.current, dockRef.current, titleRef.current,
      ...enemyLetters.current, ...tileElements.current]) {
      for (let element = target; element; element = element.parentElement) {
        observed.add(element)
        if (element === containerRef.current) break
      }
    }
    for (const element of observed) observer.observe(element)
    window.addEventListener('resize', invalidate)
    document.fonts.addEventListener('loadingdone', invalidate)

    function measure() {
      const container = containerRef.current
      const enemies = enemyLetters.current.slice(0, enemyCount).map(element => layoutCenter(element, container))
      const tiles = tileElements.current.slice(0, tileCount).map(element => layoutCenter(element, container))
      const dock = dockRef.current
      let dockHead = layoutCenter(dock, container)
      let offsets = pieces.map(() => 0)
      let bodyLength = dock?.offsetWidth ?? 24
      // Measure the resting pieces once per layout change. Their actual sizes
      // and centres define the following distances and the final docking pose.
      if (dock && container) {
        const bounds = container.getBoundingClientRect()
        const target = dock.getBoundingClientRect()
        const resting = [...dock.querySelectorAll<HTMLElement>('.wyrm-life-segment, .wyrm-life-head')]
          .map(element => element.getBoundingClientRect())
        const head = resting.at(-1) ?? target
        const headX = head.left + head.width / 2
        dockHead = {
          x: headX - bounds.left - container.clientLeft + container.scrollLeft,
          y: head.top + head.height / 2 - bounds.top - container.clientTop + container.scrollTop,
        }
        offsets = pieces.map((_, index) => {
          const part = resting[index]
          return part ? headX - (part.left + part.width / 2) : 0
        })
        bodyLength = target.width
      }
      const width = container?.clientWidth ?? 0
      const margin = Math.max(introTimings.offscreenPaddingPx, bodyLength + 12)
      const outside = (side: 'left' | 'right', atY: number) => ({ x: side === 'left' ? -margin : width + margin, y: atY })
      const order = getTileRevealOrder(tileCount, tilePath, seed)
      const enemyFirst = enemies[0] ?? { x: 0, y: 0 }
      const enemyLast = enemies.at(-1) ?? enemyFirst
      const enemyRoute = createGridRoute([outside('left', enemyFirst.y), ...enemies, outside('right', enemyLast.y)])
      const board = order.map(index => tiles[index])
      const boardFirst = board[0] ?? { x: 0, y: 0 }
      const boardLast = board.at(-1) ?? boardFirst
      const boardRoute = createGridRoute([outside('left', boardFirst.y), ...board,
        outside(boardLast.x < width / 2 ? 'left' : 'right', boardLast.y)])
      const dockRoute = createGridRoute([outside('left', dockHead.y), dockHead])
      return { enemyRoute, boardRoute, dockRoute, offsets, order }
    }
    let geometry: ReturnType<typeof measure> | undefined
    function layout() {
      if (dirty || !geometry) {
        geometry = measure()
        dirty = false
      }
      return geometry
    }
    function runFor(duration: number, update?: (progress: number) => void, ease: "linear" | "easeInOut" = "easeInOut") {
      return new Promise<void>(resolve => {
        const playback = animate(0, 1, { duration, ease, onUpdate: update, onComplete: resolve })
        stopFrame = () => { playback.stop(); resolve() }
      })
    }
    function place(route: GridRoute, progress: number) {
      const distance = route.length * progress
      const head = route.sample(distance)
      x.set(head.x)
      y.set(head.y)
      rotate.set(head.angle)
      const poses = sampleSnake(route, distance, layout().offsets)
      pieces.forEach((piece, index) => {
        piece.x.set(poses[index].x)
        piece.y.set(poses[index].y)
        // Square bodies stay upright; only the head's face changes direction
        // in quarter turns. Each body piece reaches the corner separately.
        piece.heading.set(index === pieces.length - 1 ? poses[index].angle : 0)
      })
    }
    function show(route: GridRoute) {
      place(route, 0)
      opacity.set(1)
      setVisible(true)
    }
    function revealOnce(index: number, arrivals: Set<number>, reveal: (index: number) => void) {
      if (arrivals.has(index)) return
      arrivals.add(index)
      reveal(index)
    }

    async function decode() {
      const isEnemy = phase === "enemy"
      if (reducedMotion) {
        setVisible(false)
        await runFor(introTimings.reducedStage)
        if (cancelled) return
        const order = isEnemy ? Array.from({ length: enemyCount }, (_, index) => index)
          : getTileRevealOrder(tileCount, tilePath, seed)
        for (const index of order) revealOnce(index, isEnemy ? enemyArrivals.current : tileArrivals.current,
          isEnemy ? onEnemyReveal : onTileReveal)
        if (isEnemy) onEnemyDecoded()
        else onTilesDecoded()
        return
      }

      if (isEnemy) {
        setRouteStage("enemy")
        show(layout().enemyRoute)
        await runFor(introTimings.enemyDecode + introTimings.screenExit, progress => {
          const { enemyRoute } = layout()
          place(enemyRoute, progress)
          for (let index = 0; index < enemyCount; index++) {
            if (progress >= enemyRoute.arrivals[index + 1]) revealOnce(index, enemyArrivals.current, onEnemyReveal)
          }
        }, "linear")
        if (cancelled) return
        setVisible(false)
        await runFor(introTimings.stagePause)
        if (!cancelled) onEnemyDecoded()
        return
      }

      if (tileCount > 0) {
        setRouteStage("tiles")
        show(layout().boardRoute)
        // Entry, every tile and corner, and exit share one uninterrupted clock.
        // The head triggers reveals; the tail follows by distance along its path.
        await runFor(introTimings.boardTravel + introTimings.tileDecode + introTimings.screenExit, progress => {
          const { boardRoute, order } = layout()
          place(boardRoute, progress)
          for (const [step, index] of order.entries()) {
            if (progress >= boardRoute.arrivals[step + 1]) revealOnce(index, tileArrivals.current, onTileReveal)
          }
        }, "linear")
        if (cancelled) return
        setVisible(false)
        await runFor(introTimings.stagePause)
        if (cancelled) return
      }

      // A straight final approach naturally lays the trailing pieces into the
      // same centres as the resting life meter, without scaling or a morph.
      setRouteStage("dock")
      show(layout().dockRoute)
      await runFor(introTimings.titlePass, progress => place(layout().dockRoute, progress))
      if (cancelled) return
      await runFor(introTimings.dockSettle, () => place(layout().dockRoute, 1))
      if (cancelled) return
      setVisible(false)
      onTilesDecoded()
    }
    void decode()
    return () => {
      cancelled = true
      stopFrame?.()
      observer.disconnect()
      window.removeEventListener('resize', invalidate)
      document.fonts.removeEventListener('loadingdone', invalidate)
    }
  }, [phase, reducedMotion, containerRef, enemyLetters, tileElements, dockRef, titleRef, enemyCount, tileCount,
    tilePath, seed, onEnemyReveal, onTileReveal, onEnemyDecoded, onTilesDecoded, pieces, x, y, rotate, opacity])

  if (!visible || reducedMotion) return null
  if (lifeSegments === undefined) return <motion.div className="wyrm-decoder" data-route={routeStage} aria-hidden="true"
    style={{ x, y, rotate, opacity }}>
    <span className="wyrm-decoder-visual"><WyrmCharacter idle={false} /></span>
  </motion.div>
  return <motion.div className="wyrm-decoder wyrm-decoder-snake" data-route={routeStage} aria-hidden="true" style={{ opacity }}>
    {pieces.map((piece, index) => <motion.span key={index} className="wyrm-decoder-piece"
      data-piece={index} style={{ x: piece.x, y: piece.y, rotate: piece.heading }}>
      <WyrmLifePart kind={index === pieces.length - 1 ? 'head' : index === 0 ? 'tail' : 'body'} filled />
    </motion.span>)}
  </motion.div>
}
