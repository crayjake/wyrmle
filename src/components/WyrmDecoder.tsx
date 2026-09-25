import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { introTimings } from "../intro/config"
import type { TileRevealMode } from "../intro/config"
import { getTileRevealOrder } from "../intro/paths"
import { sampleSineTravel, unwrapAngle } from "../intro/movement"
import type { Point } from "../intro/movement"
import { createSmoothRoute } from "../intro/route"
import WyrmCharacter from "./WyrmCharacter"
import WyrmLifeMeter from "./WyrmLifeMeter"
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
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useMotionValue(0)
  const opacity = useMotionValue(0)
  const enemyArrivals = useRef(new Set<number>())
  const tileArrivals = useRef(new Set<number>())

  useEffect(() => {
    if (phase === "waiting" || phase === "ready") return
    let cancelled = false
    let stopFrame: (() => void) | undefined
    let dirty = true
    const invalidate = () => { dirty = true }
    const observer = new ResizeObserver(invalidate)
    const observed = [containerRef.current, dockRef.current, titleRef.current,
      ...enemyLetters.current, ...tileElements.current]
    for (const element of observed) if (element) observer.observe(element)
    window.addEventListener('resize', invalidate)
    document.fonts.addEventListener('loadingdone', invalidate)

    function measure() {
      const container = containerRef.current
      const enemies = enemyLetters.current.slice(0, enemyCount).map(element => layoutCenter(element, container))
      const tiles = tileElements.current.slice(0, tileCount).map(element => layoutCenter(element, container))
      const dock = dockRef.current
      let dockPoint = layoutCenter(dock, container)
      // The static meter has no transform; retain its fractional pixel position
      // so the moving copy and resting copy coincide exactly at the handoff.
      if (dock && container) {
        const target = dock.getBoundingClientRect()
        const bounds = container.getBoundingClientRect()
        dockPoint = {
          x: target.left + target.width / 2 - bounds.left - container.clientLeft + container.scrollLeft,
          y: target.top + target.height / 2 - bounds.top - container.clientTop + container.scrollTop,
        }
      }
      const order = getTileRevealOrder(tileCount, tilePath, seed)
      return { enemies, tiles, dock: dockPoint, width: container?.clientWidth ?? 0,
        order, boardRoute: createSmoothRoute(order.map(index => tiles[index])) }
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
    function place(point: Point & { angle: number }) {
      x.set(point.x)
      y.set(point.y)
      rotate.set(unwrapAngle(rotate.get(), point.angle))
    }
    function offscreen(side: "left" | "right", atY: number): Point {
      // Leave enough room for the full life-meter-sized wyrm to clear the edge.
      const margin = Math.max(introTimings.offscreenPaddingPx, (dockRef.current?.offsetWidth ?? 0) / 2 + 8)
      return { x: side === "left" ? -margin : layout().width + margin, y: atY }
    }
    function showAt(point: Point, angle = 0) {
      place({ ...point, angle })
      opacity.set(1)
      setVisible(true)
    }
    function hide() { setVisible(false) }
    async function travelTo(target: () => Point, duration: number, endAngle: number, ease: "linear" | "easeInOut" = "linear") {
      const start = { x: x.get(), y: y.get() }
      const startAngle = rotate.get()
      let previousTarget: Point | undefined
      let route = createSmoothRoute([start, target()], startAngle, endAngle)
      await runFor(duration, progress => {
        const nextTarget = target()
        if (!previousTarget || previousTarget.x !== nextTarget.x || previousTarget.y !== nextTarget.y) {
          route = createSmoothRoute([start, nextTarget], startAngle, endAngle)
          previousTarget = nextTarget
        }
        place(route.sample(progress))
      }, ease)
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
        const course = (progress: number) => {
          const { enemies } = layout()
          const first = enemies[0] ?? { x: 0, y: 0 }
          const last = enemies.at(-1) ?? first
          return sampleSineTravel(
            { x: first.x - introTimings.edgeGapPx * 2, y: first.y },
            { x: last.x + introTimings.edgeGapPx * 2, y: last.y }, progress,
            Math.min(introTimings.enemyWaveMaxPx,
              (enemyLetters.current[0]?.offsetHeight ?? 30) * introTimings.enemyWaveHeightRatio),
            introTimings.enemyWaveCycles)
        }
        const beginning = course(0)
        setRouteStage("enemy")
        showAt(beginning, beginning.angle)
        opacity.set(0)
        await runFor(introTimings.appear, progress => opacity.set(progress))
        if (cancelled) return
        await runFor(introTimings.enemyDecode, progress => {
          const point = course(progress)
          place(point)
          layout().enemies.forEach((center, index) => {
            if (point.x >= center.x) revealOnce(index, enemyArrivals.current, onEnemyReveal)
          })
        }, "linear")
        if (cancelled) return
        setRouteStage("enemy-exit")
        const exitY = y.get()
        await travelTo(() => offscreen("right", exitY), introTimings.screenExit, 0)
        if (cancelled) return
        hide()
        await runFor(introTimings.stagePause)
        if (!cancelled) onEnemyDecoded()
        return
      }

      if (tileCount > 0) {
        const beginning = layout().boardRoute.sample(0)
        setRouteStage("tile-entry")
        showAt(offscreen("left", beginning.y))
        await travelTo(() => layout().boardRoute.sample(0), introTimings.boardTravel, beginning.angle)
        if (cancelled) return
        setRouteStage("tiles")
        // One clock covers every tile and turn. Distance-based sampling carries
        // each frame straight through arrivals instead of pausing at 15 hops.
        await runFor(introTimings.tileDecode, progress => {
          const { boardRoute, order } = layout()
          place(boardRoute.sample(progress))
          for (const [step, index] of order.entries()) {
            if (progress >= boardRoute.arrivals[step]) revealOnce(index, tileArrivals.current, onTileReveal)
          }
        }, "linear")
        if (cancelled) return
        setRouteStage("tile-exit")
        const exitY = y.get()
        const exitSide = x.get() < layout().width / 2 ? "left" : "right"
        await travelTo(() => offscreen(exitSide, exitY), introTimings.screenExit, exitSide === "left" ? 180 : 0)
        if (cancelled) return
        hide()
        await runFor(introTimings.stagePause)
        if (cancelled) return
      }

      // Return at the life meter's own height and ease into its exact footprint.
      // Both instances render the same component, with no scaling or morph.
      setRouteStage("dock")
      showAt(offscreen("left", layout().dock.y))
      await travelTo(() => layout().dock, introTimings.titlePass, 0, "easeInOut")
      if (cancelled) return
      await runFor(introTimings.dockSettle, () => place({ ...layout().dock, angle: 0 }))
      if (cancelled) return
      hide()
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
    tilePath, seed, onEnemyReveal, onTileReveal, onEnemyDecoded, onTilesDecoded, x, y, rotate, opacity])

  if (!visible || reducedMotion) return null
  return <motion.div className="wyrm-decoder" data-route={routeStage} aria-hidden="true"
    style={{ x, y, rotate, opacity }}>
    <span className="wyrm-decoder-visual">
      {lifeSegments === undefined ? <WyrmCharacter idle={false} />
        : <WyrmLifeMeter lives={lifeSegments} maximum={lifeSegments} />}
    </span>
  </motion.div>
}
