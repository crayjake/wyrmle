# WYRMLE

A deterministic daily word game where the enemy word's letters are its health. Select tiles in spelling order, preview the exact enemy cells that will be struck, and remove every letter before Resolve runs out. The existing flat terminal palette, fonts, letter cells, tile grid and wyrm decode intro are retained.

The [gameplay and onboarding review](docs/gameplay-onboarding-pass.md) records the independent before/after player tests, REGEN and undo rules, difficulty evidence, and browser validation.

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
- **REGEN:** after every strike resolves, each used Regen tile recovers one matching enemy letter by one step: dead → alive without armour → armoured. Two hits is the cap. Dead matching copies recover first, then living unarmoured copies, in stable left-to-right order. An already armoured or unrelated letter cannot benefit. Several Regen tiles resolve one at a time, so one can revive a letter and another can armour it.
- **Armour:** a double-outlined cell needs two strikes. Its first hit breaks armour; the next removes the letter.
- **Grammar:** an encounter may explicitly configure a strike allowance such as `adjective: 1`. A resisted adjective can then strike its first matching tile; a neutral adjective its first two. Positive grammar cannot add hits beyond a counter's matching tiles. Unknown/ambiguous parts of speech earn no allowance; no noun/adjective weakness is inferred globally. Negative modifiers reduce normal allowances without blocking Strike overrides.

Each tile and enemy letter has its own identity. Strike targeting finishes wounded armoured copies first, otherwise proceeds left to right. Dead cells cannot be struck, but Regen can revive them. Two distinct selected tiles can each hit the same armoured cell once. Victory is checked after both damage and recovery: removing the last enemy letter wins even when the attack spends the final Resolve, provided Regen does not bring a letter back.

The pure engine is `src/game/letterStrike.ts`: `createLetterStrikeGame`, `toggleLetterStrikeTile`, `clearLetterStrikeSelection`, `previewLetterStrike`, and `submitLetterStrike`. Preview and submission share an evaluator and ordered hit/recovery records. `selectEnemyTarget` and `selectEnemyRecoveryTarget` hold the deterministic targeting rules. Dictionary, semantic lookup, selected-ID lookup and deterministic board-order refill are reused. Refills receive fresh IDs and no special effect. Grammar changes matching-tile allowances, never numeric damage. Regen is opt-in per encounter; published snapshots without it keep their exact historical outcomes.

## Battle presentation

Targets come directly from real preview hits: **blue −** means armour breaks and the letter survives; **red ×** means a strike removes the letter. Two hits that finish an armoured cell preview removal. A restrained **red +** also marks any later Regen recovery, including a letter returning from a dot. The consequence line says which letter returns or gains armour, and accessible cell names describe both damage and recovery. Defeated cells become quiet, borderless dots in their original slots. Each dot is positioned at the cell's exact centre independently of font metrics. There is no large target legend beside the enemy.

Committed hit records animate in selection order, followed by recovery records. Two hits to one armoured letter visibly progress from double outline to single outline to dot; Regen can then restore the letter or its armour. The UI blocks another move and waits to open the result until the short sequence finishes. Reduced motion applies the final state immediately. The engine state and save commit immediately and are never driven by animation timers; a refresh restores the final committed state without replaying old animations.

The action area contains the selected word and a compact preview such as **COUNTER · 2 STRIKES · REGEN**, with applied LONG/grammar allowances and special effects. A consequence line shows Resolve before/after and any matching-letter recovery before Attack. Exact predicted outcomes also appear on the enemy cells. Normal play has no numeric enemy HP, DMG, charge bar, WORD/READY labels, player-area divider, or permanent recent-history panel. Validation, decode and terminal messages remain available.

The header's **Log** opens every submitted turn, newest first: strikes, semantic outcome, applied grammar, triggered effects, removed letters, armour breaks and recoveries. It also contains the compact **Undo last word** control and remaining allowance. Statistics are available from the Log and result screen. In Normal mode, the definition stays attached to the enemy, with compact grammar labels underneath separated by dots, matching the current move's modifiers. Actual weaknesses are green and resistances red; neutral types are omitted. Exact allowances remain in accessible text and hover descriptions. STRIKE, WARD and REGEN labels and explanations use the actual board and configured effects through `letterStrikeHud.ts`.

## Modes and first visit

| Mode | Definition | Undos per Daily |
| --- | --- | --- |
| **Normal** — recommended | Shown | 3 |
| **Hard** | Hidden | 1 |
| **Hardcore** | Hidden | 0 |

