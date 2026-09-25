import { motion, useReducedMotion } from "framer-motion"
import { Heart } from 'lucide-react'
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
  empty?: boolean
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
  empty = false,
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
      data-empty={empty || undefined}
      data-match-hint={revealed && matchHint !== 'off' ? matchHint : undefined}
      type="button"
      className={[
        "tile",
        empty ? 'tile-empty' : '',
        selected ? "selected" : "",
        special ? `special ${special.id}` : "",
      ].join(" ")}
      disabled={disabled || empty}
      aria-pressed={selected}
      aria-label={empty ? 'Empty tile slot' : `${letter}${revealed && special ? `, ${special.label} tile` : ""}${revealed && matchHint !== 'off' ? ', matches a surviving enemy letter' : ''}`}
      title={revealed && special ? `${special.label}${special.detail ? `: ${special.detail}` : ""}` : undefined}
      onClick={empty ? undefined : onClick}
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
        {empty ? '' : letter}
      </span>

      {selected && order !== undefined && (
        <span className="tile-order">
          {order}
        </span>
      )}

      {!empty && revealed && special && (
        <span className="tile-special">
          <span className="tile-special-symbol" aria-hidden="true">
            {special.symbol === '♥' ? <Heart size={12} fill="currentColor" strokeWidth={1.5} aria-hidden="true" /> : special.symbol === '◆' || special.symbol === '◇' ? (
              <svg viewBox="0 0 12 12" focusable="false">
                <path
                  d="M6 1.5 10.5 6 6 10.5 1.5 6Z"
                  fill={special.symbol === '◆' ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
              </svg>
            ) : special.symbol}
          </span>
          <span className="tile-special-label">{special.label}</span>
        </span>
      )}
    </motion.button>
  )
}
