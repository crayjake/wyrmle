import type { Ref } from 'react'
import './WyrmLifeMeter.css'

export default function WyrmLifeMeter({ lives, maximum, dockRef, hidden = false }: {
  lives: number
  maximum: number
  dockRef?: Ref<HTMLSpanElement>
  hidden?: boolean
}) {
  const remaining = Math.max(0, Math.min(maximum, lives))
  return <span ref={dockRef} className="wyrm-life-meter" data-decoding={hidden || undefined} aria-hidden="true">
    {Array.from({ length: Math.max(0, maximum - 1) }, (_, index) => <span key={index}
      className={`wyrm-life-segment${index === 0 ? ' wyrm-life-tail' : ''}${remaining > maximum - index - 1 ? ' is-filled' : ''}`} />)}
    <span className={`wyrm-life-head${remaining > 0 ? ' is-filled' : ''}`}>
      <span className="wyrm-life-tongue" />
    </span>
  </span>
}