Part of speech and explicit encounter mechanics remain visible in every mode. All three use the identical Daily encounter, board, refill, Resolve, armour, semantic relationships and grammar rules. Modes change information and forgiveness only. The production header's **Settings** changes the preferred mode. **Begin** fixes that Daily's mode, even before its first attack; later preference changes apply to the next run without resetting progress.

First-time visitors learn through **26 guided steps**, using the real engine and shared enemy, tile, preview and Resolve components. The first battle is **SAD**, defined as “feeling unhappy”. Players acknowledge the goal and Resolve, manually select **GLAD**, see selected A/D mapped to enemy A/D, learn why GLAD is a counter, and watch both letters disappear with one Resolve spent. Neutral **SUN** then removes S for a first small victory.

Small isolated examples then teach armour with two separate **SUN** attacks; resisted **SAD** before adding a Strike S; Ward **DIG**, preserving Resolve at 3/5; two Regen previews showing a dead E returning and a living E gaining armour; the safe ordinary E in **RED**; adjective **DAMP**; and neutral six-letter **STREAM** for LONG. Consequences are described before the relevant attack and followed by a result acknowledgement. Regen previews teach the hazard without requiring the player to commit the harmful choice.

The board and enemy stay visible. Irrelevant controls are dimmed or disabled, the next tile is highlighted, and each step asks for one interaction or acknowledgement. Matching A/D use explicit connectors. Continue occupies the bottom Attack button's position and switches to Attack when a move is ready; animation gates prevent rushing past the result. **Skip tutorial** is always available. First-time completion or Skip marks onboarding complete and leads to mode selection and **Play today's Wyrmle**. Help offers manual replay without consuming a Daily; **Settings → Beta tools → Reset tutorial** restarts the lessons and returns to the Daily when completed or skipped.

**Settings → Beta tools** is available in production during beta. **Reset puzzle** removes the open date's saved run and result, then opens a fresh attempt using that date's current published puzzle and the preferred mode. Other dates and preferences are preserved; statistics recalculate from the remaining results. **Reset tutorial** marks onboarding incomplete and immediately starts the lessons while preserving Daily progress and the preferred mode. Reloading before finishing or skipping keeps the tutorial open.

The Daily battle uses that same bottom action for **Begin**, **Attack**, and **View result**. Its date/mode/status row is omitted; mode remains available in Settings and results. Resolve uses its label and five segments on one line, without a duplicate fraction; its meter exposes the exact remaining value to assistive technology. Off-date and save-error notices still appear when needed.

`UserPreferences` persists separately at `wyrmle:preferences:v1`: `preferredMode`, `hasCompletedOnboarding` and `hasChosenMode`. Skipping records completion before mode selection, so an interrupted choice resumes there. Existing Daily records identify returning visitors when preferences are missing; an explicit tutorial reset still takes precedence. Tutorial state lives only in its own reducer; it writes no Daily run or result, consumes no attempt, and affects no statistics or streak. Returning players resume their unfinished Daily or open today's puzzle.

## Daily puzzle definition

Daily IDs are strictly validated UTC dates, `YYYY-MM-DD`, from `getDailyPuzzleId(date)`. Days change at midnight UTC, independent of timezone or daylight saving.

`src/daily/catalog.ts` contains the published encounter. `getDailyPuzzle(id)` returns a deeply frozen definition containing date/ID, game/puzzle versions, intrinsic difficulty label, enemy word/definition, semantic groups, enemy letter identities/armour, starting Resolve, exact board/special tiles, refill queue and rules. The literal catalog is independent of mutable DEV encounter defaults.

**September 24 and 25, 2026 UTC share the exact reviewed DESPAIR puzzle**, selected explicitly for its variety of short wins and last-Resolve finishes. Both dates use the frozen snapshot at `src/daily/puzzles/2026-09-24-v6.json`, with puzzle version 6 and the existing `letter-strike-4` rules. New and untouched attempts use DESPAIR. Already-started and completed attempts retain their original version, including September 24 generated MELANCHOLY version 5, earlier authored versions and September 25 authored version 4. **Settings → Beta tools → Reset puzzle** clears an older attempt and opens the current DESPAIR board for that date. Other dates retain the authored catalog. Each date has its own attempt and result; published content is deterministic and independent of player state or later generator rankings.

New attempts dated **2026-09-25 UTC onward** otherwise use `letter-strike-4` / puzzle version 4: the revised board/refills, LONG, independent Strike and adjective weakness. Earlier dates retain their v1 rules except for the explicit September 24 generated selection above. Committed v2/v3 attempts and completed results remain pinned to their original rules, boards and word annotations; their outcomes and completion timestamps do not change. Validated older attempts with no committed turns open under the latest published definition, with original bytes kept until the first new commit. DEV letter-strike playtests use the current prototype immediately. Old future-date DEV v1 records that disagree with the publication boundary remain unsupported and preserved; reset is explicit.

