import { motion, useReducedMotion } from "framer-motion"
import { introTimings } from "../intro/config"
import "./WyrmCharacter.css"

type WyrmCharacterProps = {
  idle: boolean
}

// Offset each segment along the same wave so the little body slithers as a
// whole. The last frame matches the first, keeping the repeat seamless.
function bodyWave(segment: number, amplitude: number) {
  return Array.from({ length: 9 }, (_, frame) =>
    Math.sin((frame / 8) * Math.PI * 2 - segment * Math.PI / 2) * amplitude,
  )
}

export default function WyrmCharacter({ idle }: WyrmCharacterProps) {
  const reducedMotion = useReducedMotion()
  const amplitude = idle ? 0.65 : 1.4
  const duration = idle ? introTimings.idleWiggle : introTimings.travelWiggle
  const waveTransition = reducedMotion
    ? { duration: 0 }
    : { duration, ease: "linear" as const, repeat: Infinity }

  return (
    <span className="wyrm-character" aria-hidden="true">
      <span className="wyrm-character-body">
        {[0, 1, 2, 3].map(segment => (
          <motion.span
            key={segment}
            initial={false}
            animate={{ y: reducedMotion ? 0 : bodyWave(segment, amplitude) }}
            transition={waveTransition}
          />
        ))}
      </span>
      <motion.span
        className="wyrm-character-head"
        initial={false}
        animate={{
          y: reducedMotion ? 0 : bodyWave(4, amplitude * 0.4),
          rotate: reducedMotion ? 0 : bodyWave(4, idle ? 1 : 2),
        }}
        transition={waveTransition}
      >
        <motion.span
          className="wyrm-character-tongue"
          initial={false}
          animate={{ scaleX: reducedMotion ? 1 : [0, 0, 1, 0, 0] }}
          transition={reducedMotion ? { duration: 0 } : {
            duration: introTimings.tongueFlick,
            times: [0, 0.82, 0.86, 0.9, 1],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      </motion.span>
    </span>
  )
}
