import { useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"

import Tile from "./Tile"
import type { SpecialTilePresentation } from "./Tile"
import BattleActions from "./BattleActions"
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
  matchHint = 'off',
  damage,
  primaryLabel,
  canAttack,
  onToggleTile,
  onSelectTiles,
  onClear,
  onAttack,
}: TileGridProps) {
  const reducedMotion = useReducedMotion()
  const matchingIds = new Set(import.meta.env.DEV && matchHint !== 'off'
    ? getMatchingTileIds(tiles, enemyLetters) : [])
  const decoded = tiles.every((_, index) => revealedIndices.includes(index))
  const [displayLetters, setDisplayLetters] = useState(
    tiles.map(() => randomGlyph())
  )
  const gridRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{ selection: TileSelectionGesture; bounds: TileGestureBounds[]; board: string } | null>(null)
  const pointerClickUntil = useRef(0)
  const board = tiles.map(tile => `${tile.id}:${tile.letter}`).join('|')

  function cancelGesture() {
    const gesture = gestureRef.current
    if (!gesture) return
    gestureRef.current = null
    pointerClickUntil.current = performance.now() + 600
    if (gridRef.current?.hasPointerCapture(gesture.selection.pointerId)) {
      gridRef.current.releasePointerCapture(gesture.selection.pointerId)
    }
  }

  // A submitted/replaced board cannot inherit a gesture from the previous turn.
  useEffect(() => {
    if (!ready || (gestureRef.current && gestureRef.current.board !== board)) cancelGesture()
  }, [ready, board])

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
    for (const id of started.addedIds) onToggleTile(id)
  }

  function moveGesture(event: ReactPointerEvent<HTMLDivElement>) {
    let gesture = gestureRef.current
    if (!gesture || event.pointerId !== gesture.selection.pointerId || !ready || gesture.board !== board) return
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
      <div className="tile-grid" ref={gridRef} data-swipe-ready={ready}
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
          if (event.detail !== 0 && performance.now() < pointerClickUntil.current) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        {tiles.map((tile, i) => {
          const selectedIndex =
            selectedTileIds.indexOf(tile.id)
          const revealed = revealedIndices.includes(i)

          return (
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
        })}
      </div>

      <BattleActions
        damage={damage}
        primaryLabel={primaryLabel}
        canAttack={canAttack}
        canClear={ready && selectedTileIds.length > 0}
        onClear={onClear}
        onAttack={onAttack}
      />
    </>
  )
}