Today's saved run/result takes opening priority; otherwise the latest unfinished earlier daily can resume. A tab crossing midnight keeps its attempt and offers **Play today**. Statistics also offers unfinished earlier dates. Starting a date does not delete earlier runs.

## Intrinsic puzzle difficulty

Before Begin, the Daily shows only **DIFFICULTY: EASY / MEDIUM / HARD / EXPERT**. This rates the puzzle itself and is identical in Normal, Hard and Hardcore. No minimum word count, solution or semantic anchor is shown to the player.

`src/generator/difficulty.ts` uses minimum winning word count as the primary input, then adjusts for Resolve slack, observed winning strategy/opening diversity, vocabulary familiarity, armour, special-tile/grammar dependence, traps and proven clutch-only dependence. Weights and thresholds are explicit and tunable. A bounded winning witness supplies only a best-known depth: an unproved minimum and its exact slack remain `null`, and the analysis is marked as an estimate. Route counts remain observed lower bounds even when minimum depth is proved.

The DESPAIR board shared by September 24 and 25 is **MEDIUM** (40/100 in DEV analysis), with a proved three-word minimum. The offline audit exhausts 17,178 physical openings and 2,824,308 possible finishing selections, finds no one/two-word win, and independently replays a three-word witness. Other stored Daily ratings currently remain bounded estimates. Reproduce the audit with `node scripts/prove-daily-minimum.ts`, then regenerate reports with `node scripts/rate-dailies.ts`. These are offline commands and the proof can take time. Full analysis and depth evidence live under `src/generator/data/` and are available through DEV tools; production imports only `src/daily/difficultyLabels.json`.

## Persistence and completion

| Data | Responsibility |
| --- | --- |
| `DailyPuzzleDefinition` | Immutable, versioned rules/content for a date |
| `DailyRun` | Fixed run mode, undo usage/revision and immutable prior-state stack; enemy-letter/armour states, Resolve, board/IDs, refill cursor/next ID, committed words/hits/recoveries/effects, status and finish time |
| `DailyResult` | Mode, intrinsic difficulty, undos used/remaining, permanent completion summary and ordered turn evidence; statistics are derived from results |

Runs use `wyrmle:letter-strike:daily:v1:run:YYYY-MM-DD`; results use the matching `result:` namespace. Former numeric-mode `wyrmle:daily:*` records are preserved untouched, excluded from the new game/statistics, and never reinterpreted as letter-strike saves. Beta puzzle reset and DEV reset/clear affect only the new namespace.

`src/daily/persistence.ts` accepts an injected storage interface. It replays committed attacks against the canonical puzzle and verifies the entire snapshot: letter/armour states, board, Resolve, refill position, effects and result totals. Unsupported versions or corruption block the run while preserving the record.

Save schema 5 supports `mode: "normal" | "hard" | "hardcore"`, run revisions, durable undo usage, complete immutable undo snapshots and result assistance/difficulty metadata. Schema 1/2/3/4 records are checked against their exact historical shape and version, then enriched in memory from canonical replay. Schemas 1–3 gain Normal mode; schema 4 retains its recorded Normal/Hard mode. Historical runs gain replayed undo snapshots and zero prior undo usage. This preserves original Strike allowances, vocabulary and LONG behavior. Reads never rewrite original bytes or completion timestamps; continuing an active run writes schema 5 while retaining its committed game version and mode. Completed results remain authoritative. Their recorded difficulty label is preserved if offline rating thresholds are later recalibrated.

Undo restores the complete committed state immediately before the most recent valid word, directly from its snapshot: enemy life/armour, Resolve, board tiles and types, IDs, refill cursor/next ID, move history and all semantic, grammar, Strike, Ward and Regen consequences. Half-selected words and transient errors are cleared. Each undo consumes one allowance that survives reloads and replaying the same turn. Undo becomes available only after a submitted move and is unavailable after permanent completion. Monotonic revisions reject stale attacks and undos from another tab, including when undo returns the board to an identical position. A failed write consumes no allowance and offers an explicit retry.

Every accepted attack saves before the UI advances. Completion writes the authoritative result before the terminal run snapshot, so an interrupted second write cannot reopen the date. Results reconstruct missing/stale terminal runs; valid terminal runs recover missing results. The first completion stays authoritative. Stale tabs cannot replace it or regress progress, and storage events refresh other tabs.

