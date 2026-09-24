import { useEffect, useRef, useState } from "react"

import Tile from "./Tile"
import BattleActions from "./BattleActions"
import type { Tile as GameTile } from "../game/types"

type TileGridProps = {
  active: boolean
  ready: boolean
  tiles: GameTile[]
  selectedTileIds: number[]
  damage: number
  canAttack: boolean
  onToggleTile: (id: number) => void
  onClear: () => void
  onAttack: () => void
  onDecoded?: () => void
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@"

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function TileGrid({
  active,
  ready,
  tiles,
  selectedTileIds,
  damage,
  canAttack,
  onToggleTile,
  onClear,
  onAttack,
  onDecoded,
}: TileGridProps) {
  const [displayLetters, setDisplayLetters] = useState(
    tiles.map(() => randomGlyph())
  )

  const [revealed, setRevealed] = useState(0)
  const revealedRef = useRef(0)

  // Keep unrevealed tiles scrambling.
  useEffect(() => {
    if (revealedRef.current >= tiles.length) return
    const scramble = window.setInterval(() => {
      setDisplayLetters(
        tiles.map((tile, i) =>
          i < revealedRef.current
            ? tile.letter
            : randomGlyph()
        )
      )
    }, 65)

    return () => window.clearInterval(scramble)
  }, [tiles, active])

  // Decode tiles after enemy finishes.
  useEffect(() => {
    if (!active) return

    let decode: number
    let finish: number

    const delay = window.setTimeout(() => {
      decode = window.setInterval(() => {
        const next = revealedRef.current + 1

        revealedRef.current = next
        setRevealed(next)

        setDisplayLetters(
          tiles.map((tile, i) =>
            i < next
              ? tile.letter
              : randomGlyph()
          )
        )

        if (next >= tiles.length) {
          window.clearInterval(decode)

          setDisplayLetters(
            tiles.map(tile => tile.letter)
          )

          finish = window.setTimeout(() => {
            onDecoded?.()
          }, 350)
        }
      }, 115)
    }, 250)

    return () => {
      window.clearTimeout(delay)
      window.clearInterval(decode)
      window.clearTimeout(finish)
    }
  }, [active, tiles, onDecoded])

  return (
    <>
      <div className="tile-grid">
        {tiles.map((tile, i) => {
          const selectedIndex =
            selectedTileIds.indexOf(tile.id)

          return (
            <Tile
              key={tile.id}
              letter={i < revealed ? tile.letter : displayLetters[i]}
              special={tile.type === "gem" ? tile.gem : undefined}
              revealed={i < revealed}
              disabled={!ready}
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
        canAttack={canAttack}
        canClear={ready && selectedTileIds.length > 0}
        onClear={onClear}
        onAttack={onAttack}
      />
    </>
  )
}
