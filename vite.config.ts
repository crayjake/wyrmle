import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { DEFAULT_PUBLIC_SITE_URL, normalizePublicSiteUrl } from './src/lib/publicSiteUrl.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = normalizePublicSiteUrl(env.VITE_SITE_URL || DEFAULT_PUBLIC_SITE_URL)
  const previewUrl = new URL('social-preview-v1.png', siteUrl).href

  return {
    // Pages provides both values, including when deploying at a custom domain.
    // Development assets stay local; copied links always point to the public game.
    base: env.VITE_BASE_PATH || '/',
    define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) },
    plugins: [
      react(),
      {
        name: 'wyrmle-public-metadata',
        // Emit into the initial HTML: link-preview crawlers do not need JavaScript.
        transformIndexHtml: () => [
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
