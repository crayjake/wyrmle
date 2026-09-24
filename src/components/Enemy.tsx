import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { introTimings } from "../intro/config"
import type { GrammarModifier } from "../game/hud"

type EnemyLetterState = {
  id: string
  letter: string
  hitsRemaining: number
  initialHits?: number
}

type EnemyProps = {
  name: string
  definition: string
  partOfSpeech?: string
  revealedIndices: readonly number[]
  registerLetter: (index: number, element: HTMLDivElement | null) => void
  modifiers: readonly GrammarModifier[]
  letterStates?: readonly EnemyLetterState[]
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
  modifiers,
  letterStates,
}: EnemyProps) {
  const letters = letterStates?.map(state => state.letter) ?? name.toUpperCase().split("")
  const reducedMotion = useReducedMotion()
  const decoded = letters.every((_, index) => revealedIndices.includes(index))
  const activeModifiers = modifiers.filter(modifier => modifier.value !== 0)

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
      <div className="enemy-container" style={{ '--enemy-letter-count': letters.length } as CSSProperties}>
        {letters.map((letter, i) => {
          const revealed = revealedIndices.includes(i)
          const state = letterStates?.[i]
          const removed = state?.hitsRemaining === 0

          return (
            <motion.div
              key={state?.id ?? i}
              ref={element => registerLetter(i, element)}
              data-enemy-index={i}
              data-revealed={revealed}
              data-hits-remaining={state?.hitsRemaining}
              role={state ? 'img' : undefined}
              aria-label={state ? revealed
                ? `${letter}, ${removed ? 'removed' : `${state.hitsRemaining} ${state.hitsRemaining === 1 ? 'strike' : 'strikes'} remaining`}`
                : `Undecoded enemy letter ${i + 1}` : undefined}
              className={[
                'enemy-letter',
                revealed ? 'resolved' : 'scrambled',
                state && state.hitsRemaining > 1 ? 'enemy-letter-armoured' : '',
                removed ? 'enemy-letter-removed' : '',
              ].join(' ')}
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
              {removed ? '' : revealed ? letter : display[i]}
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
        {activeModifiers.length > 0 && (
          <ul className="enemy-matchups" aria-label="Enemy grammar matchups">
            {activeModifiers.map(modifier => (
              <li key={modifier.id}>
                <span>{modifier.label}</span>
                <span className={modifier.value > 0 ? 'enemy-matchup-positive' : 'enemy-matchup-negative'}>
                  {modifier.value > 0 ? '+' : ''}{modifier.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  )
}
