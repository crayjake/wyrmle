import { motion, useReducedMotion } from "framer-motion"
import type { Ref } from "react"
import { introTimings } from "../intro/config"
import type { MatchHintMode } from './tileMatchHints'

export type SpecialTilePresentation = {
  id: string
  label: string
  symbol: string
  detail: string
}

type TileProps = {
  letter: string
  selected?: boolean
  order?: number
  special?: SpecialTilePresentation
  disabled?: boolean
  revealed?: boolean
  elementRef?: Ref<HTMLButtonElement>
  boardIndex?: number
  matchHint?: MatchHintMode
  onClick?: () => void
}

export default function Tile({
  letter,
  selected = false,
  order,
  special,
  disabled = false,
  revealed = false,
  elementRef,
  boardIndex,
  matchHint = 'off',
  onClick,
}: TileProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      ref={elementRef}
      data-tile-index={boardIndex}
      data-revealed={revealed}
      data-match-hint={revealed && matchHint !== 'off' ? matchHint : undefined}
      type="button"
      className={[
        "tile",
        selected ? "selected" : "",
        special ? `special ${special.id}` : "",
      ].join(" ")}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${letter}${revealed && special ? `, ${special.label} tile` : ""}${revealed && matchHint !== 'off' ? ', matches a surviving enemy letter' : ''}`}
      title={revealed && special ? `${special.label}${special.detail ? `: ${special.detail}` : ""}` : undefined}
      onClick={onClick}
      animate={
        reducedMotion
          ? { opacity: revealed ? 1 : 0.5, scale: 1, y: 0 }
          : revealed
          ? {
              opacity: 1,
              scale: [1, 1.16, 0.95, 1],
              y: [0, -5, 1, 0],
            }
          : {
              opacity: 0.5,
            }
      }
      transition={{
        duration: reducedMotion ? introTimings.reducedStage : introTimings.lockIn,
        ease: "easeOut",
      }}
    >
      <span className="tile-letter">
        {letter}
      </span>

      {selected && order !== undefined && (
        <span className="tile-order">
          {order}
        </span>
      )}

      {revealed && special && (
        <span className="tile-special">
          <span aria-hidden="true">{special.symbol}</span>
          <span>{special.label}</span>
        </span>
      )}
    </motion.button>
  )
}
