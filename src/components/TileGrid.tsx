import { useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"

import Tile from "./Tile"
import type { SpecialTilePresentation } from "./Tile"
import BattleActions from "./BattleActions"
import type { BattlePrimaryLabel } from "./BattleActions"
import { introTimings } from "../intro/config"
import { getMatchingTileIds } from './tileMatchHints'
import type { MatchHintMode } from './tileMatchHints'
import './TileReadability.css'

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
      <div className="tile-grid">
        {tiles.map((tile, i) => {
          const selectedIndex =
            selectedTileIds.indexOf(tile.id)
          const revealed = revealedIndices.includes(i)

          return (
            <Tile
              key={tile.id}
              elementRef={element => registerTile(i, element)}
              boardIndex={i}
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
                if (ready) onToggleTile(tile.id)
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
