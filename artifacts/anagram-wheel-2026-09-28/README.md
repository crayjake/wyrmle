# Anagram wheel UI mock-up

[Open the interactive preview](https://crayjake.github.io/wyrmle/?preview=wheel).
Locally, open `?preview=wheel` on the Vite site.

The published 28 September FURY board can be displayed as two rings (ten outer
tiles and six inner tiles), one ring containing all sixteen tiles, or the grid.
The original fonts, colours, thin outlines, enemy underlines, Lives, Refills and
attack preview are shared with Daily. Layout and tile-shape choices now live
in Settings and are also available in Daily and the concept previews.

| Layout | Square tiles | Circular tiles |
| --- | --- | --- |
| Two rings | [Try it](https://crayjake.github.io/wyrmle/?preview=wheel&layout=double&tiles=square) | [Try it](https://crayjake.github.io/wyrmle/?preview=wheel&layout=double&tiles=circle) |
| One ring | [Try it](https://crayjake.github.io/wyrmle/?preview=wheel&layout=single&tiles=square) | [Try it](https://crayjake.github.io/wyrmle/?preview=wheel&layout=single&tiles=circle) |

- Tap letters or swipe through them in spelling order. A thin line traces the word.
- The centre button shuffles positions and clears the selection. It preserves
  every physical tile, including repeated letters, and costs no life.
- Settings → Grid / 2 rings / 1 ring compares layouts while keeping the selection and run.
- Settings → Square tiles / Round tiles changes shape. This preview's URL retains both choices.
- Play Word uses the real puzzle engine, including meanings, hits and refills.
- Preview attempts live only in memory. They do not record a daily attempt or stars.

The normal site entry opens Daily with the saved layout, defaulting to the original
square grid. This preview still has a separate lazy-loaded route.

## Captures

- [Two rings, square](double-square-selected.png)
- [Two rings, circular](double-circle-selected.png)
- [One ring, square](single-square-selected.png)
- [One ring, circular](single-circle-selected.png)

Each shows CHEERFUL selected, its path and three predicted hits. Matching idle
captures are saved alongside these. The earlier `wheel-*.png` and
`grid-comparison.png` captures preserve the first version of the mock-up.

## Verification

Production-build browser checks covered 390×844, 375×667, 320×568, 320×480,
667×375 and 1280×900: no scrolling, overlapping tiles or hidden controls;
selection, shuffle, layout switching, a full bingo and restart all worked.
The smallest 320×480 viewport needs 33 px tiles; typical phone sizes retain
48–60 px tiles. This is a useful size tradeoff to judge against the grid.

A touch-input check covered drag order, revisiting selected tiles without
duplication, immediate shuffle, correct refills after CHEERFUL, and two remaining
lives. It also verified that no Daily progress was written. Both tile shapes
and ring counts were checked on the phone and landscape viewports. Circular
hit detection follows the actual disc; tests cover empty corners, tangents,
fast swipes and repeated visits. The shared-grid tutorial and saved-best result
checks passed separately.
