import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { DEFAULT_PUBLIC_SITE_URL, normalizePublicSiteUrl } from './src/lib/publicSiteUrl.ts'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = normalizePublicSiteUrl(env.VITE_SITE_URL || DEFAULT_PUBLIC_SITE_URL)
  const previewUrl = new URL('social-preview-v1.png', siteUrl).href
  const base = env.VITE_BASE_PATH || '/'
  // Match Nutrition's working iOS discovery: absolute production URLs and PNG
  // candidates for every icon relation. Development still serves local artwork.
  const iconUrl = (filename: string) => command === 'build'
    ? new URL(filename, siteUrl).href
    : `${base.replace(/\/$/, '')}/${filename}`
  const appleIcon = iconUrl('apple-touch-icon-v2.png')
  const browserIcon = iconUrl('icons/wyrm-192-v2.png')

  return {
    // Pages provides both values, including when deploying at a custom domain.
    // Development assets stay local; copied links always point to the public game.
    base,
    define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) },
    plugins: [
      react(),
      {
        name: 'wyrmle-public-metadata',
        // Emit into the initial HTML: link-preview crawlers do not need JavaScript.
        transformIndexHtml: () => [
          { tag: 'link', attrs: { rel: 'apple-touch-icon', href: appleIcon, sizes: '180x180', type: 'image/png' } },
          { tag: 'link', attrs: { rel: 'apple-touch-icon-precomposed', href: appleIcon, sizes: '180x180', type: 'image/png' } },
          { tag: 'link', attrs: { rel: 'icon', href: browserIcon, sizes: '192x192', type: 'image/png' } },
          { tag: 'link', attrs: { rel: 'shortcut icon', href: browserIcon, type: 'image/png' } },
          { tag: 'link', attrs: { rel: 'canonical', href: siteUrl } },
          { tag: 'meta', attrs: { property: 'og:url', content: siteUrl } },
          { tag: 'meta', attrs: { property: 'og:image', content: previewUrl } },
          { tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' } },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
          {
            tag: 'meta',
            attrs: {
              property: 'og:image:alt',
              content: 'The little wyrm mascot beside the wyrmle wordmark. A daily word battle.',
            },
          },
          { tag: 'meta', attrs: { name: 'twitter:image', content: previewUrl } },
        ].map((tag) => ({ ...tag, injectTo: 'head' as const })),
      },
    ],
  }
})
