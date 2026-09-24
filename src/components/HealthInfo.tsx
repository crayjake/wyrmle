import HealthBar from "./HealthBar"

type HealthInfoProps = {
  name: string
  health: number
  maxHealth: number
  segments?: number
  colour?: "green" | "red"
  left?: boolean
  reversed?: boolean
  compact?: boolean
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
  compact = false,
}: HealthInfoProps) {
  return (
    <div className={`health-info ${left ? "left" : ""} ${compact ? 'health-info-compact' : ''}`}>
      <div className="name">{name}</div>

      {!compact && <div className="health">
        {health}/{maxHealth}
      </div>}

      <div className="health-segments" role="meter" aria-label={name}
        aria-valuemin={0} aria-valuemax={maxHealth} aria-valuenow={health}
        aria-valuetext={`${health} of ${maxHealth}`}>
        <HealthBar
          health={health}
          maxHealth={maxHealth}
          segments={segments}
          colour={colour}
          reversed={reversed}
        />
      </div>
    </div>
  )
}

export function MyInfo(props: BasicHealthInfoProps) {
  return (
    <HealthInfo
      {...props}
      left
      compact
      segments={props.maxHealth}
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
