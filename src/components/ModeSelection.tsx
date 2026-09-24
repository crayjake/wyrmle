import { useId } from 'react'
import type { DifficultyMode } from '../daily/types'
import './Onboarding.css'

export function ModeChoices({ value, onChange }: {
  value: DifficultyMode
  onChange: (mode: DifficultyMode) => void
}) {
  const name = useId()
  return <fieldset className="mode-choices">
    <legend>Choose your mode</legend>
    {(['normal', 'hard'] as const).map(mode => <label className="mode-choice" key={mode}>
      <input type="radio" name={name} value={mode} checked={value === mode} onChange={() => onChange(mode)} />
      <span className="mode-choice-copy">
        <span className="mode-choice-heading">{mode}<span className="mode-recommended">{mode === 'normal' ? 'Recommended' : ''}</span></span>
        <span className="mode-choice-description">Definitions {mode === 'normal' ? 'shown' : 'hidden'}</span>
      </span>
    </label>)}
  </fieldset>
}

export default function ModeSelection({ value, onChange, onPlay, completedTutorial, error }: {
  value: DifficultyMode
  onChange: (mode: DifficultyMode) => void
  onPlay: () => void
  completedTutorial: boolean
  error: string | null
}) {
  return <main className="container onboarding-mode">
    <header className="header"><div className="title">WYRMLE</div></header>
    <div className="onboarding-choice">
      <h1>{completedTutorial ? "You're ready." : "Today's Wyrmle."}</h1>
      <ModeChoices value={value} onChange={onChange} />
      <p className="mode-note">Same puzzle. Choose how much information you see.</p>
      <button className="begin-button" type="button" onClick={onPlay}>Play today's Wyrmle</button>
      <p className="mode-note">You can change your preference in Settings.</p>
      {error && <p className="mode-save-error" role="status">{error}</p>}
    </div>
  </main>
}
