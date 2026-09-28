import { useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"

import Tile from "./Tile"
import type { SpecialTilePresentation } from "./Tile"
import BattleActions from "./BattleActions"
import { Shuffle } from 'lucide-react'
import type { BattlePrimaryLabel } from "./BattleActions"
import { introTimings } from "../intro/config"
import { getMatchingTileIds } from './tileMatchHints'
import type { MatchHintMode } from './tileMatchHints'
import { beginTileSelectionGesture, crossedTileIds, finishTileSelectionGesture, moveTileSelectionGesture } from './tileSelectionGesture'
import type { TileGestureBounds, TileSelectionGesture } from './tileSelectionGesture'
import './TileReadability.css'
import './TileGesture.css'

type BoardTilePresentation = {
  id: number
  letter: string
  type: 'normal' | 'gem'
  gem?: string
}

type TileGridProps = {
  revealedIndices: readonly number[]
  registerTile: (index: number, element: HTMLButtonElement | null) => void
  ready: boolean
  tiles: readonly BoardTilePresentation[]
  specialTiles: readonly SpecialTilePresentation[]
  selectedTileIds: number[]
  allowedTileIds?: readonly number[]
  enemyLetters?: readonly { letter: string; hitsRemaining: number }[]
  matchHint?: MatchHintMode
  damage?: number
  primaryLabel?: BattlePrimaryLabel
  showActions?: boolean
  layout?: 'grid' | 'wheel'
  canAttack: boolean
  onToggleTile: (id: number) => void
  // Guided modes validate this ordered batch against their next-letter rule.
  onSelectTiles?: (ids: readonly number[]) => void
  onClear: () => void
  onAttack: () => void
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@"

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function TileGrid({
  revealedIndices,
  registerTile,
  ready,
  tiles,
  specialTiles,
  selectedTileIds,
  allowedTileIds,
  enemyLetters = [],
  matchHint = 'underline',
  damage,
  primaryLabel,
  showActions = true,
  layout = 'grid',
  canAttack,
  onToggleTile,
  onSelectTiles,
  onClear,
  onAttack,
}: TileGridProps) {
  const reducedMotion = useReducedMotion()
  const matchingIds = new Set(matchHint !== 'off'
    ? getMatchingTileIds(tiles, enemyLetters) : [])
  const decoded = tiles.every((_, index) => revealedIndices.includes(index))
  const [displayLetters, setDisplayLetters] = useState(
    tiles.map(() => randomGlyph())
  )
  const gridRef = useRef<HTMLDivElement>(null)
  // Reorder positions only. Physical IDs, letter counts and refills stay intact.
  const [wheelOrder, setWheelOrder] = useState(() => tiles.map((_, index) => index))
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const positions = tiles.map((_, index) => {
    const slot = wheelOrder.indexOf(index)
    const outerCount = Math.min(10, tiles.length)
    const outer = slot < outerCount
    const count = outer ? outerCount : tiles.length - outerCount
    const angle = ((outer ? slot : slot - outerCount) / count * 360 - 90) * Math.PI / 180
    const radius = outer ? 41 : 22
    return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius }
  })
  const path = selectedTileIds.flatMap(id => {
    const index = tiles.findIndex(tile => tile.id === id)
    return index < 0 ? [] : [positions[index]]
  })
  const gestureRef = useRef<{ selection: TileSelectionGesture; bounds: TileGestureBounds[]; board: string } | null>(null)
  const pointerClickUntil = useRef(0)
  const board = `${layout}|${tiles.map(tile => `${tile.id}:${tile.letter}`).join('|')}`

  function cancelGesture() {
    const gesture = gestureRef.current
    if (!gesture) return
    gestureRef.current = null
    setPointer(null)
    pointerClickUntil.current = performance.now() + 600
    if (gridRef.current?.hasPointerCapture(gesture.selection.pointerId)) {
      gridRef.current.releasePointerCapture(gesture.selection.pointerId)
    }
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (layout !== 'wheel') return
    const rect = event.currentTarget.getBoundingClientRect()
    setPointer({ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 })
  }

  function shuffle() {
    cancelGesture()
    onClear()
    setWheelOrder(current => {
      const next = [...current]
      for (let index = next.length - 1; index > 0; index--) {
        const target = Math.floor(Math.random() * (index + 1))
        ;[next[index], next[target]] = [next[target], next[index]]
      }
      return next
    })
  }

  // A submitted/replaced board cannot inherit a gesture from the previous turn.
  useEffect(() => {
    if (!ready || (gestureRef.current && gestureRef.current.board !== board)) cancelGesture()
  }, [ready, board, layout])

  useEffect(() => {
    window.addEventListener('blur', cancelGesture)
    window.addEventListener('resize', cancelGesture)
    return () => {
      window.removeEventListener('blur', cancelGesture)
      window.removeEventListener('resize', cancelGesture)
      cancelGesture()
    }
  }, [])

  function beginGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!ready || !event.isPrimary || event.button !== 0 || gestureRef.current) return
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-tile-index]')
    if (!button || button.disabled || !event.currentTarget.contains(button)) return
    const tile = tiles[Number(button.dataset.tileIndex)]
    if (!tile || !tile.letter) return
    const bounds = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-tile-index]')].flatMap(element => {
      const boardTile = tiles[Number(element.dataset.tileIndex)]
      if (!boardTile?.letter) return []
      const rect = element.getBoundingClientRect()
      return [{ id: boardTile.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }]
    })
    const started = beginTileSelectionGesture(event.pointerId, { x: event.clientX, y: event.clientY }, tile.id, selectedTileIds)
    gestureRef.current = { selection: started.gesture, bounds, board }
    pointerClickUntil.current = Number.POSITIVE_INFINITY
    event.currentTarget.setPointerCapture(event.pointerId)
    movePointer(event)
    for (const id of started.addedIds) onToggleTile(id)
  }

  function moveGesture(event: ReactPointerEvent<HTMLDivElement>) {
    let gesture = gestureRef.current
    if (!gesture || event.pointerId !== gesture.selection.pointerId || !ready || gesture.board !== board) return
    movePointer(event)
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? []
    const bounds = gesture.bounds.filter(tile => onSelectTiles !== undefined || allowedTileIds === undefined || allowedTileIds.includes(tile.id))
    const crossed: number[] = []
    for (const sample of [...samples, event.nativeEvent]) {
      const point = { x: sample.clientX, y: sample.clientY }
      if (onSelectTiles) crossed.push(...crossedTileIds(gesture.selection.previous, point, bounds))
      const moved = moveTileSelectionGesture(gesture.selection, point, bounds)
      gesture = { ...gesture, selection: moved.gesture }
      gestureRef.current = gesture
      if (!onSelectTiles) for (const id of moved.addedIds) onToggleTile(id)
    }
    if (crossed.length) onSelectTiles?.(crossed)
  }

  function endGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerId !== gestureRef.current?.selection.pointerId) return
    moveGesture(event)
    const gesture = gestureRef.current
    if (gesture && ready && gesture.board === board) {
      const deselect = finishTileSelectionGesture(gesture.selection)
      if (deselect !== null && (allowedTileIds === undefined || allowedTileIds.includes(deselect))) onToggleTile(deselect)
    }
    cancelGesture()
  }

  // Keep unrevealed tiles scrambling.
  useEffect(() => {
    if (decoded || reducedMotion) return
    const scramble = window.setInterval(() => {
      setDisplayLetters(tiles.map(() => randomGlyph()))
    }, introTimings.tileScrambleMs)

    return () => window.clearInterval(scramble)
  }, [tiles, decoded, reducedMotion])

  return (
    <>
      <div className={`tile-grid${layout === 'wheel' ? ' anagram-wheel' : ''}`} ref={gridRef} data-swipe-ready={ready}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={event => {
          if (event.pointerId === gestureRef.current?.selection.pointerId) cancelGesture()
        }}
        onLostPointerCapture={event => {
          if (event.pointerId === gestureRef.current?.selection.pointerId) cancelGesture()
        }}
        onClickCapture={event => {
          // Pointer selection already happened on down/move/up. Keyboard and
          // assistive-technology clicks (detail 0) keep the native button path.
          if (!(event.target as Element).closest('button[data-tile-index]')) return
          if (event.detail !== 0 && performance.now() < pointerClickUntil.current) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        {layout === 'wheel' && <>
          <svg className="wheel-trace" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="wheel-guide" cx="50" cy="50" r="41" />
            {path.length > 1 && <polyline points={path.map(point => `${point.x},${point.y}`).join(' ')} />}
            {pointer && path.length > 0 && <line className="wheel-live-trace" x1={path.at(-1)!.x} y1={path.at(-1)!.y} x2={pointer.x} y2={pointer.y} />}
          </svg>
          <button type="button" className="wheel-shuffle icon-button" aria-label="Shuffle letters" title="Shuffle letters"
            disabled={!ready} onClick={shuffle}><Shuffle size={20} /></button>
        </>}
        {tiles.map((tile, i) => {
          const selectedIndex =
            selectedTileIds.indexOf(tile.id)
          const revealed = revealedIndices.includes(i)

          const content = (
            <Tile
              key={tile.id}
              elementRef={element => registerTile(i, element)}
              boardIndex={i}
              empty={tile.letter === ''}
              letter={revealed ? tile.letter : displayLetters[i]}
              special={tile.type === "gem" ? specialTiles.find(special => special.id === tile.gem) : undefined}
              revealed={revealed}
              matchHint={matchingIds.has(tile.id) ? matchHint : 'off'}
              disabled={!ready || (allowedTileIds !== undefined && !allowedTileIds.includes(tile.id))}
              selected={selectedIndex !== -1}
              order={
                selectedIndex !== -1
                  ? selectedIndex + 1
                  : undefined
              }
              onClick={() => {
                if (ready && tile.letter !== '') onToggleTile(tile.id)
              }}
            />
          )
          return layout === 'wheel' ? <div key={tile.id} className="wheel-slot"
            style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }}>{content}</div> : content
        })}
      </div>

      {showActions && <BattleActions
        damage={damage}
        primaryLabel={primaryLabel}
        canAttack={canAttack}
        canClear={ready && selectedTileIds.length > 0}
        onClear={onClear}
        onAttack={onAttack}
      />}
    </>
  )
}
