import type { Ref } from 'react'
import './WyrmLifeMeter.css'

export function WyrmLifePart({ kind, filled }: { kind: 'tail' | 'body' | 'head'; filled: boolean }) {
  return <span className={`${kind === 'head' ? 'wyrm-life-head' : `wyrm-life-segment${kind === 'tail' ? ' wyrm-life-tail' : ''}`}${filled ? ' is-filled' : ''}`}>
    {kind === 'head' && <span className="wyrm-life-tongue" />}
  </span>
}

export default function WyrmLifeMeter({ lives, maximum, dockRef, hidden = false }: {
  lives: number
  maximum: number
  dockRef?: Ref<HTMLSpanElement>
  hidden?: boolean
}) {
  const remaining = Math.max(0, Math.min(maximum, lives))
  return <span ref={dockRef} className="wyrm-life-meter" data-decoding={hidden || undefined} aria-hidden="true">
    {Array.from({ length: Math.max(0, maximum - 1) }, (_, index) => <WyrmLifePart key={index}
      kind={index === 0 ? 'tail' : 'body'} filled={remaining > maximum - index - 1} />)}
    <WyrmLifePart kind="head" filled={remaining > 0} />
  </span>
}
