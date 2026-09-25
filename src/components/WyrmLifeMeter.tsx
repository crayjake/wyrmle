import './BattleResources.css'

export default function WyrmLifeMeter({ lives, maximum }: { lives: number; maximum: number }) {
  const remaining = Math.max(0, Math.min(maximum, lives))
  return <span className="wyrm-life-meter" aria-hidden="true">
    {Array.from({ length: Math.max(0, maximum - 1) }, (_, index) => <span key={index}
      className={`wyrm-life-segment${index === 0 ? ' wyrm-life-tail' : ''}${remaining > maximum - index - 1 ? ' is-filled' : ''}`} />)}
    <span className={`wyrm-life-head${remaining > 0 ? ' is-filled' : ''}`}>
      <span className="wyrm-life-tongue" />
    </span>
  </span>
}
