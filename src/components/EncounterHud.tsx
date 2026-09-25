import type { BattleEvent } from '../game/hud'
import { getDisplayEffectLabel } from '../game/letterStrikeHud'
import './EncounterHud.css'

type EncounterHudProps = {
  visible: boolean
  events: readonly BattleEvent[]
  metric?: 'damage' | 'strikes'
}

export default function EncounterHud({ visible, events, metric = 'damage' }: EncounterHudProps) {
  if (events.length === 0) return null

  return (
    <aside
      className="encounter-hud"
      aria-label="Recently played words"
      aria-hidden={!visible}
      data-visible={visible}
      data-metric={metric}
    >
      <div className="encounter-hud-label">RECENT</div>
      <ol className="encounter-hud-history" aria-label="Recent words, newest first">
        {events.map(event => (
          <li key={event.id} aria-label={`${event.word}, ${event.damage} ${metric === 'strikes' ? (event.damage === 1 ? 'hit' : 'hits') : 'damage'}, ${[event.semanticLabel, ...event.effectLabels.map(getDisplayEffectLabel)].join(', ')}`}>
            <span className="encounter-hud-word" title={event.word}>{event.word}</span>
            <span className="encounter-hud-damage">{event.damage} {metric === 'strikes' ? (event.damage === 1 ? 'HIT' : 'HITS') : 'DMG'}</span>
            <span className="encounter-hud-result">
              <span className={event.semanticLabel === 'COUNTER' ? 'hud-counter' : ['RESISTED', 'RELATED'].includes(event.semanticLabel) ? 'hud-negative' : undefined}>
                {event.semanticLabel}
              </span>
              {event.effectLabels.map(label => (
                <span className="encounter-hud-effect" key={label}>
                  <span className="encounter-hud-dot" aria-hidden="true">·</span>{getDisplayEffectLabel(label)}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
