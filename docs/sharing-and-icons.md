# Sharing and Home Screen icons

WYRMLE uses the selected W-shaped green wyrm (icon concept 1) for browser tabs and installed apps. The share card uses the same colours and mascot, with no puzzle spoilers. Copied results include the public game URL so messaging apps can fetch its preview.

## Published assets

| Asset | Purpose |
| --- | --- |
| `public/favicon.svg`, `public/favicon.ico` | Self-contained bitmap SVG and conventional browser fallback; not explicit icon candidates |
| `public/apple-touch-icon-v3.png` | Explicit 180×180 iPhone/iPad Home Screen icon, also listed in the manifest |
| `public/apple-touch-icon.png`, `apple-touch-icon-precomposed.png` | Conventional fallback copies |
| `public/icons/wyrm-192-v3.png` | PNG favicon, shortcut icon and manifest icon |
| `public/icons/wyrm-512-v3.png` | High-resolution manifest icon |
| `public/icons/wyrm-maskable-512-v3.png` | Manifest icon with extra room for platform masks |
| `public/social-preview-v1.png` | 1200×630 Open Graph and Twitter card |

All PNGs have an opaque RGB background. Home Screen artwork fills the square; the operating system supplies the outer corner mask. The maskable icon keeps its foreground within the central 80%-diameter safe circle.

The approved source is `assets/brand/wyrm-w-v3.png`; its original generation prompt is preserved in `artifacts/icon-concepts-2026-09-26/prompts.json`. Deterministic exports resize this exact artwork. Editable social-card vectors also live in `assets/brand`. The card's Cutive Mono lettering is stored as outlines, with the font's OFL licence alongside it. No font download is needed to export the artwork. To regenerate the committed public files, install librsvg (`rsvg-convert`) and ImageMagick (`magick`), then run:

```sh
python3 scripts/build-brand-assets.py
```

Normal builds and deployment use the committed images and do not need these artwork tools. When changing the artwork, bump the versioned filenames and manifest query version in their references to avoid reusing an old cached image. The older v1 and v2 files remain available for pages that still reference them.

## Metadata and deployment paths

Vite emits the canonical URL and Open Graph/Twitter metadata into the initial HTML, so crawlers can read them without running the game. The preview image URL is absolute. This follows the [Open Graph protocol](https://ogp.me/).

`VITE_SITE_URL` controls the canonical address, social image address and copied game link. Its default is `https://crayjake.github.io/wyrmle/`. `VITE_BASE_PATH` controls asset paths. The Pages workflow obtains both from `configure-pages`, including for a configured custom domain. For a manual deployment, set both consistently:

```sh
VITE_SITE_URL=https://example.com/play/ VITE_BASE_PATH=/play/ npm run build
```

The manifest's start URL, scope and icons resolve relative to its own directory. Production icon links use fully qualified URLs derived from `VITE_SITE_URL`; development uses local paths. The explicit Apple links include the project directory: relying only on an origin-root `/apple-touch-icon.png` would miss `/wyrmle/`.

The v2 discovery setup follows the user's working Nutrition project (`src/app/layout.tsx` and `src/app/manifest.ts`, through commit `1b08156`): both Apple icon relations point to the same versioned PNG, the browser and shortcut icons are PNGs, and the manifest includes the exact 180px Apple asset. This removes the concrete configuration differences found during comparison. It does not establish which difference caused Safari to fall back to a monogram; fresh-query reinstall testing had already ruled out the initial stale-page explanation.

## iPhone installation

The page declares the same 180px PNG as `apple-touch-icon` and `apple-touch-icon-precomposed`, an app title, standalone capability and a standalone manifest. Apple documents the [explicit icon link and PNG sizes](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html); WebKit describes [Home Screen web apps and Apple's icon precedence](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

After deployment, open the public address in Safari, choose **Share → Add to Home Screen**, and check that the W-shaped wyrm appears in the confirmation sheet. If an existing shortcut keeps its old icon, remove that shortcut and add it again from the updated page. The versioned Apple icon URL helps fresh installations fetch the correct file; it cannot force an already installed shortcut or a messaging service to refresh its cached artwork immediately.

Local checks verify the production HTML, image formats, dimensions, opacity and asset URLs at `/wyrmle/`, a custom subpath and a domain root. Physical iPhone installation and platform preview caches must be checked after deployment. Standalone launch does not add offline caching.
