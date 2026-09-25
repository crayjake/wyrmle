export const DEFAULT_PUBLIC_SITE_URL = 'https://crayjake.github.io/wyrmle/'

/** The public entry point shared by link previews and copied results. */
export function normalizePublicSiteUrl(value: string): string {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol)
    || url.username || url.password || url.search || url.hash) {
    throw new Error('The public site URL must be an HTTP(S) URL without credentials, a query, or a fragment.')
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

export function getPublicSiteUrl(): string {
  const configuredUrl = (import.meta as ImportMeta & { env?: { VITE_SITE_URL?: string } }).env?.VITE_SITE_URL
  return normalizePublicSiteUrl(configuredUrl ?? DEFAULT_PUBLIC_SITE_URL)
}
