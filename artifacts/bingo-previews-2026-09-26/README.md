# Public bingo previews

Anyone can open **Settings → Beta puzzles** in the normal game. The entry is included in production builds. Choose a puzzle and 3, 4 or 5 starting lives; use the puzzle name above the board or Settings → Choose puzzle / lives to return to the picker.

The picker now opens on **Five new puzzles**: ARID, ROT, INERT, STINGY and FALSE. **Earlier variants** contains the ten study boards below. See the [new bingo-first set](../bingo-first-new-enemies-2026-09-26/README.md) for generation commands and validation. Every preview has three progressively clearer hints, followed by a separate **Reveal answer** action.

After deploying this revision, the picker is available at **[wyrmle / beta puzzles](https://crayjake.github.io/wyrmle/?preview=bingos)**. Local development uses **[localhost / beta puzzles](http://localhost:5173/?preview=bingos)**. Query strings work on a custom domain or a GitHub Pages subpath too.

| Puzzle | URL query |
| --- | --- |
| CHAOS 1 | `?preview=bingo-chaos-1` |
| CHAOS 2 | `?preview=bingo-chaos-2` |
| ANGER 1–4 | `?preview=bingo-anger-1` through `?preview=bingo-anger-4` |
| CRUELTY 1–2 | `?preview=bingo-cruelty-1` or `?preview=bingo-cruelty-2` |
| FEAR 1–2 | `?preview=bingo-fear-1` or `?preview=bingo-fear-2` |
| Original CHAOS preview | `?preview=bingo` |

Three lives is the default. Append `&lives=4` or `&lives=5` for the same board, armour and refill order with a different budget. For example: [CHAOS 1, four lives](https://crayjake.github.io/wyrmle/?preview=bingo-chaos-1&lives=4). The picker does not reveal the bingo words.

## Isolation and data

The earlier collection contains ten draft boards from the [feasibility study](../bingo-feasibility-2026-09-26/README.md), alongside five new bingo-first boards and the original preview. Their meanings retain the respective studies' limitations and are labelled as drafts. They have not acquired semantic publication certificates.

The preview router mounts before the daily hooks. Playing, winning, losing, restarting and switching previews write no daily progress, preferences or stats. Refresh restarts a practice attempt. Returning to the daily removes both preview parameters. The daily catalog and ordinary generator are unchanged.

Only the selected puzzle's frozen data is fetched. The fifteen packed JSON assets live in `public/previews/bingo/` with content-hashed filenames; a small catalog lives in `src/experimental/bingo/catalog.json`. The browser does not run the authoring models or generator. The loader respects Vite's deployment base path, validates the payload, and offers retry/puzzle selection on a failed download. An unknown bingo preview stays in the isolated picker.

## Build and regenerate

The exported assets are included in a normal production build. Push **the new public assets and catalog as well as the code**; deployment does not need to run generation or model review.

```sh
# Optional: regenerate the study, then freeze its boards for the website.
npm run assess:bingo
npm run export:bingo-previews

# Generate and export the five new source-profile puzzles.
npm run generate:bingo -- --seeds 12 --export

# Normal verification/build/deployment inputs.
node --test --test-isolation=none tests/bingo-preview.test.ts tests/bingo-catalog.test.ts tests/bingo-new-set.test.ts
npm run lint
npm run build
```

The export preserves the packed model evidence, verifies every intended bingo and replays the study's winning witnesses at every supported life budget before writing files. It does not claim that those semantics are fully reviewed.

The eleven focused tests check URL handling, all fifteen boards and their stored routes at 3/4/5 lives, every hint answer, source-profile regressions, corrupted/stale payload rejection, the original preview, and separation from daily publication. The original production browser checks use the `/wyrmle/` base path and phone/desktop viewports; see [browser-check.json](browser-check.json) for those flows and the [new set's checks](../bingo-first-new-enemies-2026-09-26/browser-check.json) for the updated picker and hint panels. Screenshots in this directory show the earlier picker, public Settings entry, boards and five-life animation.
