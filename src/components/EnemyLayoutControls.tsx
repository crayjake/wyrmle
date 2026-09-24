export default function EnemyLayoutControls({ grid, onChange }: {
  grid: boolean
  onChange: (grid: boolean) => void
}) {
  if (!import.meta.env.DEV) return null
  return <fieldset className="dev-match-hints">
    <legend>ENEMY LETTER LAYOUT</legend>
    <div className="dev-controls">
      <button className="daily-button" type="button" aria-pressed={!grid}
        onClick={() => onChange(false)}>ROW</button>
      <button className="daily-button" type="button" aria-pressed={grid}
        onClick={() => onChange(true)}>GRID AFTER REVEAL</button>
    </div>
    <p>DEV preview: larger enemy letters in a grid after the intro finishes. Letter order stays the same. Resets on reload.</p>
  </fieldset>
}
