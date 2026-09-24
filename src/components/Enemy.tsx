import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { introTimings } from "../intro/config"
import type { GrammarModifier } from "../game/hud"
import { useLetterResolution } from './useLetterResolution'
import type { LetterResolutionHit } from './useLetterResolution'
import './LetterCombat.css'
import './EnemyGrid.css'

type EnemyLetterState = {
  id: string
  letter: string
  hitsRemaining: number
  initialHits?: number
}

type EnemyProps = {
  name: string
  definition: string
  hideDefinition?: boolean
  partOfSpeech?: string
  revealedIndices: readonly number[]
  registerLetter: (index: number, element: HTMLDivElement | null) => void
  modifiers: readonly GrammarModifier[]
  modifierUnit?: string
  letterStates?: readonly EnemyLetterState[]
  predictedHits?: readonly LetterResolutionHit[]
  predictedRecoveries?: readonly LetterResolutionHit[]
  resolvedHits?: readonly LetterResolutionHit[]
  resolvedRecoveries?: readonly LetterResolutionHit[]
  resolutionKey?: string | number
  onResolutionComplete?: () => void
  experimentalGrid?: boolean
  introFinished?: boolean
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ?#%&@"

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export default function Enemy({
  name,
  definition,
  hideDefinition = false,
  partOfSpeech,
  revealedIndices,
  registerLetter,
  modifiers,
  modifierUnit,
  letterStates,
  predictedHits = [],
  predictedRecoveries = [],
  resolvedHits,
  resolvedRecoveries,
  resolutionKey,
  onResolutionComplete,
  experimentalGrid = false,
  introFinished = false,
}: EnemyProps) {
  const letters = letterStates?.map(state => state.letter) ?? name.toUpperCase().split("")
  const reducedMotion = useReducedMotion()
  const events = useMemo(() => [...(resolvedHits ?? []), ...(resolvedRecoveries ?? [])], [resolvedHits, resolvedRecoveries])
  const resolution = useLetterResolution(events, resolutionKey, reducedMotion, onResolutionComplete)
  const decoded = letters.every((_, index) => revealedIndices.includes(index))
  const gridEnabled = import.meta.env.DEV && experimentalGrid
  // Wait until the decoder is docked, so its targets never move mid-route.
  const gridActive = gridEnabled && introFinished && decoded
  const gridColumns = Math.min(5, letters.length)
  const activeModifiers = modifiers.filter(modifier => modifier.value !== 0)
  // Hits arrive in engine order. The final hit describes the target's exact
  // post-attack state, including multiple selected tiles hitting its armour.
  const predictedByLetter = new Map(predictedHits.map(hit => [hit.enemyLetterId, hit]))
  const recoveredByLetter = new Map(predictedRecoveries.map(hit => [hit.enemyLetterId, hit]))

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
    <div className="enemy-section" data-resolving={resolution.resolving || undefined}
      data-enemy-layout={gridActive ? 'grid' : 'row'} style={{
        '--enemy-letter-count': letters.length,
        '--enemy-grid-columns': gridColumns,
        '--enemy-grid-rows': Math.ceil(letters.length / gridColumns),
      } as CSSProperties}>
      <div className="enemy-letter-space">
        <div className="enemy-container">
          {letters.map((letter, i) => {
            const revealed = revealedIndices.includes(i)
            const state = letterStates?.[i]
            const hitsRemaining = state ? resolution.remainingById.get(state.id) ?? state.hitsRemaining : undefined
            const removed = hitsRemaining === 0
            const predicted = state && revealed && !removed && !resolution.resolving ? predictedByLetter.get(state.id) : undefined
            const targetOutcome = predicted ? (predicted.hitsAfter === 0 ? 'remove' : 'break') : undefined
            const targetDescription = targetOutcome === 'remove'
              ? hitsRemaining !== undefined && hitsRemaining > 1 ? 'armour will break and letter will be removed' : 'letter will be removed'
              : targetOutcome === 'break' ? 'armour will break' : undefined
            const recovery = state && revealed && !resolution.resolving ? recoveredByLetter.get(state.id) : undefined
            const recoveryDescription = recovery ? recovery.hitsBefore === 0 ? 'then REGEN revives this letter' : 'then REGEN restores armour' : undefined

            return (
              <motion.div
                key={state?.id ?? i}
                ref={element => registerLetter(i, element)}
                data-enemy-index={i}
                data-revealed={revealed}
                data-hits-remaining={hitsRemaining}
                data-struck={state && state.id === resolution.activeLetterId || undefined}
                data-regenerated={state && state.id === resolution.activeLetterId && resolution.activeIsRecovery || undefined}
                data-target-outcome={targetOutcome}
                data-recovery={recovery ? (recovery.hitsBefore === 0 ? 'revive' : 'armour') : undefined}
                title={[targetDescription, recoveryDescription].filter(Boolean).join('; ') || undefined}
                role={state ? 'img' : undefined}
                aria-label={state ? revealed
                  ? `${letter}, ${removed ? 'removed' : `${hitsRemaining} ${hitsRemaining === 1 ? 'strike' : 'strikes'} remaining`}${targetDescription ? `, targeted: ${targetDescription}` : ''}${recoveryDescription ? `, ${recoveryDescription}` : ''}`
                  : `Undecoded enemy letter ${i + 1}` : undefined}
                className={[
                  'enemy-letter',
                  revealed ? 'resolved' : 'scrambled',
                  hitsRemaining !== undefined && hitsRemaining > 1 ? 'enemy-letter-armoured' : '',
                  removed ? 'enemy-letter-removed' : '',
                ].join(' ')}
                initial={false}
                layout={gridEnabled && !reducedMotion}
                layoutDependency={gridActive}
                animate={{
                  opacity: revealed ? 1 : 0.6,
                  scale: revealed && !reducedMotion ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: reducedMotion ? introTimings.reducedStage : introTimings.enemyLockIn,
                  ease: "easeOut",
                  layout: { duration: 0.4, ease: 'easeInOut' },
                }}
              >
                <span className="enemy-letter-glyph" aria-hidden={state ? true : undefined}>
                  {revealed ? removed ? '·' : letter : display[i]}
                </span>
                {targetOutcome && <span className="enemy-target-marker" aria-hidden="true">
                  {targetOutcome === 'break' ? '−' : '×'}
                </span>}
                {recovery && <span className="enemy-recovery-marker" aria-hidden="true">+{removed ? letter : ''}</span>}
              </motion.div>
            )
          })}
        </div>
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

        {!hideDefinition && <span>{definition}</span>}
        {activeModifiers.length > 0 && (
          <ul className="enemy-matchups" aria-label="Enemy grammar matchups">
            {activeModifiers.map((modifier, index) => (
              <li key={modifier.id}>
                {modifierUnit === 'STRIKE' ? <>
                  {index > 0 && <span className="enemy-matchup-divider" aria-hidden="true">·</span>}
                  <span className={modifier.value > 0 ? 'enemy-matchup-positive' : 'enemy-matchup-negative'}
                    title={`${modifier.label} ${modifier.value > 0 ? '+' : ''}${modifier.value} STRIKE`}>
                    {modifier.label}
                    <span className="enemy-matchup-detail"> {modifier.value > 0 ? '+' : ''}{modifier.value} STRIKE</span>
                  </span>
                </> : <>
                  <span>{modifier.label}</span>
                  <span className={modifier.value > 0 ? 'enemy-matchup-positive' : 'enemy-matchup-negative'}>
                    {modifier.value > 0 ? '+' : ''}{modifier.value}
                    {modifierUnit ? ` ${modifierUnit}` : ''}
                  </span>
                </>}
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  )
}
