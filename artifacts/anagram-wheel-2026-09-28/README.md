# Anagram wheel UI mock-up

[Open the interactive preview](https://crayjake.github.io/wyrmle/?preview=wheel).
Locally, open `?preview=wheel` on the Vite site.

The published 28 September FURY board is displayed as ten outer tiles and six
inner tiles. The original fonts, colours, square outlines, enemy underlines,
Lives, Refills and attack preview are shared with Daily.

- Tap letters or swipe through them in spelling order. A thin line traces the word.
- The centre button shuffles positions and clears the selection. It preserves
  every physical tile, including repeated letters, and costs no life.
- Wheel / Grid compares both layouts while keeping the current selection and run.
- Play Word uses the real puzzle engine, including meanings, hits and refills.
- Preview attempts live only in memory. They do not record a daily attempt or stars.

The normal site entry still opens the daily grid. This preview has a separate
lazy-loaded route and stylesheet.

## Captures

- [Wheel](wheel-idle.png)
- [CHEERFUL selected, showing the path and three predicted hits](wheel-selected.png)
- [Same selection on the grid](grid-comparison.png)

## Verification

Production-build browser checks covered 390×844, 375×667, 320×568, 320×480,
667×375 and 1280×900: no scrolling, overlapping tiles or hidden controls;
selection, shuffle, layout switching, a full bingo and restart all worked.
The smallest 320×480 viewport needs 33 px tiles; typical phone sizes retain
48–60 px tiles. This is a useful size tradeoff to judge against the grid.

A touch-input check covered drag order, revisiting selected tiles without
duplication, immediate shuffle, correct refills after CHEERFUL, and two remaining
lives. It also verified that no Daily progress was written. The shared-grid
tutorial and saved-best result checks passed separately.
