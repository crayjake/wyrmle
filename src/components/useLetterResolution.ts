import { useEffect, useRef, useState } from 'react'

export type LetterResolutionHit = {
  enemyLetterId: string
  hitsBefore: number
  hitsAfter: number
}

type ResolutionFrame = {
  key: string | number
  applied: number
  complete: boolean
}

const noHits: readonly LetterResolutionHit[] = []
const strikeDurationMs = 110

/** Play committed engine events in selection order without changing game state. */
export function useLetterResolution(
  resolvedHits: readonly LetterResolutionHit[] | undefined,
  resolutionKey: string | number | undefined,
  reducedMotion: boolean | null,
  onResolutionComplete: (() => void) | undefined,
) {
  const hits = resolvedHits ?? noHits
  const [frame, setFrame] = useState<ResolutionFrame | null>(null)
  const completedKey = useRef<string | number | undefined>(undefined)
  const complete = useRef(onResolutionComplete)

  useEffect(() => {
    complete.current = onResolutionComplete
  }, [onResolutionComplete])

  useEffect(() => {
    if (resolutionKey === undefined || completedKey.current === resolutionKey) return
    const key = resolutionKey

    if (reducedMotion || hits.length === 0) {
      // The render already uses final state. Finish asynchronously so effect
      // setup never forces a second synchronous render or survives cleanup.
      const timer = setTimeout(() => {
        completedKey.current = key
        setFrame({ key, applied: hits.length, complete: true })
        complete.current?.()
      }, 0)
      return () => clearTimeout(timer)
    }

    let applied = 0
    let timer: ReturnType<typeof setTimeout>
    function advance() {
      if (applied === hits.length) {
        completedKey.current = resolutionKey
        setFrame({ key, applied, complete: true })
        complete.current?.()
        return
      }
      applied += 1
      setFrame({ key, applied, complete: false })
      // Keep the final state visible for one beat before opening a result.
      timer = setTimeout(advance, strikeDurationMs)
    }

    timer = setTimeout(advance, strikeDurationMs)
    return () => clearTimeout(timer)
  }, [hits, resolutionKey, reducedMotion])

  const current = frame?.key === resolutionKey ? frame : null
  const resolving = resolutionKey !== undefined && hits.length > 0
    && !reducedMotion && !current?.complete
  const remainingById = new Map<string, number>()
  const applied = current?.applied ?? 0

  if (resolving) {
    // Restore each affected slot's pre-attack value, then replay only the
    // engine events reached by this visual frame. No UI targeting/scoring.
    for (const hit of hits) {
      if (!remainingById.has(hit.enemyLetterId)) remainingById.set(hit.enemyLetterId, hit.hitsBefore)
    }
    for (const hit of hits.slice(0, applied)) remainingById.set(hit.enemyLetterId, hit.hitsAfter)
  }

  return {
    remainingById,
    resolving,
    activeLetterId: resolving && applied > 0 ? hits[applied - 1]?.enemyLetterId : undefined,
  }
}
