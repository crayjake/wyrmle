import { useEffect, useRef, useState } from "react"

import Tile from "./Tile"
import BattleActions from "./BattleActions"

type TileData = {
  id: number
  letter: string
  special?: "sapphire"
}

const tiles: TileData[] = [
  { id: 1, letter: "B" },
  { id: 2, letter: "A" },
  { id: 3, letter: "L" },
  { id: 4, letter: "T" },

  { id: 5, letter: "L" },
  { id: 6, letter: "O" },
  { id: 7, letter: "O", special: "sapphire" },
  { id: 8, letter: "N" },

  { id: 9, letter: "E" },
  { id: 10, letter: "D" },
  { id: 11, letter: "R" },
  { id: 12, letter: "S" },

  { id: 13, letter: "I" },
  { id: 14, letter: "M" },
  { id: 15, letter: "U" },
  { id: 16, letter: "G" },
]

type TileGridProps = {
  active: boolean
  ready: boolean
  onDecoded?: () => void
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@"

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function TileGrid({
  active,
  ready,
  onDecoded,
}: TileGridProps) {
  const [selected, setSelected] = useState<number[]>([])

  const [displayLetters, setDisplayLetters] = useState(
    tiles.map(() => randomGlyph())
  )

  const [revealed, setRevealed] = useState(0)
  const revealedRef = useRef(0)

  // Keep unrevealed tiles scrambling.
  useEffect(() => {
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
  }, [])

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
  }, [active])

  function toggleTile(id: number) {
    if (!ready) return

    setSelected(current =>
      current.includes(id)
        ? current.filter(tileId => tileId !== id)
        : [...current, id]
    )
  }

  function clear() {
    setSelected([])
  }

  return (
    <>
      <div className="tile-grid">
        {tiles.map((tile, i) => {
          const selectedIndex =
            selected.indexOf(tile.id)

          return (
            <Tile
              key={tile.id}
              letter={displayLetters[i]}
              special={tile.special}
              revealed={i < revealed}
              disabled={!ready}
              selected={selectedIndex !== -1}
              order={
                selectedIndex !== -1
                  ? selectedIndex + 1
                  : undefined
              }
              onClick={() => toggleTile(tile.id)}
            />
          )
        })}
      </div>

      <BattleActions
        damage={19}
        canAttack={
          ready && selected.length >= 3
        }
        onClear={clear}
        onAttack={() => {
          console.log("attack")
        }}
      />
    </>
  )
}