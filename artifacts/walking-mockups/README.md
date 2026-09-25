# WYRMLE walking and reveal studies

These are standalone design studies. The selected footless A gait and option 1 (original glitch letters and tile bounce) are now integrated into the game. The restored route is lives → enemy → refills → tiles → lives. Puzzle data and gameplay rules are unchanged.

- `index.html`: the selected footless A walk with three reveal treatments: glitch + bounce, glitch + gentler bounce, and quiet reveal.
- `walking-options.html`: the original three walking directions, with A updated to remove its feet.
- `closeup.html?mode=feet`: a magnified view of the footless body motion; `inch` and `guide` show the other gaits.

Open `index.html` in a browser. Keep the accompanying HTML and JavaScript files together. If a browser restricts local frames, serve this folder with `python3 -m http.server 8000` and visit `http://localhost:8000`.

The boards use a captured 375×629 layout from the real app, including embedded fonts. Play, pause, replay and scrub controls are available. Motion begins in the actual life-meter pose and ends in the same pose. No animation starts offscreen or disappears between stages. The interactive studies show blue Hit tiles, green Life tiles, and red Revive tiles.

Existing video exports and comparison screenshots are archived from the earlier reveal comparison, before the route and tile-color corrections. The HTML studies are the current version. Videos are deterministic 60fps renders, not physical iPhone performance measurements.

Production integration checks are recorded in `../selected-walk/qa.json`, with screenshots at 375×629 and 320×568. Those checks cover reveal order, continuous visibility, exact life-meter departure/return, special-tile colors, reduced motion and viewport resizing. They use desktop Chromium with mobile viewport emulation; physical iPhone Safari performance is not measured.
