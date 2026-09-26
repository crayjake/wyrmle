import entries from './catalog.json' with { type: 'json' }

export type PreviewLives = 3 | 4 | 5
export type BingoPreviewEntry = { id: string; title: string; enemy: string; enemyHP: number; asset: string }
export type BingoPreviewRequest = { id: string; lives: PreviewLives }
export const bingoPreviews: readonly BingoPreviewEntry[] = Object.freeze(entries.map(entry => Object.freeze(entry)))

/** Recognise the preview namespace before mounting any daily persistence hooks. */
export function readBingoPreviewRequest(search: string): BingoPreviewRequest | null {
  const params = new URLSearchParams(search)
  const id = params.get('preview')
  if (id !== 'bingo' && id !== 'bingos' && !id?.startsWith('bingo-')) return null
  const lives = params.get('lives')
  return { id, lives: lives === '4' ? 4 : lives === '5' ? 5 : 3 }
}

export function bingoPreviewHref(id: string, lives: PreviewLives = 3): string {
  return `?${new URLSearchParams({ preview: id, lives: String(lives) })}`
}

export function leaveBingoPreviewHref(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('preview')
  url.searchParams.delete('lives')
  return url.href
}
