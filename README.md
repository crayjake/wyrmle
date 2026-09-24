# WYRMLE

A deterministic daily word game where the enemy word's letters are its health. Select tiles in spelling order, preview the exact enemy cells that will be struck, and remove every letter before Resolve runs out. The existing flat terminal palette, fonts, letter cells, tile grid and wyrm decode intro are retained.

## Run and verify

```sh
npm install
npm run dev
npm test
npm run build
npm run lint
```

Tests use Node's built-in TypeScript support; use Node 22.18+ or a newer supported release. Validation uses the bundled `an-array-of-english-words` dictionary. Gameplay makes no API requests and needs no LLM.

## GitHub Pages

In [repository Settings → Pages](https://github.com/crayjake/wyrmle/settings/pages), set **Build and deployment → Source → GitHub Actions**. Push this project, including `.github/workflows/pages.yml`, to `main`. The workflow installs locked dependencies on Node 24, runs tests and lint, typechecks/builds, then deploys `dist`. It can also be run manually from **Actions → Deploy to GitHub Pages → Run workflow** on `main`.

The project site will be **https://crayjake.github.io/wyrmle/** after its first successful deployment. The workflow takes the base path from GitHub Pages, so scripts, lazy-loaded chunks, styles and the favicon work below `/wyrmle/`; a configured custom domain is supported too. Local `npm run dev` and ordinary builds keep `/` as their base. No `gh-pages` branch, deployment dependency or personal access token is needed. Onboarding, modes and Daily saves remain local to each browser and site origin.

To check the project-site build locally:

```sh
VITE_BASE_PATH=/wyrmle/ npm run build
VITE_BASE_PATH=/wyrmle/ npm run preview -- --host 127.0.0.1
```

Open **http://127.0.0.1:4173/wyrmle/**. Use the same base for build and preview. This follows the [Vite Pages deployment guide](https://vite.dev/guide/static-deploy#github-pages) and GitHub's [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Letter-strike rules

- A valid word normally costs one Resolve. Invalid words spend nothing.
- **COUNTER:** every selected tile with an eligible same-letter target strikes.
- **NEUTRAL:** one normal matching strike for 3–5 letters, in spelling order. Related words are neutral.
- **LONG +1:** an encounter can give neutral words of 6+ letters a second normal strike. It stacks with grammar, so a long neutral adjective can use three normal matches. Resisted words receive no LONG allowance; counters already hit every matching tile. Every hit still needs its own selected tile and a living matching target.
- **RESISTED:** no normal semantic strikes.
- **STRIKE:** that tile guarantees a matching strike, including on resisted words, without consuming the semantic/grammar allowance. `LAD` with Strike L hits L through Strike, then A through its neutral allowance. Each tile hits at most once, including on counters. Multiple Strike tiles can each hit once.
- **WARD:** including any Ward makes that valid turn cost zero Resolve; Wards do not stack or heal.
- **Armour:** a double-outlined cell needs two strikes. Its first hit breaks armour; the next removes the letter.
- **Grammar:** an encounter may explicitly configure a strike allowance such as `adjective: 1`. A resisted adjective can then strike its first matching tile; a neutral adjective its first two. Positive grammar cannot add hits beyond a counter's matching tiles. Unknown/ambiguous parts of speech earn no allowance; no noun/adjective weakness is inferred globally. Negative modifiers reduce normal allowances without blocking Strike overrides.

Each tile and enemy letter has its own identity. Targeting finishes wounded armoured copies first, otherwise proceeds left to right. Dead cells cannot be targeted. Two distinct selected tiles can each hit the same armoured cell once. Removing the last enemy letter wins even when the attack spends the final Resolve.

The pure engine is `src/game/letterStrike.ts`: `createLetterStrikeGame`, `toggleLetterStrikeTile`, `clearLetterStrikeSelection`, `previewLetterStrike`, and `submitLetterStrike`. Preview and submission share an evaluator and ordered hit records. `selectEnemyTarget` holds the duplicate-targeting rule. Dictionary, semantic lookup, selected-ID lookup and deterministic board-order refill are reused. Refills receive fresh IDs and no special effect. Grammar changes matching-tile allowances, never numeric damage.

## Battle presentation

Targets come directly from real preview hits: **blue −** means armour breaks and the letter survives; **red ×** means the letter will be removed. Two hits that finish an armoured cell preview removal. Accessible cell names describe the same outcome. Defeated cells become quiet, borderless dots in their original slots. Each dot is positioned at the cell's exact centre independently of font metrics. There is no BREAK/REMOVE legend beside the enemy.

Committed hit records animate in selection order, so two hits to one armoured letter visibly progress from double outline to single outline to dot. The UI blocks another move and waits to open the result until the short sequence finishes. Reduced motion applies the final state immediately. The engine state and save commit immediately and are never driven by animation timers; a refresh restores the final committed state without replaying old animations.

The action area contains the selected word, semantic category, applied LONG/grammar allowances and triggered Strike/Ward effects, followed by tiles and actions. Exact predicted outcomes appear on the enemy cells; neither the current word nor the Attack button duplicates them with a strike count. Normal play has no numeric enemy HP, DMG, charge bar, WORD/READY labels, player-area divider, or permanent recent-history panel. Validation, decode and terminal messages remain available.

The header's **Log** opens every submitted turn, newest first: strikes, semantic outcome, applied grammar, triggered effects, removed letters and armour breaks. Statistics are available from the Log and result screen. In Normal mode, the definition stays attached to the enemy, with compact grammar labels underneath separated by dots, matching the current move's modifiers. Actual weaknesses are green and resistances red; neutral types are omitted. Exact allowances remain in accessible text and hover descriptions. Tile labels and explanations use the actual board and configured effects through `letterStrikeHud.ts`.

## Modes and first visit

**Normal** is recommended and shows enemy definitions. **Hard** omits only the definition; part of speech and explicit encounter mechanics remain visible. Both modes use the identical Daily encounter, board, refill, Resolve, armour and combat rules. The production header's **Settings** changes the preferred mode. **Begin** fixes that Daily's mode, even before its first attack; later preference changes apply to the next run without resetting progress.

First-time visitors play a short **COLD** tutorial with six manual words: **HOT → ICE → ICY → LAD → DIG → DUO**. It explains counters as opposite meanings and resistance as similar meanings. ICE uses Strike C; resisted adjective ICY demonstrates the enemy's visible **ADJECTIVE +1 STRIKE** bonus with an ordinary C. Ward A preserves Resolve. DIG and DUO each contain one D, showing its armour break and removal in separate words. The shared enemy, tile, preview and Resolve components use the real engine. **Skip tutorial** remains available throughout and goes straight to mode selection. Finishing presents **You're ready**, mode selection and **Play today's Wyrmle**. Action buttons have a 0.6rem gap below the grid in both tutorial and Daily play.

Tutorial guidance is separated from the enemy's persistent information by a thin divider and **TUTORIAL · step/11** heading. Counter, Neutral and Resisted meanings use aligned term/description columns. The heading explicitly says **Tap CONTINUE below** or **Tap ATTACK below** when that action is available. Continue occupies the bottom Attack button's position and switches back to Attack while building a word, keeping the same preview and animation gates. An available action gently pulses; reduced-motion preferences disable the pulse. There is no separate Continue button above the grid.

The Daily battle uses that same bottom action for **Begin**, **Attack**, and **View result**. Its date/mode/status row is omitted; mode remains available in Settings and results. Resolve uses its label and five segments on one line, without a duplicate fraction; its meter exposes the exact remaining value to assistive technology. Off-date and save-error notices still appear when needed.

`UserPreferences` persists separately at `wyrmle:preferences:v1`: `preferredMode`, `hasCompletedOnboarding` and `hasChosenMode`. Skipping records completion before mode selection, so an interrupted choice resumes there. Existing Daily records identify returning visitors, who bypass onboarding. Tutorial state lives only in its own reducer; it writes no Daily run or result, consumes no attempt, and affects no statistics or streak. Returning players resume their unfinished Daily or open today's puzzle.

## Daily puzzle definition

Daily IDs are strictly validated UTC dates, `YYYY-MM-DD`, from `getDailyPuzzleId(date)`. Days change at midnight UTC, independent of timezone or daylight saving.

`src/daily/catalog.ts` contains the published encounter. `getDailyPuzzle(id)` returns a deeply frozen definition containing date/ID, game/puzzle versions, enemy word/definition, semantic groups, enemy letter identities/armour, starting Resolve, exact board/special tiles, refill queue and rules. The literal catalog is independent of mutable DEV encounter defaults.

**There is currently one authored encounter, MELANCHOLY, so it repeats across dates.** Each date has its own attempt and result. Add further encounters with explicit date assignments while preserving every previously published definition; content is never random or player-dependent.

New attempts dated **2026-09-25 UTC onward** use `letter-strike-4` / puzzle version 4: the revised board/refills, LONG, independent Strike and adjective weakness. Earlier dates retain their v1 rules. Committed v2/v3 attempts and completed results remain pinned to their original rules, boards and word annotations; their outcomes and completion timestamps do not change. Validated older attempts with no committed turns open under v4, with original bytes kept until the first new commit. DEV letter-strike playtests use the current prototype immediately. Old future-date DEV v1 records that disagree with the publication boundary remain unsupported and preserved; DEV reset is explicit.

Today's saved run/result takes opening priority; otherwise the latest unfinished earlier daily can resume. A tab crossing midnight keeps its attempt and offers **Play today**. Statistics also offers unfinished earlier dates. Starting a date does not delete earlier runs.

## Persistence and completion

| Data | Responsibility |
| --- | --- |
| `DailyPuzzleDefinition` | Immutable, versioned rules/content for a date |
| `DailyRun` | Fixed run mode, enemy-letter/armour states, Resolve, board/IDs, refill cursor/next ID, committed words/hits/effects, status and finish time |
| `DailyResult` | Mode, permanent completion summary and ordered turn evidence; statistics are derived from results |

Runs use `wyrmle:letter-strike:daily:v1:run:YYYY-MM-DD`; results use the matching `result:` namespace. Former numeric-mode `wyrmle:daily:*` records are preserved untouched, excluded from the new game/statistics, and never reinterpreted as letter-strike saves. DEV reset/clear affects only the new namespace.

`src/daily/persistence.ts` accepts an injected storage interface. It replays committed attacks against the canonical puzzle and verifies the entire snapshot: letter/armour states, board, Resolve, refill position, effects and result totals. Unsupported versions or corruption block the run while preserving the record.

Save schema 4 adds `mode: "normal" | "hard"` to runs and results, retaining LONG modifiers and positional outcomes. Schema 1/2/3 records are checked against their exact historical shape and version, then enriched in memory from canonical replay with Normal mode. This preserves historical Strike allowances, vocabulary and LONG behavior. Reads never rewrite original bytes or completion timestamps; continuing an active run writes schema 4 while retaining its committed game version and mode. Completed results remain authoritative and can display the current share format without reopening the puzzle.

Every accepted attack saves before the UI advances. Completion writes the authoritative result before the terminal run snapshot, so an interrupted second write cannot reopen the date. Results reconstruct missing/stale terminal runs; valid terminal runs recover missing results. The first completion stays authoritative. Stale tabs cannot replace it or regress progress, and storage events refresh other tabs.

Selections, errors and intro progress are transient. Refresh restores committed gameplay with letters and tiles revealed. Storage failures offer retry/reload actions. Data stays in this browser, with no accounts/cloud sync; clearing browser storage removes it. Version constants live in `src/daily/versions.ts`.

## Results and statistics

`buildDailyResult(puzzle, game, completedAt, mode)` is pure. It records mode, outcome/enemy, remaining Resolve, words used, total strikes, letters removed, armour broken, largest single-turn removal, strongest strike count, Counter/Neutral/Resisted counts, actual Strike activations and Ward saves. The result presents Victory/Defeat with a subtle mode label, numeric Resolve plus one segment per starting Resolve, semantic breakdown and letter/effect totals. Word count is secondary in the optional history. Strike counts only when its tile hits. Ward counts once per protected turn. Armour is counted once per armoured letter. No score, stars or rankings are invented.

`calculateStats(results, todayId)` derives played, wins, win rate, current/longest winning streaks, average Resolve on wins, best Resolve, largest turn by strikes, total removed letters, Counter/Neutral/Resisted moves, Strike activations, Ward saves and armour breaks, plus word-length and different-enemy statistics. Aggregates are not stored. Only the first completion per puzzle counts; future DEV dates are excluded. Streaks follow consecutive UTC dates. Yesterday can sustain a streak while today is unplayed. Completing an earlier run after midnight still belongs to its puzzle date.

The current statistics screen stays combined. Stored result modes allow future Normal/Hard played, wins and streak comparisons without changing combat or permitting a second attempt at the same Daily.

## Spoiler-safe sharing

`buildShareText(result)` in `src/daily/share.ts` is pure and independent of the UI. It returns date, mode, outcome, a Resolve bar and one positional row per submitted word:

```text
WYRMLE 2026-09-25 · NORMAL · VICTORY

RESOLVE
■□□□□ 1/5

C  ·······■·◐
C  ·■···■■··· ◇
N  ◐·■······■ ◆
C  ···■····■·
N  ■···■·····
```

C/N/R mean Counter/Neutral/Resisted. Each slot is `·` untouched that turn, `◐` armour broken but surviving, `■` removed, or `▣` armour broken and removed in the same word. ◇ means Ward and ◆ means Strike triggered. A previously broken letter removed on a later turn uses `■`, not `▣`. There is no redundant word count. The result's expandable share preview explains the notation; the copied text omits the legend and all enemy/submitted words, board letters and tile IDs. Clipboard denial provides a selectable fallback.

The engine emits `letterOutcomes` for every original slot on every turn, including before/after hits and armour-break/removal flags, from that turn's ordered hit records. Result turns copy these events. Sharing never guesses the turn history from the final enemy state, and a same-word double hit correctly produces `▣`.

## Future global ranking boundary

`buildDailyScoreSubmission(result)` in `src/daily/submission.ts` creates a deterministic payload: mode, puzzle/game/puzzle versions, outcome, Resolve, turns, total strikes, removed letters, armour breaks, semantic sequence, per-turn positional outcomes, Ward/Strike usage, completion time, and ordered tile IDs for replay. A future submission call can run after successful completion persistence in `useDailyRun.ts`.

A server must resolve the versioned puzzle, replay the evidence and calculate comparison values itself. Client timestamps and totals are not authoritative. No network request, leaderboard or fake ranking is implemented.

## Development comparison and tools

In `npm run dev`, **Settings → Development tools** offers date selection, puzzle reset, history inspection/clear, and real engine win/loss replays. `/?puzzle=2026-09-24` selects a test date. Development controls and date override are absent from production; ordinary mode Settings remains available.

Onboarding tools provide **Replay onboarding**, **Launch tutorial directly**, **Reset onboarding flag** (takes effect on reload), and **Preview first-time flow**. Direct tutorial launch returns to the Daily without changing preferences; first-time preview also leaves preferences and Daily records intact. **Force Normal / Force Hard** temporarily overrides presentation only, with **Use run mode** restoring the saved mode. These overrides do not rewrite the run or result mode and disappear on refresh.

**Settings → Development tools → Enemy letter layout → Grid after reveal** previews a larger enemy grid in the Daily and disposable playtests. The intro still decodes the original row; once the wyrm docks, the same letter elements move into up to five columns in reading order. Armour, previews, removed-letter slots and targeting keep their existing identities. The grid uses the space above the definition and shares shorter screens with the playable board. **Row** restores the usual presentation. The setting defaults off, resets on reload, writes no preferences or Daily data, and is unavailable in production.

**DAMAGE MODE** and **LETTER-STRIKE MODE** launch disposable DEV comparisons. Switching or restarting creates a fresh encounter. They never save daily history; **Return to daily game** restores the saved daily. The previous numeric engine remains available through this DEV entry point; its rules and tests are intact.

The current letter-strike fixture is `JOYT / CHER / GLOM / SADE`, with Strike L at row 3 column 2, Ward E at row 4 column 4, and armoured M/Y. A verified route is **JOY → CHEER → MELODY → GLAD → MOANER**, using Ward E in CHEER and Strike L in MELODY. It deals 2, 3, 3, 2, 2 strikes and wins with one Resolve. The [prototype tuning notes](docs/melancholy-prototype.md) include the exact refill sequence, opening outcomes and alternative routes. No procedural generator is implemented.

Enemy meaning and parts of speech are authored independently of the large validity dictionary. The current encounter includes GAY in its happy/counter sense, SANDY as an adjective, and GLOOMY as a resisted adjective. Useful prototype adjectives have explicit annotations; this remains a curated vocabulary, not complete dictionary-wide POS or semantic classification. New annotations are encounter-owned so they cannot change old saved turns.

Phone typography scales with viewport width, capped by height on short screens. The playable grid uses the available height up to 18rem, with extra space reserved for tutorial explanations or notices. At 375 × 812 the grid is about 338px wide, with 80px square tiles and 36px letters. A 375 × 629 touch viewport simulates the reduced space above mobile browser controls: the main board is about 301px wide and the tutorial board about 257px. Shorter screens keep square touch targets and space below the grid without overlapping the tutorial. The lighter olive `#191b14` background stays the same for both system colour preferences, with no outer frame. Special-tile diamonds share consistent SVG geometry aligned with their engine-supplied labels. Quiet borders and smaller selection-order numbers keep letters dominant. Selected tiles retain the solid background and strong outline.

In DEV settings, **MATCH HINT: OFF / DOT / UNDERLINE** compares two subtle blue indications that a tile letter still exists in the enemy. OFF is the default; hints are absent in production, never influence combat, and disappear when the final matching enemy instance dies. DOT leaves more space around the glyph and its special label on the mini viewport. Both alternatives remain available for comparison.

## Intro and verification

`WyrmDecoder.tsx` keeps the `waiting → enemy → tiles → ready` sequence and measures actual element bounds while moving. Enemy cells decode first, tiles follow the alternating-row route, and the wyrm returns through the title. Reduced motion reveals both stages quickly. Paths and timings are unchanged; the sprite and its dock scale with the phone UI. Font families and the authored terminal palette are retained.

The sprite's body, head and tongue loops have explicit starting transforms so they animate on their first production mount as well as in development. Reduced motion keeps those parts still.

Engine tests cover exact predicted targets versus submission, dead-slot identity/position, sequential armour hits, duplicate targeting, semantics, LONG/grammar stacking, independent specials, Resolve and terminal states. Daily tests cover versioned frozen content, old/new exact restore, tampering, completion locks/partial writes, stale tabs, UTC boundaries, result/stat counts, positional share symbols and submission evidence. Hint tests check living/dead duplicate letters and their distinction from real predicted strikes. Browser checks cover the three hint modes, red/blue targets, square centered tiles, phone fit, old/new reloads, all starting anchors, full victory, logs, sharing and DEV/production separation.
