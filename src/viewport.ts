// Safari can restore a standalone window before its dynamic viewport units
// settle. Measure before React mounts, then follow toolbar/orientation changes.
// Pinch zoom must magnify the existing layout, not resize the board beneath it.
export function trackViewport() {
  const viewport = window.visualViewport
  let frame = 0
  function measure() {
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return
    const height = viewport?.height ?? window.innerHeight
    if (height > 0) document.documentElement.style.setProperty('--app-height', `${height}px`)
  }
  function schedule() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(measure)
  }
  measure()
  schedule()
  window.addEventListener('resize', schedule)
  window.addEventListener('pageshow', schedule)
  viewport?.addEventListener('resize', schedule)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('pageshow', schedule)
    viewport?.removeEventListener('resize', schedule)
  }
}
