import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

/** Keep the original battle proportions, shrinking only a board that cannot fit. */
export function useBattleFit(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const main = ref.current
    const controls = main?.querySelector<HTMLElement>('.controls')
    const player = main?.querySelector<HTMLElement>('.player-zone')
    const grid = controls?.querySelector<HTMLElement>('.tile-grid')
    if (!main || !controls || !player || !grid) return
    const height = (element: Element) => element.getBoundingClientRect().height
    const numeric = (value: string) => parseFloat(value) || 0
    function fit() {
      if (!main!.isConnected || !grid!.isConnected) return
      const style = getComputedStyle(main!)
      const playerExtras = height(player!) - height(grid!)
      let available = main!.clientHeight - numeric(style.paddingTop) - numeric(style.paddingBottom) - playerExtras
      if (style.display !== 'grid') {
        const rows = [...main!.children].filter(element => element !== player
          && !['absolute', 'fixed'].includes(getComputedStyle(element).position)
          && element.tagName !== 'DIALOG')
        available -= rows.length * numeric(style.rowGap)
        for (const row of rows) {
          // The enemy zone can expand into spare space; use its actual content.
          available -= row.classList.contains('enemy-zone')
            ? [...row.children].reduce((sum, child) => sum + height(child), 0)
            : height(row)
          const rowStyle = getComputedStyle(row)
          available -= numeric(rowStyle.marginTop) + numeric(rowStyle.marginBottom)
        }
      }
      controls!.style.setProperty('--board-fit', `${Math.max(0, Math.floor(available - 2))}px`)
      main!.scrollTop = 0
    }
    fit()
    const observer = new ResizeObserver(fit)
    for (const element of [main, ...main.querySelectorAll('.header, .battle-info, .enemy-section, .attack-info')]) observer.observe(element)
    document.fonts.addEventListener('loadingdone', fit)
    return () => {
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', fit)
    }
  }, [ref])
}
