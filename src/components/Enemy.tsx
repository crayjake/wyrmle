import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

type EnemyProps = {
  name: string
  definition: string
  partOfSpeech?: string
  active: boolean
  onDecoded?: () => void
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@"

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function Enemy({
  name,
  definition,
  partOfSpeech,
  active,
  onDecoded,
}: EnemyProps) {
  const letters = name.toUpperCase().split("")

  const [display, setDisplay] = useState(
    letters.map(() => randomGlyph())
  )

  const [resolved, setResolved] = useState(0)
  const resolvedRef = useRef(0)

  useEffect(() => {
    const scramble = window.setInterval(() => {
      setDisplay(
        letters.map((letter, i) =>
          i < resolvedRef.current ? letter : randomGlyph()
        )
      )
    }, 70)

    return () => window.clearInterval(scramble)
  }, [name])

  useEffect(() => {
    if (!active) return

    const decode = window.setInterval(() => {
      const next = resolvedRef.current + 1

      resolvedRef.current = next
      setResolved(next)

      if (next >= letters.length) {
        window.clearInterval(decode)
        setDisplay(letters)

        window.setTimeout(() => {
          onDecoded?.()
        }, 400)
      }
    }, 190)

    return () => window.clearInterval(decode)
  }, [active])

  const decoded = resolved >= letters.length

  return (
    <div className="enemy-section">
      <div className="enemy-container">
        {display.map((letter, i) => (
          <motion.div
            key={i}
            className={`enemy-letter ${
              i < resolved ? "resolved" : "scrambled"
            }`}
          >
            {letter}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="enemy-definition"
        initial={{ opacity: 0, y: 4 }}
        animate={
          decoded
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: 4 }
        }
        transition={{ duration: 0.35 }}
      >
        {partOfSpeech && (
          <span className="part-of-speech">
            {partOfSpeech}
          </span>
        )}

        <span>{definition}</span>
      </motion.div>
    </div>
  )
}