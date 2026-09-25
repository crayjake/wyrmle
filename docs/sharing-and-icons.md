# Sharing and Home Screen icons

WYRMLE uses its existing green wyrm face for browser tabs and installed apps. The share card uses the same colours and mascot, with no puzzle spoilers. Copied results include the public game URL so messaging apps can fetch its preview.

## Published assets

| Asset | Purpose |
| --- | --- |
| `public/favicon.svg` | Scalable browser favicon |
| `public/favicon.ico` | 16, 32 and 48px browser fallback |
| `public/icons/apple-touch-icon-v1.png` | Explicit 180×180 iPhone/iPad Home Screen icon |
| `public/apple-touch-icon.png` | Conventional fallback copy |
| `public/icons/wyrm-192-v1.png`, `wyrm-512-v1.png` | Manifest icons |
| `public/icons/wyrm-maskable-512-v1.png` | Manifest icon with extra room for platform masks |
| `public/social-preview-v1.png` | 1200×630 Open Graph and Twitter card |

All PNGs have an opaque RGB background. Home Screen artwork fills the square; the operating system supplies the outer corner mask. The maskable icon keeps its foreground within the central 80%-diameter safe circle.

Editable vectors live in `assets/brand`. The card's Cutive Mono lettering is stored as outlines, with the font's OFL licence alongside it. No font download is needed to export the artwork. To regenerate the committed public files, install librsvg (`rsvg-convert`) and ImageMagick (`magick`), then run:

```sh
python3 scripts/build-brand-assets.py
```

Normal builds and deployment use the committed images and do not need these artwork tools. When changing the artwork, bump the versioned filenames and favicon query version in their references to avoid reusing an old cached image.

## Metadata and deployment paths

Vite emits the canonical URL and Open Graph/Twitter metadata into the initial HTML, so crawlers can read them without running the game. The preview image URL is absolute. This follows the [Open Graph protocol](https://ogp.me/).

`VITE_SITE_URL` controls the canonical address, social image address and copied game link. Its default is `https://crayjake.github.io/wyrmle/`. `VITE_BASE_PATH` controls asset paths. The Pages workflow obtains both from `configure-pages`, including for a configured custom domain. For a manual deployment, set both consistently:

```sh
VITE_SITE_URL=https://example.com/play/ VITE_BASE_PATH=/play/ npm run build
```

The manifest's start URL, scope and icons resolve relative to its own directory. Explicit Apple icon links include the deployment base, which matters on a project site: relying only on an origin-root `/apple-touch-icon.png` would miss `/wyrmle/`.

## iPhone installation

The page declares a 180px PNG `apple-touch-icon`, an app title, standalone capability and a standalone manifest. Apple documents the [explicit icon link and PNG sizes](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html); WebKit describes [Home Screen web apps and Apple's icon precedence](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

After deployment, open the public address in Safari, choose **Share → Add to Home Screen**, and check that the green face appears in the confirmation sheet. If an existing shortcut keeps its old icon, remove that shortcut and add it again from the updated page. The versioned Apple icon URL helps fresh installations fetch the correct file; it cannot force an already installed shortcut or a messaging service to refresh its cached artwork immediately.

Local checks verify the production HTML, image formats, dimensions, opacity and asset URLs at `/wyrmle/`, a custom subpath and a domain root. Physical iPhone installation and platform preview caches must be checked after deployment. Standalone launch does not add offline caching.
