import HealthBar from "./HealthBar"
import WyrmLifeMeter from './WyrmLifeMeter'
import type { Ref } from 'react'

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

export function MyInfo({ wyrm = true, wyrmRef, decoding = false, animateLives = false, ...props }: BasicHealthInfoProps & {
  wyrm?: boolean
  wyrmRef?: Ref<HTMLSpanElement>
  decoding?: boolean
  animateLives?: boolean
}) {
  if (wyrm) return <div className="health-info left health-info-compact wyrm-life-info">
    <span className="resource-label" aria-hidden="true">{props.name}</span>
    <div className="health-segments wyrm-life-resource" role="meter" aria-label={props.name}
      aria-valuemin={0} aria-valuemax={props.maxHealth} aria-valuenow={props.health}
      aria-valuetext={`${props.health} of ${props.maxHealth}`}>
      <WyrmLifeMeter lives={props.health} maximum={props.maxHealth} dockRef={wyrmRef} hidden={decoding} animateLives={animateLives} />
    </div>
  </div>
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
