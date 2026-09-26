# Statistics and sharing — 26 September 2026

Statistics now opens with four numbers and a words-to-win chart. Recent days and detailed totals are expandable. Results show words, lives and undos above a compact share preview; the full battle breakdown is under Run details.

The preview uses monospace. Shared rows contain only square emoji, without padding or mixed-width symbols. Each row shows the enemy after that word, preserving removed positions and showing recovery when it happens. [Example share text](share-example.txt).

Share opens the native share sheet when available. Cancelling does nothing to the clipboard. Unsupported or failed sharing falls back to copying, then selected text if copying is blocked. Both result and statistics screens use the same action.

## Screenshots

These use real engine replays and valid saved results, rendered by the production build. The example history contains four historical results plus today's win.

| View | Small phone | Phone | Desktop |
| --- | --- | --- | --- |
| Result | [320 × 568](result-320.png) | [375 × 667](result-375.png) | [900 × 900](result-900.png) |
| Statistics | [320 × 568](stats-320.png) | [375 × 667](stats-375.png) | [900 × 900](stats-900.png) |

Also checked: [empty history](stats-empty-320.png), [archived ten-letter victory](archived-victory.png), [archived defeat](archived-defeat.png), and [manual copy fallback](manual-copy-375.png).

## Design references

- Wordle: four headline statistics, a guess distribution and a prominent Share action. Inspected the historical screenshot on page 98 of the [New York Times investor presentation](https://s23.q4cdn.com/152113917/files/doc_downloads/2022/06/v2/NYT-Investor-Day-2022-Presentation-mC05z.pdf#page=98); the live NYT game was unavailable to the research browser.
- Squaredle: a distinct Share surface, with detailed scores and streaks in its leaderboard. Reviewed the [public app](https://squaredle.app/) and [FAQ](https://squaredle.app/faqs).
- Semantle: published shares start with the outcome, puzzle identifier and guess count. Reviewed [historical player shares](https://www.reddit.com/r/Semantlegameplayers/comments/11dri15/semantle_395/); this establishes the share format, not its current in-game interface.
- Native sharing follows the [Web Share specification](https://www.w3.org/TR/web-share/): invoke from the user's tap and handle cancellation separately from failure.

## Verification

- All 569 tests passed on Node 24, in 104.3 seconds; lint and production build passed.
- New tests cover the share payload, immediate native invocation, cancellation, fallback copying and blocked clipboard access. Updated result tests cover uniform emoji rows, cumulative health, revival, historical results, absent spoilers and malformed positional evidence.
- Production-browser checks cover both Share buttons, live user activation, disabled repeat taps, selected manual text, chart counts, empty history, old wins/losses and resuming an unfinished day.
- No page or dialog overflow horizontally at the tested widths. Today's default result and statistics panels fit both phone sizes without scrolling. Longer archived results and expanded details scroll within the dialog.
- [Browser verification data](verification.json). Native sharing was stubbed to verify calls and outcomes; a physical iPhone share sheet was not available for testing.