Selections, errors and intro progress are transient. Refresh restores committed gameplay with letters and tiles revealed. Storage failures offer retry/reload actions. Data stays in this browser, with no accounts/cloud sync; clearing browser storage removes it. Version constants live in `src/daily/versions.ts`.

## Results and statistics

`buildDailyResult(puzzle, game, completedAt, mode, undosUsed)` is pure. It records mode, intrinsic puzzle difficulty, undos used/remaining, outcome/enemy, remaining Resolve, words used, total strikes, letters removed, armour broken, largest single-turn removal, strongest strike count, Counter/Neutral/Resisted counts, actual Strike activations, Ward saves and Regen recovery evidence. The result presents Victory/Defeat with mode, difficulty and undo usage, numeric Resolve plus one segment per starting Resolve, semantic breakdown and letter/effect totals. Word count is secondary in the optional history. Strike counts only when its tile hits. Ward counts once per protected turn. Each turn's removal/armour outcomes reflect the final state after recovery; ordered damage and recovery events remain separate. No player score, stars or rankings are invented.

`calculateStats(results, todayId)` derives played, wins, win rate, current/longest winning streaks, average Resolve on wins, best Resolve, largest turn by strikes, total removed letters, Counter/Neutral/Resisted moves, Strike activations, Ward saves and armour breaks, plus word-length and different-enemy statistics. Aggregates are not stored. Only the first completion per puzzle counts; future DEV dates are excluded. Streaks follow consecutive UTC dates. Yesterday can sustain a streak while today is unplayed. Completing an earlier run after midnight still belongs to its puzzle date.

The current statistics screen stays combined. Stored modes, intrinsic difficulty and undo usage allow future comparisons across Normal, Hard and Hardcore without changing combat or permitting a second attempt at the same Daily.

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

C/N/R mean Counter/Neutral/Resisted. Each slot is `·` untouched that turn, `◐` armour broken but surviving, `■` removed, `▣` armour broken and removed in the same word, or `↺` recovered by Regen. ◇ means Ward and ◆ means Strike triggered. Recovery takes precedence when the same slot is damaged and then healed. A previously broken letter removed on a later turn uses `■`, not `▣`. There is no redundant word count. The result's expandable share preview explains the notation; the copied text omits the legend and all enemy/submitted words, board letters and tile IDs. Clipboard denial provides a selectable fallback.

The engine emits `letterOutcomes` for every original slot on every turn, including before/after hits, armour-break/removal flags and any recovery, from that turn's ordered hit/recovery records. Result turns copy these events. Sharing never guesses the turn history from the final enemy state, and a same-word double hit correctly produces `▣` unless subsequent recovery changes the final outcome.

## Future global ranking boundary

`buildDailyScoreSubmission(result)` in `src/daily/submission.ts` creates a deterministic payload: mode, intrinsic difficulty, undos used/remaining, puzzle/game/puzzle versions, outcome, Resolve, turns, total strikes, removed letters, armour breaks, semantic sequence, per-turn positional outcomes and recoveries, Ward/Strike usage, completion time, and ordered tile IDs for replay. A future submission call can run after successful completion persistence in `useDailyRun.ts`.

A server must resolve the versioned puzzle, replay the evidence and calculate comparison values itself. Client timestamps and totals are not authoritative. No network request, leaderboard or fake ranking is implemented.

## Development comparison and tools

In `npm run dev`, **Settings → Development tools** offers date selection, puzzle reset, history inspection/clear, and real engine win/loss replays. `/?puzzle=2026-09-24` selects a test date. Development controls and date override are absent from production; mode Settings and the separate Beta tools remain available.

Onboarding tools provide **Replay onboarding**, **Launch tutorial directly**, **Reset onboarding flag** (takes effect on reload), and **Preview first-time flow**, plus a jump selector for every tutorial step and buttons for its isolated fixtures. Direct tutorial launch returns to the Daily without changing preferences; first-time preview also leaves preferences and Daily records intact. **Force Normal / Force Hard / Force Hardcore** temporarily overrides presentation only, with **Use run mode** restoring the saved mode. These overrides do not rewrite the run or result mode and disappear on refresh. The DEV undo-count control edits an active run's used allowance within its fixed mode limit. An expandable **Full puzzle difficulty analysis** exposes solver evidence without adding it to production.

