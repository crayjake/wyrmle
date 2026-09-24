type HealthBarProps = {
  health: number
  maxHealth: number
  segments?: number
  colour?: "green" | "red"
  reversed?: boolean
}

export default function HealthBar({
  health,
  maxHealth,
  segments = 10,
  colour = "green",
  reversed = false,
}: HealthBarProps) {
  const filled = Math.ceil((health / maxHealth) * segments)

  return (
    <div className={`health-bar ${reversed ? "enemy" : ""}`}>
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className={`health-box ${i < filled ? "filled" : ""} ${colour}`}
        />
      ))}
    </div>
  )
}