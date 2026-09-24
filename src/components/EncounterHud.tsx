import type { BattleEvent, GrammarModifier, TileSummary } from "../game/hud"
import "./EncounterHud.css"

type EncounterHudProps = {
  visible: boolean
  modifiers: readonly GrammarModifier[]
  tiles: readonly TileSummary[]
  events: readonly BattleEvent[]
}

export default function EncounterHud({ visible, modifiers, tiles, events }: EncounterHudProps) {
  return (
    <aside
      className="encounter-hud"
      aria-label="Encounter status"
      aria-hidden={!visible}
      data-visible={visible}
    >
      {modifiers.length > 0 && (
        <section className="encounter-hud-section" aria-label="Encounter modifiers">
          <div className="encounter-hud-label">ENCOUNTER</div>
          <ul className="encounter-hud-row encounter-hud-grammar" aria-label="Active grammar modifiers">
            {modifiers.map(modifier => (
              <li key={modifier.id}>
                <span>{modifier.label}</span>
                <span className={modifier.value < 0 ? "hud-negative" : "hud-positive"}>
                  {modifier.value > 0 ? "+" : ""}{modifier.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tiles.length > 0 && (
        <section className="encounter-hud-section" aria-label="Board summary">
          <div className="encounter-hud-label">BOARD</div>
          <ul className="encounter-hud-row encounter-hud-tiles" aria-label="Current special tiles">
            {tiles.map(tile => (
              <li key={tile.id}>
                <span className="hud-positive" aria-hidden="true">{tile.symbol}</span>
                <span>{tile.label}</span>
                <span>×{tile.count}</span>
                <span className={tile.bonusDamage < 0 ? "hud-negative" : "hud-positive"}>{tile.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="encounter-hud-section encounter-hud-last-turn" aria-label="Last turn">
          <div className="encounter-hud-label">LAST TURN</div>
          <ol className="encounter-hud-history" aria-label="Recent attacks, newest first">
            {events.map(event => (
              <li key={event.id}>
                <span className="encounter-hud-word" title={event.word}>{event.word}</span>
                <span className="hud-positive">+{event.damage}</span>
                <span className="encounter-hud-result">
                  <span>{event.semanticLabel}</span>
                  {event.effectLabels.map(label => <span className="hud-positive" key={label}>{label}</span>)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  )
}
