# Score-based link previews

Sharing a daily result uses its saved best word count: one word → three stars,
two → two stars, three or more → one star. A failed replay retains the best card.
Unsolved attempts share the dated puzzle without claiming a win.

The build writes `share/YYYY-MM-DD/{1,2,3}/index.html` for every calendar entry.
These are playable app pages with date/score-specific Open Graph and Twitter
metadata already in the HTTP response. The three versioned 1200 × 630 PNG cards
are in `public/share-cards/`; editable SVG snapshots are beside this file and
their source is `scripts/lib/scoreShareArtwork.ts`. No answer is disclosed.

Opening a link selects its puzzle and normalizes the browser URL to `?daily=`.
The sender's rating never becomes the recipient's progress. Native sharing and
the clipboard fallback retain a single text payload with one URL.

The metadata follows the [Open Graph protocol](https://ogp.me/). Different scores
have different page URLs and image URLs, so improving a result does not reuse the
previous score's preview identity. Messaging apps still control their own cache
and rendering; physical iPhone Messages rendering was not available to test here.

Validation: lint, production build, 19 focused tests, and Chromium at 375 × 667.
`browser-check.json` covers initial HTML/images, recipient progress isolation,
and native share payloads after a bingo followed by a failed replay.
