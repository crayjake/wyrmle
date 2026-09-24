import HealthBar from "./HealthBar"

type HealthInfoProps = {
  name: string
  health: number
  maxHealth: number
  segments?: number
  colour?: "green" | "red"
  left?: boolean
  reversed?: boolean
}

type BasicHealthInfoProps = {
  name: string
  health: number
  maxHealth: number
}

export default function HealthInfo({
  name,
  health,
  maxHealth,
  segments = 10,
  colour = "green",
  left = false,
  reversed = false,
}: HealthInfoProps) {
  return (
    <div className={`health-info ${left ? "left" : ""}`}>
      <div className="name">{name}</div>

      <div className="health">
        {health}/{maxHealth}
      </div>

      <HealthBar
        health={health}
        maxHealth={maxHealth}
        segments={segments}
        colour={colour}
        reversed={reversed}
      />
    </div>
  )
}

export function MyInfo(props: BasicHealthInfoProps) {
  return (
    <HealthInfo
      {...props}
      left
      segments={5}
      colour="green"
    />
  )
}

export function EnemyInfo(props: BasicHealthInfoProps) {
  return (
    <HealthInfo
      {...props}
      segments={10}
      colour="red"
      reversed
    />
  )
}