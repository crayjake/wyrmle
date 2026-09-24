import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import { introTimings } from "../intro/config"

type EnemyProps = {
  name: string
  definition: string
  partOfSpeech?: string
  revealedIndices: readonly number[]
  registerLetter: (index: number, element: HTMLDivElement | null) => void
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@"

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function Enemy({
  name,
  definition,
  partOfSpeech,
  revealedIndices,
  registerLetter,
}: EnemyProps) {
  const letters = name.toUpperCase().split("")
  const reducedMotion = useReducedMotion()
  const decoded = letters.every((_, index) => revealedIndices.includes(index))

  const [display, setDisplay] = useState(
    letters.map(() => randomGlyph())
  )

  useEffect(() => {
    if (decoded || reducedMotion) return

    const scramble = window.setInterval(() => {
      setDisplay(name.split("").map(() => randomGlyph()))
    }, introTimings.enemyScrambleMs)

    return () => window.clearInterval(scramble)
  }, [name, decoded, reducedMotion])

  return (
    <div className="enemy-section">
      <div className="enemy-container">
        {letters.map((letter, i) => {
          const revealed = revealedIndices.includes(i)

          return (
            <motion.div
              key={i}
              ref={element => registerLetter(i, element)}
              data-enemy-index={i}
              data-revealed={revealed}
              className={`enemy-letter ${revealed ? "resolved" : "scrambled"}`}
              initial={false}
              animate={{
                opacity: revealed ? 1 : 0.6,
                scale: revealed && !reducedMotion ? [1, 1.1, 1] : 1,
              }}
              transition={{
                duration: reducedMotion ? introTimings.reducedStage : introTimings.enemyLockIn,
                ease: "easeOut",
              }}
            >
              {revealed ? letter : display[i]}
            </motion.div>
          )
        })}
      </div>

      <motion.div
        className="enemy-definition"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
        animate={
          decoded
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: reducedMotion ? 0 : 4 }
        }
        transition={{ duration: reducedMotion ? introTimings.reducedStage : introTimings.definitionFade }}
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
