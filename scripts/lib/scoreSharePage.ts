import { scoreSharePath } from '../../src/daily/scoreShare.ts'
import type { ShareStars } from '../../src/daily/scoreShare.ts'
import { normalizePublicSiteUrl } from '../../src/lib/publicSiteUrl.ts'

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
export const scoreCardFile = (stars: ShareStars) => `share-cards/${stars}-stars-v1.png`

/** Ordinary app HTML with server-readable, score-specific link metadata. */
export function scoreSharePage(appHtml: string, date: string, stars: ShareStars, site: string): string {
  const base = normalizePublicSiteUrl(site)
  const url = new URL(scoreSharePath(date, stars), base).href
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const result = stars === 3 ? 'Bingo in one word!' : stars === 2 ? 'Solved in two words' : 'Puzzle solved'
  const title = `WYRMLE · ${day} · ${'★'.repeat(stars)}`
  const description = `${result} Can you find the bingo? Play this daily word battle.`
  const alt = `${stars === 3 ? 'A delighted, smiling' : stars === 2 ? 'A cheerful' : 'A pleased'} wyrm with ${stars} of 3 stars. ${result}`
  const image = new URL(scoreCardFile(stars), base).href
  const metas = [
    ['property', 'og:type', 'website'], ['property', 'og:site_name', 'wyrmle'],
    ['property', 'og:title', title], ['property', 'og:description', description], ['property', 'og:url', url],
    ['property', 'og:image', image], ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'], ['property', 'og:image:alt', alt],
    ['name', 'description', description], ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title], ['name', 'twitter:description', description],
    ['name', 'twitter:image', image], ['name', 'twitter:image:alt', alt],
  ].map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escape(value)}" />`).join('\n')
  return appHtml
    .replace(/<meta\b(?=[^>]*(?:property|name)="(?:og:|twitter:)[^"]*")[^>]*>/g, '')
    .replace(/<meta\b(?=[^>]*name="description")[^>]*>/g, '')
    .replace(/<link\b(?=[^>]*rel="canonical")[^>]*>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace('</head>', `${metas}\n<link rel="canonical" href="${escape(url)}" />\n</head>`)
}