**Settings → Development tools → Enemy letter layout → Grid after reveal** previews a larger enemy grid in the Daily and disposable playtests. The intro still decodes the original row; once the wyrm docks, the same letter elements move into up to five columns in reading order. Armour, previews, removed-letter slots and targeting keep their existing identities. The grid uses the space above the definition and shares shorter screens with the playable board. **Row** restores the usual presentation. The setting defaults off, resets on reload, writes no preferences or Daily data, and is unavailable in production.

**DAMAGE MODE** and **LETTER-STRIKE MODE** launch disposable DEV comparisons. Switching or restarting creates a fresh encounter. They never save daily history; **Return to daily game** restores the saved daily. The previous numeric engine remains available through this DEV entry point; its rules and tests are intact.

The current letter-strike fixture is `JOYT / CHER / GLOM / SADE`, with Strike L at row 3 column 2, Ward E at row 4 column 4, and armoured M/Y. A verified route is **JOY → CHEER → MELODY → GLAD → MOANER**, using Ward E in CHEER and Strike L in MELODY. It deals 2, 3, 3, 2, 2 strikes and wins with one Resolve. The [prototype tuning notes](docs/melancholy-prototype.md) include the exact refill sequence, opening outcomes and alternative routes.

**GENERATOR / SOLVER** opens the separate generated-puzzle review browser, also available directly at `/?generator=1`. It starts with five generated MELANCHOLY candidates and can generate, rank, inspect and play further candidates through the real letter-strike battle. `npm run generate -- --count 200 --enemy MELANCHOLY` runs a local batch; omit `--enemy` for automatic suitability-based selection. See the [generator guide](docs/generator.md) for APIs, mutation, quality metrics, search limits and JSON export, and the [five-candidate review report](docs/melancholy-generated-review.md) for recorded results. Generation never publishes candidates automatically; DESPAIR's shared September 24 and 25 publication uses explicit frozen catalog entries.

Enemy meaning and parts of speech are authored independently of the large validity dictionary. The current encounter includes GAY in its happy/counter sense, SANDY as an adjective, and GLOOMY as a resisted adjective. Useful prototype adjectives have explicit annotations; this remains a curated vocabulary, not complete dictionary-wide POS or semantic classification. New annotations are encounter-owned so they cannot change old saved turns.

Phone typography scales with viewport width, capped by height on short screens. The playable grid uses the available height up to 18rem, with extra space reserved for tutorial explanations or notices. At 375 × 812 the grid is about 338px wide, with 80px square tiles and 36px letters. A 375 × 629 touch viewport simulates the reduced space above mobile browser controls: the main board is about 301px wide and the tutorial board about 257px. Shorter screens keep square touch targets and space below the grid without overlapping the tutorial. The lighter olive `#191b14` background stays the same for both system colour preferences, with no outer frame. Special-tile diamonds share consistent SVG geometry aligned with their engine-supplied labels. Quiet borders and smaller selection-order numbers keep letters dominant. Selected tiles retain the solid background and strong outline.

In DEV settings, **MATCH HINT: OFF / DOT / UNDERLINE** compares two subtle blue indications that a tile letter still exists in the enemy. OFF is the default; hints are absent in production, never influence combat, and disappear when the final matching enemy instance dies. DOT leaves more space around the glyph and its special label on the mini viewport. Both alternatives remain available for comparison.

## Intro and verification

`WyrmDecoder.tsx` keeps the `waiting → enemy → tiles → ready` sequence and measures actual element bounds while moving. Enemy cells decode first, tiles follow the alternating-row route, and the wyrm returns through the title. Reduced motion reveals both stages quickly. Paths and timings are unchanged; the sprite and its dock scale with the phone UI. Font families and the authored terminal palette are retained.

The sprite's body, head and tongue loops have explicit starting transforms so they animate on their first production mount as well as in development. Reduced motion keeps those parts still.

Engine tests cover exact predicted targets versus submission, dead-slot identity/position, sequential armour hits, duplicate targeting, semantics, LONG/grammar stacking, independent specials, Resolve and terminal states. Regen tests include revival, armour gain/cap, duplicate priority, post-strike ordering, invalid moves, preview parity and solver consequences. Daily tests cover versioned frozen content, schema migration, exact undo restoration, durable allowances, fixed modes, stale revisions, failed writes, completion locks, UTC boundaries, result/stat counts, positional share symbols and submission evidence. Difficulty tests compare depth, solution diversity, vocabulary and honest bounded estimates. Tutorial tests cover gated lesson progression, isolation from Daily data, Skip, first-time flow and manual replay. Hint tests check living/dead duplicate letters and their distinction from real predicted strikes. Browser verification includes tutorial/Daily phone fit, visible predictions, mode selection, logs, undo and DEV/production separation.
