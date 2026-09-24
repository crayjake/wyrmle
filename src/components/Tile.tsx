import { motion, useReducedMotion } from "framer-motion"
import type { Ref } from "react"
import type { Tile as GameTile } from "../game/types"
import { introTimings } from "../intro/config"

type TileProps = {
  letter: string
  selected?: boolean
  order?: number
  special?: GameTile["gem"]
  disabled?: boolean
  revealed?: boolean
  elementRef?: Ref<HTMLButtonElement>
  boardIndex?: number
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
  onClick,
}: TileProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      ref={elementRef}
      data-tile-index={boardIndex}
      data-revealed={revealed}
      type="button"
      className={[
        "tile",
        selected ? "selected" : "",
        special ? `special ${special}` : "",
      ].join(" ")}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${letter}${revealed && special ? `, ${special} tile` : ""}`}
      title={revealed && special ? (special === "ward" ? "Ward: protects Resolve" : "Power: bonus damage") : undefined}
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
          {special === "ward" ? "◇" : "◆"}
        </span>
      )}
    </motion.button>
  )
}
