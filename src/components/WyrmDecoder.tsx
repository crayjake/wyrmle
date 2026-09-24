import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { introTimings } from "../intro/config"
import type { TileRevealMode } from "../intro/config"
import { getTileRevealOrder } from "../intro/paths"
import { sampleSineTravel, sampleTravel, unwrapAngle } from "../intro/movement"
import type { Point, TravelCurve } from "../intro/movement"
import WyrmCharacter from "./WyrmCharacter"
import "./WyrmDecoder.css"

type WyrmDecoderProps = {
  phase: "waiting" | "enemy" | "tiles" | "ready"
  containerRef: RefObject<HTMLElement | null>
  enemyLetters: RefObject<(HTMLDivElement | null)[]>
  tileElements: RefObject<(HTMLButtonElement | null)[]>
  dockRef: RefObject<HTMLSpanElement | null>
  titleRef: RefObject<HTMLDivElement | null>
  enemyCount: number
  tileCount: number
  tilePath?: TileRevealMode
  seed?: number | string
  onEnemyReveal: (index: number) => void
  onTileReveal: (index: number) => void
  onEnemyDecoded: () => void
  onTilesDecoded: () => void
}

export default function WyrmDecoder({
  phase,
  containerRef,
  enemyLetters,
  tileElements,
  dockRef,
  titleRef,
  enemyCount,
  tileCount,
  tilePath,
  seed,
  onEnemyReveal,
  onTileReveal,
  onEnemyDecoded,
  onTilesDecoded,
}: WyrmDecoderProps) {
  const reducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [routeStage, setRouteStage] = useState("enemy")
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useMotionValue(0)
  const opacity = useMotionValue(0)
  // Remember arrivals if the motion preference changes during the intro.
  const enemyArrivals = useRef(new Set<number>())
  const tileArrivals = useRef(new Set<number>())

  useEffect(() => {
    if (phase === "waiting" || phase === "ready") return

    let cancelled = false
    let stopFrame: (() => void) | undefined

    // All progress uses Framer Motion's animation clock. Cleanup releases the
    // current await as well as stopping its frames, including in Strict Mode.
    function runFor(duration: number, update?: (progress: number) => void, ease: "linear" | "easeInOut" = "easeInOut") {
      return new Promise<void>(resolve => {
        const playback = animate(0, 1, {
          duration,
          ease,
          onUpdate: update,
          onComplete: resolve,
        })
        stopFrame = () => {
          playback.stop()
          resolve()
        }
      })
    }

    function pointIn(element: HTMLElement | null, vertical = 0.5, offsetY = 0): Point {
      const container = containerRef.current
      if (!element || !container) return { x: x.get(), y: y.get() }
      const target = element.getBoundingClientRect()
      const bounds = container.getBoundingClientRect()
      return {
        x: target.left + target.width / 2 - bounds.left - container.clientLeft + container.scrollLeft,
        y: target.top + target.height * vertical - bounds.top - container.clientTop + container.scrollTop + offsetY,
      }
    }

    function offscreen(side: "left" | "right", atY: number): Point {
      return {
        x: side === "left" ? -introTimings.offscreenPaddingPx
          : (containerRef.current?.clientWidth ?? 0) + introTimings.offscreenPaddingPx,
        y: atY,
      }
    }

    function place(point: Point & { angle: number }) {
      x.set(point.x)
      y.set(point.y)
      rotate.set(unwrapAngle(rotate.get(), point.angle))
    }

    function showAt(point: Point, angle = 0) {
      place({ ...point, angle })
      opacity.set(1)
      setVisible(true)
    }

    function hide() {
      opacity.set(0)
      setVisible(false)
    }

    async function travelTo(locate: () => Point, duration: number, curve: TravelCurve = "straight", bend = 0) {
      const start = { x: x.get(), y: y.get() }
      const initialAngle = rotate.get()
      await runFor(duration, progress => {
        // Measure during travel, so resizing, font loading, and layout changes
        // update the destination before arrival without restarting the sequence.
        const point = sampleTravel(start, locate(), progress, curve, bend)
        x.set(point.x)
        y.set(point.y)
        // Rotate the head into the path, including vertical travel and U-turns.
        // Unwrapped angles prevent a sudden spin when crossing ±180 degrees.
        const heading = unwrapAngle(rotate.get(), point.angle)
        rotate.set(progress < 0.18
          ? initialAngle + (unwrapAngle(initialAngle, point.angle) - initialAngle) * progress / 0.18
          : heading)
      }, "linear")
    }

    async function decode() {
      const isEnemy = phase === "enemy"
      const order = isEnemy
        ? Array.from({ length: enemyCount }, (_, index) => index)
        : getTileRevealOrder(tileCount, tilePath, seed)
      const elements = isEnemy ? enemyLetters : tileElements
      const arrivals = isEnemy ? enemyArrivals.current : tileArrivals.current
      const reveal = isEnemy ? onEnemyReveal : onTileReveal

      if (reducedMotion) {
        setVisible(false)
        await runFor(introTimings.reducedStage)
        if (cancelled) return
        for (const index of order) {
          if (!arrivals.has(index)) {
            arrivals.add(index)
            reveal(index)
          }
        }
        if (isEnemy) onEnemyDecoded()
        else onTilesDecoded()
        return
      }

      if (isEnemy) {
        const course = () => {
          const first = pointIn(enemyLetters.current[0])
          const last = pointIn(enemyLetters.current[enemyCount - 1])
          return {
            start: { x: first.x - introTimings.edgeGapPx * 2, y: first.y },
            end: { x: last.x + introTimings.edgeGapPx * 2, y: last.y },
            // offsetHeight excludes the letter's lock-in scale animation.
            amplitude: Math.min(introTimings.enemyWaveMaxPx,
              (enemyLetters.current[0]?.offsetHeight ?? 30) * introTimings.enemyWaveHeightRatio),
          }
        }
        const initial = course()
        const beginning = sampleSineTravel(initial.start, initial.end, 0, initial.amplitude, introTimings.enemyWaveCycles)
        setRouteStage("enemy")
        showAt(beginning, beginning.angle)
        opacity.set(0)
        await runFor(introTimings.appear, progress => opacity.set(progress))
        if (cancelled) return

        // A single continuous sine pass, centered vertically on the letters.
        // Each letter locks when the wyrm passes its actual rendered center.
        await runFor(introTimings.enemyDecode, progress => {
          const { start, end, amplitude } = course()
          const point = sampleSineTravel(start, end, progress, amplitude, introTimings.enemyWaveCycles)
          place(point)
          for (const index of order) {
            if (!arrivals.has(index) && point.x >= pointIn(enemyLetters.current[index]).x) {
              arrivals.add(index)
              reveal(index)
            }
          }
        }, "linear")
        if (cancelled) return
        setRouteStage("enemy-exit")
        const exitY = y.get()
        await travelTo(() => offscreen("right", exitY), introTimings.screenExit)
        if (cancelled) return
        hide()
        await runFor(introTimings.stagePause)
        if (!cancelled) onEnemyDecoded()
        return
      }

      const tileCourse = (index: number) => {
        const row = Math.floor(index / 4) * 4
        const center = pointIn(tileElements.current[index], introTimings.tileLane)
        return {
          start: { x: pointIn(tileElements.current[row]).x, y: center.y },
          end: { x: pointIn(tileElements.current[Math.min(row + 3, tileCount - 1)]).x, y: center.y },
          center,
          amplitude: Math.min(introTimings.tileWaveMaxPx,
            (tileElements.current[index]?.offsetHeight ?? 60) * introTimings.tileWaveHeightRatio),
        }
      }
      const destination = (index: number) => {
        const { start, end, center, amplitude } = tileCourse(index)
        return sampleSineTravel(start, end, (center.x - start.x) / Math.max(1, end.x - start.x),
          amplitude, introTimings.tileWaveCycles)
      }
      async function travelAlongRow(index: number, duration: number) {
        const fromX = x.get()
        await runFor(duration, progress => {
          const { start, end, center, amplitude } = tileCourse(index)
          const atX = fromX + (center.x - fromX) * progress
          const point = sampleSineTravel(start, end, (atX - start.x) / Math.max(1, end.x - start.x),
            amplitude, introTimings.tileWaveCycles)
          // Reverse the tangent when traversing a row from right to left.
          place({ ...point, angle: point.angle + (center.x < fromX ? 180 : 0) })
        }, "linear")
      }
      const first = order.find(index => !arrivals.has(index)) ?? order[0]
      // Relocate only while hidden. Each new stage enters at its own height.
      setRouteStage("tile-entry")
      showAt(offscreen("left", destination(first).y))
      await travelTo(() => destination(first), introTimings.boardTravel)
      if (cancelled) return
      arrivals.add(first)
      reveal(first)
      setRouteStage("tiles")

      const rowTurn = (previous: number, next: number) =>
        previous % 4 === next % 4 && Math.floor(next / 4) === Math.floor(previous / 4) + 1
      const totalWeight = order.slice(1).reduce((sum, index, i) =>
        sum + (rowTurn(order[i], index) ? 1.5 : 1), 0)
      for (const [step, index] of order.entries()) {
        if (arrivals.has(index)) continue
        const previous = order[step - 1]
        const turn = step > 0 && rowTurn(previous, index)
        const curve: TravelCurve = turn ? (previous % 4 === 3 ? "turn-right" : "turn-left") : "straight"
        const bend = turn ? Math.min(26, (elements.current[index]?.getBoundingClientRect().width ?? 60) * 0.4) : 0
        const duration = introTimings.tileDecode * (turn ? 1.5 : 1) / Math.max(1, totalWeight)
        if (!turn && Math.floor(previous / 4) === Math.floor(index / 4)) {
          await travelAlongRow(index, duration)
        } else {
          await travelTo(() => destination(index), duration, curve, bend)
        }
        if (cancelled) return
        // An arrival is the sole cause of a reveal; no independent decode timer.
        arrivals.add(index)
        reveal(index)
      }

      setRouteStage("tile-exit")
      const exitY = y.get()
      const exitSide = x.get() < (containerRef.current?.clientWidth ?? 0) / 2 ? "left" : "right"
      await travelTo(() => offscreen(exitSide, exitY), introTimings.screenExit)
      if (cancelled) return
      hide()
      await runFor(introTimings.stagePause)
      if (cancelled) return

      // Re-enter beside the title and slither through it left-to-right, never
      // diagonally across the health/attack UI on the way back from the board.
      setRouteStage("title")
      const titleCourse = () => ({
        start: offscreen("left", pointIn(titleRef.current).y),
        end: pointIn(dockRef.current),
      })
      const titleStart = titleCourse()
      const beginning = sampleSineTravel(titleStart.start, titleStart.end, 0, introTimings.titleWavePx, 1)
      showAt(beginning, beginning.angle)
      await runFor(introTimings.titlePass, progress => {
        const { start, end } = titleCourse()
        place(sampleSineTravel(start, end, progress, introTimings.titleWavePx, 1))
      }, "linear")
      if (cancelled) return
      const arrivalAngle = rotate.get()
      const restingAngle = unwrapAngle(arrivalAngle, 0)
      await runFor(introTimings.dockSettle, progress => {
        rotate.set(arrivalAngle + (restingAngle - arrivalAngle) * progress)
      })
      if (cancelled) return
      hide()
      onTilesDecoded()
    }

    void decode()
    return () => {
      cancelled = true
      stopFrame?.()
    }
  }, [phase, reducedMotion, containerRef, enemyLetters, tileElements, dockRef, titleRef, enemyCount, tileCount,
    tilePath, seed, onEnemyReveal, onTileReveal, onEnemyDecoded, onTilesDecoded,
    x, y, rotate, opacity])

  if (!visible || reducedMotion) return null

  return (
    <motion.div
      className="wyrm-decoder"
      data-route={routeStage}
      aria-hidden="true"
      style={{ x, y, rotate, opacity }}
    >
      <WyrmCharacter idle={false} />
    </motion.div>
  )
}
