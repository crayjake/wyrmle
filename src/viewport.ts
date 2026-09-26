// Safari can restore a standalone window before its dynamic viewport units
// settle. Measure before React mounts, then follow toolbar/orientation changes.
// Pinch zoom must magnify the existing layout, not resize the board beneath it.
export function trackViewport() {
  const viewport = window.visualViewport
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  // An iPhone Home Screen app with viewport-fit=cover occupies the full screen.
  // WebKit can retain the browser's shorter visualViewport until the first
  // scroll. Screen dimensions are independent of that stale toolbar state.
  // Do not apply this to resizable desktop/iPad windows or ordinary Safari tabs.
  const fullScreenPhone = standalone && /iPhone|iPod/.test(navigator.userAgent)
  let frame = 0
  function measure() {
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return
    const landscape = window.matchMedia('(orientation: landscape)').matches
    const screenHeight = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height)
    const height = fullScreenPhone && screenHeight > 0 ? screenHeight : viewport?.height ?? window.innerHeight
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
  window.addEventListener('orientationchange', schedule)
  window.addEventListener('focus', schedule)
  viewport?.addEventListener('resize', schedule)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('pageshow', schedule)
    window.removeEventListener('orientationchange', schedule)
    window.removeEventListener('focus', schedule)
    viewport?.removeEventListener('resize', schedule)
  }
}
