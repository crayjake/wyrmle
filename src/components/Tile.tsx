import { motion } from "framer-motion"

type TileProps = {
  letter: string
  selected?: boolean
  order?: number
  special?: "sapphire"
  disabled?: boolean
  revealed?: boolean
  onClick?: () => void
}

export default function Tile({
  letter,
  selected = false,
  order,
  special,
  disabled = false,
  revealed = false,
  onClick,
}: TileProps) {
  return (
    <motion.button
      type="button"
      className={[
        "tile",
        selected ? "selected" : "",
        special ? `special ${special}` : "",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      animate={
        revealed
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
        duration: 0.45,
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

      {revealed && special === "sapphire" && (
        <span className="tile-special">
          ◆
        </span>
      )}
    </motion.button>
  )
}