# Beta screens: no-scroll layout

The picker previously needed 912px of content in a 375×667 viewport. The FEAR game also exceeded a 430×740 viewport, and landscape games needed about 570px vertically.

The picker now shares the available height between its ten cards and keeps the original preview and daily links in one footer. In the game, the board uses the actual space remaining after the definition and current-word feedback, with a fixed 44px action row. Short landscape viewports place the encounter beside the board. The rules, puzzle data, and daily layout are unchanged.

## Verification

- `VITE_BASE_PATH=/wyrmle/ npm run build`
- `npm run lint`
- `node --test --test-isolation=none tests/bingo-catalog.test.ts tests/bingo-preview.test.ts` — 8 passed.
- `browser-check.json` — 368 Chromium layout checks: every preview at 320×568, 375×667, 390×664, 430×740, 430×932, 568×320, 667×375, and 900×900; picker, ready, selected bingo, win, and alternate three/four-life routes. Checked document/container overflow, control bounds, and at least 44px tile and action targets. Smallest tile measured 49.1px.
- `production-check.json` — 15 checks against the built `/wyrmle/` site: navigation, life selection, live resizing with a word selected, simulated safe-area padding, the original preview, unknown-preview fallback, return to daily, normal-motion intro, and pointer selection. No browser errors.

Screenshots show the picker and selected-word game in portrait and landscape. Safe-area checks simulate padding; these are not physical iPhone tests. Playwright WebKit was downloaded but could not launch because the host lacks its required ICU/XML/Flite libraries.
