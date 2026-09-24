import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

type EnemyProps = {
  name: string
  active: boolean
  onDecoded?: () => void
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@"

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function Enemy({
  name,
  active,
  onDecoded,
}: EnemyProps) {
  const letters = name.toUpperCase().split("")

  const [display, setDisplay] = useState(
    letters.map(() => randomGlyph())
  )

  const [resolved, setResolved] = useState(0)
  const resolvedRef = useRef(0)

  // Keep unresolved letters glitching.
  useEffect(() => {
    const scramble = window.setInterval(() => {
      setDisplay(
        letters.map((letter, i) =>
          i < resolvedRef.current
            ? letter
            : randomGlyph()
        )
      )
    }, 70)

    return () => window.clearInterval(scramble)
  }, [name])

  // Decode enemy after start.
  useEffect(() => {
    if (!active) return

    let decode: number
    let finish: number

    const delay = window.setTimeout(() => {
      decode = window.setInterval(() => {
        const next = resolvedRef.current + 1

        resolvedRef.current = next
        setResolved(next)

        setDisplay(
          letters.map((letter, i) =>
            i < next ? letter : randomGlyph()
          )
        )

        if (next >= letters.length) {
          window.clearInterval(decode)

          setDisplay(letters)

          finish = window.setTimeout(() => {
            onDecoded?.()
          }, 400)
        }
      }, 190)
    }, 350)

    return () => {
      window.clearTimeout(delay)
      window.clearInterval(decode)
      window.clearTimeout(finish)
    }
  }, [active])

  return (
    <div className="enemy-container">
      {display.map((letter, i) => (
        <motion.div
          key={i}
          className={`enemy-letter ${
            i < resolved ? "resolved" : "scrambled"
          }`}
          animate={
            i < resolved
              ? {
                  opacity: 1,
                  scale: [1, 1.18, 0.96, 1],
                  y: [0, -4, 1, 0],
                }
              : {
                  opacity: 0.55,
                }
          }
          transition={{
            duration: 0.4,
          }}
        >
          {letter}
        </motion.div>
      ))}
    </div>
  )
}