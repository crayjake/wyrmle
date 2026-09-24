import type { MatchHintMode } from './tileMatchHints'

export default function MatchHintControls({ value, onChange }: {
  value: MatchHintMode
  onChange: (value: MatchHintMode) => void
}) {
  if (!import.meta.env.DEV) return null
  return <fieldset className="dev-match-hints">
    <legend>MATCH HINT</legend>
    <div className="dev-controls">
      {(['off', 'dot', 'underline'] as const).map(mode => <button
        className="daily-button" type="button" key={mode} aria-pressed={value === mode}
        onClick={() => onChange(mode)}>{mode.toUpperCase()}</button>)}
    </div>
    <p>Marks letters still in the enemy. Actual strike targets depend on your word.</p>
  </fieldset>
}
