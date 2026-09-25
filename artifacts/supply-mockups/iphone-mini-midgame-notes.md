# iPhone 13 Mini midgame mockups

These are Chromium screenshots using Playwright's iPhone 13 Mini device settings (touch, mobile user agent and DPR 3). They are **not captures from a physical iPhone or from Safari**.

- `iphone-mini-midgame-bar.png` and `iphone-mini-midgame-wyrm.png`: explicitly requested **375 × 812 CSS-pixel viewport**, exported at **1125 × 2436 pixels**.
- `iphone-mini-midgame-bar-browser.png` and `iphone-mini-midgame-wyrm-browser.png`: the installed Playwright preset's **375 × 629 CSS-pixel browser viewport**, with a 375 × 812 screen. This reserves the preset's allowance for browser chrome; browser controls themselves are not drawn.

The difference between device screen size and available browser height changes this app's `dvh`-based board sizing. Both sizes are supplied so the full-screen layout is not mistaken for the available Safari page area.

The actual v7 DESPAIR game was replayed through the engine using TILE → DAD → WHERE → ANGRY and restored through validated Daily persistence. There is one life left, enemy S and P remain, and the heart O is unused. No tiles, enemy damage, life count or refill state were fabricated.

Refill figures use the real unconsumed stored queue: **72 other letters, six S and one P**. Order is not exposed. This is a raw remaining-queue count: it includes letters that may be unreachable within the remaining lives. It is a display concept, not a newly introduced finite-pool rule or a guarantee of future access to every shown copy.

The wyrm concept replaces the five life bars with four dim body segments and one filled head, with a `1/5` readout. Its appearance reuses the existing code-native wyrm's body, head, eye and tongue styling. It is static and removes the extra wyrm beside the logo. No live component was changed.

All captures waited for `document.fonts.ready`. The required Latin **Cutive Mono** and **Share Tech Mono** faces loaded successfully, their Google Fonts stylesheet/font requests returned HTTP 200, and there were no failed requests. An unused Cutive Mono subset remains unloaded; the Latin text used here is rendered with the loaded face.

For each size, both mockups preserve the pre-mockup board rectangle exactly, with zero vertical overflow and no horizontal overflow. Full details, font statuses, response URLs and geometry are in `iphone-mini-midgame-notes.json`. Reproduction script: `/tmp/wyrmle-iphone-mini-midgame.mjs`.
