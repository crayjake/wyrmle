# WYRMLE

A deterministic daily word game where the enemy word's letters are its health. Tap or swipe across tiles in spelling order, preview the meaning match and exact enemy cells that will be hit, and remove every letter before your lives run out. New puzzles focus on meaning, with Life, Hit and Revive tiles adding tactical choices.

The [meaning-first review](docs/meaning-coverage-review.md) records the current rules, frozen dictionary and CHAOS publication. The [lexical and onboarding review](docs/lexical-onboarding-review.md) explains the earlier word-label pipeline, the short demo and the research behind it. The [gameplay review](docs/gameplay-onboarding-pass.md) preserves earlier player tests and records phone checks. The [ANGER review](docs/revive-candidate-notes.md) records the earlier bonus-based publication and its scoped rescue certificate; those proofs do not transfer to meaning-first puzzles.

## Run and verify

```sh
npm install
npm run dev
npm test
npm run build
npm run lint
```

Tests use Node's built-in TypeScript support; use Node 22.18+ or a newer supported release. New puzzles accept only spellings with a stored dictionary definition and a frozen puzzle meaning classification. Open English Wordnet 2025 supplies the base definitions; a pinned [Wiktionary supplement](src/lexicon/FUNCTION_WORDS.md) fills its grammatical-word gaps, including WHERE, THE and AND. Archived puzzles keep their original validity rules. Gameplay makes no API requests and needs no LLM.

## GitHub Pages

In [repository Settings → Pages](https://github.com/crayjake/wyrmle/settings/pages), set **Build and deployment → Source → GitHub Actions**. Push this project, including `.github/workflows/pages.yml`, to `main`. The workflow installs locked dependencies on Node 24, runs tests and lint, typechecks/builds, then deploys `dist`. It can also be run manually from **Actions → Deploy to GitHub Pages → Run workflow** on `main`.

The project site will be **https://crayjake.github.io/wyrmle/** after its first successful deployment. The workflow takes the base path from GitHub Pages, so scripts, lazy-loaded chunks, styles and the favicon work below `/wyrmle/`; a configured custom domain is supported too. Local `npm run dev` and ordinary builds keep `/` as their base. No `gh-pages` branch, deployment dependency or personal access token is needed. Onboarding, modes and Daily saves remain local to each browser and site origin.

The [sharing and icons guide](docs/sharing-and-icons.md) covers the social preview, wyrm favicon, iPhone Home Screen icon, artwork exports and public URL configuration.

To check the project-site build locally:

```sh
VITE_BASE_PATH=/wyrmle/ npm run build
VITE_BASE_PATH=/wyrmle/ npm run preview -- --host 127.0.0.1
```

Open **http://127.0.0.1:4173/wyrmle/**. Use the same base for build and preview. This follows the [Vite Pages deployment guide](https://vite.dev/guide/static-deploy#github-pages) and GitHub's [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Game rules

- A valid word normally costs one life. Invalid words spend nothing.
- **COUNTER:** every selected tile with an eligible same-letter target hits. Counters include direct opposites and reviewed ideas that overcome the enemy: CHEERFUL counters ANGER through good spirits.
- **NEUTRAL:** one normal matching hit, in spelling order. Related meanings without a counter or reinforcing relationship are neutral.
- **RESISTED:** no normal semantic hits.
- **HIT:** that tile guarantees a matching strike, including on resisted words, without consuming the normal semantic allowance. `LAD` with Hit L hits L through Hit, then A through its neutral allowance. Each tile hits at most once, including on counters. Multiple Hit tiles can each hit once.
- **LIFE:** including any green Life tile makes that valid turn cost zero lives; Life tiles do not stack or add a life.
- **REVIVE:** after every strike resolves, each used Revive tile recovers one matching enemy letter by one step: dead → alive without armour → armoured. Two hits is the cap. Dead matching copies recover first, then living unarmoured copies, in stable left-to-right order. An already armoured or unrelated letter cannot benefit. Several Revive tiles resolve one at a time, so one can revive a letter and another can armour it.
- **Armour:** a double-outlined cell needs two hits. Its first hit breaks armour; the next removes the letter.
- **Finite refills:** each encounter stores its exact replacement reserve. Used tiles refill in board order until that reserve runs out; afterward, their slots stay empty. The 4×4 grid keeps its geometry and empty slots cannot be selected. Keep playing with the remaining letters. An empty reserve alone does not end the run: defeat occurs when lives run out or no word from that puzzle’s dictionary can be spelled. Removing the last enemy letter wins first.

New meaning-first puzzles award **no word-type or length bonuses**. Every playable word has a frozen definition, selected sense, relation, reason and model assessment, compiled from the complete starting/refill letter supply before solving. A word with no stored definition is rejected before it spends a life. The [offline semantic pipeline](docs/offline-semantics.md) assesses all applicable dictionary senses using local embedding and entailment models; new generation fails if an assessment is missing. Neutral means the assessed evidence did not support a counter or reinforcing meaning under the versioned policy.

Archived saves retain their configured grammar and LONG allowances, vocabulary and original outcomes. Their previews and help show those bonuses only when the saved encounter actually uses them.

Each tile and enemy letter has its own identity. Hit targeting finishes wounded armoured copies first, otherwise proceeds left to right. Dead cells cannot be struck, but Revive can revive them. Two distinct selected tiles can each hit the same armoured cell once. Victory is checked after both damage and recovery: removing the last enemy letter wins even when the attack spends the final life, provided Revive does not bring a letter back.

The pure engine is `src/game/letterStrike.ts`: `createLetterStrikeGame`, `toggleLetterStrikeTile`, `clearLetterStrikeSelection`, `previewLetterStrike`, and `submitLetterStrike`. Preview and submission share an evaluator and ordered hit/recovery records. `selectEnemyTarget` and `selectEnemyRecoveryTarget` hold the deterministic targeting rules. Dictionary, semantic lookup, selected-ID lookup and deterministic board-order refill are reused. Refills receive fresh IDs and no special effect. Archived grammar rules change matching-tile allowances, never numeric damage. Revive is opt-in per encounter; published snapshots without it keep their exact historical outcomes.

## Battle presentation

Targets come directly from real preview hits: **blue −** means armour breaks and the letter survives; **red ×** means a strike removes the letter. Two hits that finish an armoured cell preview removal. A restrained **red +** also marks any later Revive recovery, including a letter returning from a dot. The move preview says which letter returns or gains armour, and accessible cell names describe both damage and recovery. Defeated cells become quiet, borderless dots in their original slots. Each dot is positioned at the cell's exact centre independently of font metrics. There is no large target legend beside the enemy.

Committed hit records animate in selection order, followed by recovery records. Two hits to one armoured letter visibly progress from double outline to single outline to dot; Revive can then restore the letter or its armour. The UI blocks another move and waits to open the result until the short sequence finishes. Reduced motion applies the final state immediately. The engine state and save commit immediately and are never driven by animation timers; a refresh restores the final committed state without replaying old animations.

The action area shows the word, then one meaning/result line such as **COUNTERS ANGER · 2 HITS** or **NEUTRAL MEANING · 1 HIT**. A second line appears only for applied effects: blue **Hit tile**, green **Life saved**, red **Revive: E returns**, or a final-life warning. A guaranteed Hit tile is not described as an extra +1 because a counter may already use that tile. Redundant unchanged-life counters and unlisted-meaning boilerplate are omitted. Exact predicted outcomes remain on enemy cells; validation, decode and terminal messages take the same compact area. Archived bonus-based encounters still list any applied LONG or grammar modifier.

The header's **Log** opens every submitted turn, newest first: hits, semantic outcome, applied grammar, triggered effects, removed letters, armour breaks and recoveries. It also contains the compact **Undo last word** control and remaining allowance. Statistics are available from the Log and result screen. In Normal mode, the definition stays attached to the enemy. Archived encounters with grammar modifiers keep their compact weakness/resistance labels; new meaning-first puzzles have none. HIT, LIFE and REVIVE labels and explanations use the actual board and configured effects through `letterStrikeHud.ts`.

## Modes and first visit

| Mode | Definition | Undos per Daily |
| --- | --- | --- |
| **Normal** — recommended | Shown | 3 |
| **Hard** | Hidden | 1 |
| **Hardcore** | Hidden | 0 |

Part of speech and explicit encounter mechanics remain visible in every mode. All three use the identical Daily encounter, board, refill, Lives, armour, semantic relationships and grammar rules. Modes change information and forgiveness only. The production header's **Settings** changes the preferred mode. **Begin** fixes that Daily's mode, even before its first attack; later preference changes apply to the next run without resetting progress.

First-time visitors see a brief description of the goal, free tile selection, five lives and meaning-based hits. They can skip straight to play or try a **two-word demo: GLAD → SUN against SAD**. It uses the real engine and the same enemy, tile, preview, Lives and controls as the Daily. The preview explains the matching letters before each play, then the player sees a small victory.

Armour, resistance, Hit, Life and Revive are **optional examples**, available from the introduction or completion screen and through replay later. The old grammar and LONG fixtures remain accessible through DEV jumps for archived-rule checks. These examples are not a compulsory 26-step sequence. The next letter is highlighted and unrelated tiles are disabled, while the board keeps exactly the Daily’s size and position at each tested phone viewport. **Skip tutorial** is always available. First-time completion or Skip leads to mode selection. Help offers replay without consuming a Daily; **Settings → Beta tools → Reset tutorial** restarts the introduction while preserving puzzle progress.

**Settings → Beta tools** is available in production during beta. **Reset puzzle** removes the open date's saved run and result, then opens a fresh attempt using that date's current published puzzle and the preferred mode. Other dates and preferences are preserved; statistics recalculate from the remaining results. **Reset tutorial** marks onboarding incomplete and immediately starts the lessons while preserving Daily progress and the preferred mode. Reloading before finishing or skipping keeps the tutorial open.

The Daily battle uses that same bottom action for **Begin**, **Play word**, and **View result**. Its date/mode/status row is omitted; mode remains available in Settings and results. Lives uses a small segmented wyrm, without a duplicate fraction; its meter exposes the exact remaining value to assistive technology. On finite puzzles, **REFILLS** counts remaining reserve copies of surviving enemy letters, plus a blank tile for all other letters. Counts do not reveal draw order or promise a hit. Off-date and save-error notices still appear when needed.

`UserPreferences` persists separately at `wyrmle:preferences:v1`: `preferredMode`, `hasCompletedOnboarding` and `hasChosenMode`. Skipping records completion before mode selection, so an interrupted choice resumes there. Existing Daily records identify returning visitors when preferences are missing; an explicit tutorial reset still takes precedence. Tutorial state lives only in its own reducer; it writes no Daily run or result, consumes no attempt, and affects no statistics or streak. Returning players resume their unfinished Daily or open today's puzzle.

## Daily puzzle definition

Daily IDs are strictly validated UTC dates, `YYYY-MM-DD`, from `getDailyPuzzleId(date)`. Days change at midnight UTC, independent of timezone or daylight saving.

`src/daily/catalog.ts` contains the published encounter. `getDailyPuzzle(id)` returns a deeply frozen definition containing date/ID, game/puzzle versions, intrinsic difficulty label, enemy word/definition, semantic groups, enemy letter identities/armour, starting Lives, exact board/special tiles, refill queue and rules. Meaning-first definitions also carry their complete frozen `meaningLexicon`; saved runs never pick up later profile edits. The literal catalog is independent of mutable DEV encounter defaults.

**September 25 now publishes CHAOS v11** (`letter-strike-7`): five lives, armoured A, Life R, Hit A, Revive A and 20 refill tiles. It has no grammar or length bonuses. Its frozen table stores definitions and classifications for all **29,719** accepted words that fit the total letter supply. The [selected review artifact](artifacts/meaning-v2/selected.json.gz) retains the exact encounter, solver evidence and opening certificate; the [publication review](docs/meaning-coverage-review.md) explains the selection and semantic checks. Every **3,060 opening spelling and all 8,041 physical tile selections** have a replayed familiar winning continuation, with no unsafe or unknown openings. This guarantees recovery after the first word; later choices can still lose.

The earlier **September 25 ANGER v9** publication remains archived at `src/daily/puzzles/2026-09-25-v9.json`: five lives, armoured E, Life E, Hit E, Revive N, 19 refills, seven-letter LONG and adjective bonuses. Its generation seed, routes and safety certificate apply only to that frozen bonus-based version.

**September 24 keeps DESPAIR v7** with the same board and refill as its original v6 publication, plus explicitly versioned broad word classification. Existing attempts with committed moves and completed results on either date remain pinned to their own snapshots, including ANGER v8's original supply, DESPAIR v6/v7, generated MELANCHOLY v5 and the earlier authored rules. **Settings → Beta tools → Reset puzzle** deliberately clears that date’s saved attempt and opens its current publication. Other dates retain the authored catalog. Each date has independent progress and results.

Validated zero-word attempts with zero undos, including Begin-only saves, can open the latest published definition; the original stored bytes remain until a new commit. Historical outcomes and completion timestamps are never recalculated under newer rules. Unsupported old development records remain preserved and require an explicit reset.

Today's saved run/result takes opening priority; otherwise the latest unfinished earlier daily can resume. A tab crossing midnight keeps its attempt and offers **Play today**. Statistics also offers unfinished earlier dates. Starting a date does not delete earlier runs.

## Intrinsic puzzle difficulty

Before Begin, the Daily shows only **DIFFICULTY: EASY / MEDIUM / HARD / EXPERT**. This rates the puzzle itself and is identical in Normal, Hard and Hardcore. No minimum word count, solution or semantic anchor is shown to the player.

`src/generator/difficulty.ts` uses minimum winning word count as the primary input, then adjusts for Lives slack, observed winning strategy/opening diversity, vocabulary familiarity, armour, special-tile/grammar dependence, traps and proven clutch-only dependence. Weights and thresholds are explicit and tunable. A bounded winning witness supplies only a best-known depth: an unproved minimum and its exact slack remain `null`, and the analysis is marked as an estimate. Route counts remain observed lower bounds even when minimum depth is proved.

Current **CHAOS v11** is rated **MEDIUM (estimate)**. Its review retains 30 winning strategies, including 10 that play after empty board slots appear, and scores 82.01 for generation quality. **CLEAR → SORT → HARMONY** is a three-word winning witness; **CHARM → SORT → ANGER → SYSTEM → HAND → CAT** is a six-word final-life win. Three words is an upper bound, not a proved minimum. The complete opening certificate is separate from shortest-route proof and does not claim that every later choice is recoverable.

The archived finite ANGER v9 rating is also **MEDIUM**, based on a bounded three-word witness and observed alternatives, including a six-word final-life win. Its review retains 32 winning strategies, including 14 that play a word after empty board slots appear. Its separate certificate covers 204 physical choices across 98 curated opening words, rather than all dictionary openings.

The archived **DESPAIR v6** has a fingerprinted three-word minimum proof: 17,178 physical openings and 2,824,308 possible finishing selections yielded no shorter win. That proof does **not** transfer to v7’s changed word classification or later publications. `node scripts/prove-daily-minimum.ts` reproduces the v6 audit; `node scripts/rate-dailies.ts` refreshes stored difficulty reports. Full analysis stays under DEV data; production imports only `src/daily/difficultyLabels.json`.

## Persistence and completion

| Data | Responsibility |
| --- | --- |
| `DailyPuzzleDefinition` | Immutable, versioned rules/content for a date |
| `DailyRun` | Fixed run mode, undo usage/revision and immutable prior-state stack; enemy-letter/armour states, Lives, board/IDs, refill cursor/next ID, committed words/hits/recoveries/effects, status and finish time |
| `DailyResult` | Mode, intrinsic difficulty, undos used/remaining, permanent completion summary and ordered turn evidence; statistics are derived from results |

Runs use `wyrmle:letter-strike:daily:v1:run:YYYY-MM-DD`; results use the matching `result:` namespace. Former numeric-mode `wyrmle:daily:*` records are preserved untouched, excluded from the new game/statistics, and never reinterpreted as letter-strike saves. Beta puzzle reset and DEV reset/clear affect only the new namespace.

`src/daily/persistence.ts` accepts an injected storage interface. It replays committed attacks against the canonical puzzle and verifies the entire snapshot: letter/armour states, board, Lives, refill position, effects and result totals. Unsupported versions or corruption block the run while preserving the record.

Save schema 5 supports `mode: "normal" | "hard" | "hardcore"`, run revisions, durable undo usage, complete immutable undo snapshots and result assistance/difficulty metadata. Schema 1/2/3/4 records are checked against their exact historical shape and version, then enriched in memory from canonical replay. Schemas 1–3 gain Normal mode; schema 4 retains its recorded Normal/Hard mode. Historical runs gain replayed undo snapshots and zero prior undo usage. This preserves original Hit allowances, vocabulary and LONG behavior. Reads never rewrite original bytes or completion timestamps; continuing an active run writes schema 5 while retaining its committed game version and mode. Completed results remain authoritative. Their recorded difficulty label is preserved if offline rating thresholds are later recalibrated.

Undo restores the complete committed state immediately before the most recent valid word, directly from its snapshot: enemy life/armour, Lives, board tiles and types, IDs, refill cursor/next ID, move history and all semantic, grammar, Hit, Life and Revive consequences. Half-selected words and transient errors are cleared. Each undo consumes one allowance that survives reloads and replaying the same turn. Undo becomes available only after a submitted move and is unavailable after permanent completion. Monotonic revisions reject stale attacks and undos from another tab, including when undo returns the board to an identical position. A failed write consumes no allowance and offers an explicit retry.

Every accepted attack saves before the UI advances. Completion writes the authoritative result before the terminal run snapshot, so an interrupted second write cannot reopen the date. Results reconstruct missing/stale terminal runs; valid terminal runs recover missing results. The first completion stays authoritative. Stale tabs cannot replace it or regress progress, and storage events refresh other tabs.

Selections, errors and intro progress are transient. Refresh restores committed gameplay with letters and tiles revealed. Storage failures offer retry/reload actions. Data stays in this browser, with no accounts/cloud sync; clearing browser storage removes it. Version constants live in `src/daily/versions.ts`.

## Results and statistics

`buildDailyResult(puzzle, game, completedAt, mode, undosUsed)` is pure. It records mode, intrinsic puzzle difficulty, undos used/remaining, outcome/enemy, remaining Lives, words used, total hits, letters removed, armour broken, largest single-turn removal, strongest strike count, Counter/Neutral/Resisted counts, actual Hit activations, Life-tile saves and Revive recovery evidence. The result presents Victory/Defeat with mode, difficulty and undo usage, numeric Lives plus one segment per starting Lives, semantic breakdown and letter/effect totals. Word count is secondary in the optional history. Hit counts only when its tile hits. Life protection counts once per protected turn. Each turn's removal/armour outcomes reflect the final state after recovery; ordered damage and recovery events remain separate. No player score, stars or rankings are invented.

`calculateStats(results, todayId)` derives played, wins, win rate, current/longest winning streaks, average Lives on wins, best Lives, largest turn by hits, total removed letters, Counter/Neutral/Resisted moves, Hit activations, Life-tile saves and armour breaks, plus word-length and different-enemy statistics. Aggregates are not stored. Only the first completion per puzzle counts; future DEV dates are excluded. Streaks follow consecutive UTC dates. Yesterday can sustain a streak while today is unplayed. Completing an earlier run after midnight still belongs to its puzzle date.

The current statistics screen stays combined. Stored modes, intrinsic difficulty and undo usage allow future comparisons across Normal, Hard and Hardcore without changing combat or permitting a second attempt at the same Daily.

## Spoiler-safe sharing

`buildShareText(result)` in `src/daily/share.ts` is pure and independent of the UI. It returns date, mode, outcome, a lives bar and one positional row per submitted word:

```text
WYRMLE 2026-09-25 · NORMAL · VICTORY

LIVES
■□□□□ 1/5

C  ·······■·◐
C  ·■···■■··· ▪
N  ◐·■······■ ◆
C  ···■····■·
N  ■···■·····
```

C/N/R mean Counter/Neutral/Resisted. Each slot is `·` untouched that turn, `◐` armour broken but surviving, `■` removed, `▣` armour broken and removed in the same word, or `↺` recovered by Revive. ▪ means Life and ◆ means Hit triggered. Recovery takes precedence when the same slot is damaged and then healed. A previously broken letter removed on a later turn uses `■`, not `▣`. There is no redundant word count. The result's expandable share preview explains the notation; the copied text omits the legend and all enemy/submitted words, board letters and tile IDs. Clipboard denial provides a selectable fallback.

The engine emits `letterOutcomes` for every original slot on every turn, including before/after hits, armour-break/removal flags and any recovery, from that turn's ordered hit/recovery records. Result turns copy these events. Sharing never guesses the turn history from the final enemy state, and a same-word double hit correctly produces `▣` unless subsequent recovery changes the final outcome.

## Future global ranking boundary

`buildDailyScoreSubmission(result)` in `src/daily/submission.ts` creates a deterministic payload: mode, intrinsic difficulty, undos used/remaining, puzzle/game/puzzle versions, outcome, Lives, turns, total hits, removed letters, armour breaks, semantic sequence, per-turn positional outcomes and recoveries, Life/Hit usage, completion time, and ordered tile IDs for replay. A future submission call can run after successful completion persistence in `useDailyRun.ts`.

A server must resolve the versioned puzzle, replay the evidence and calculate comparison values itself. Client timestamps and totals are not authoritative. No network request, leaderboard or fake ranking is implemented.

## Development comparison and tools

In `npm run dev`, **Settings → Development tools** offers date selection, puzzle reset, history inspection/clear, and real engine win/loss replays. `/?puzzle=2026-09-24` selects a test date. Development controls and date override are absent from production; mode Settings and the separate Beta tools remain available.

Onboarding tools provide **Replay onboarding**, **Launch tutorial directly**, **Reset onboarding flag** (takes effect on reload), and **Preview first-time flow**, plus a jump selector for every tutorial step and buttons for its isolated fixtures. Direct tutorial launch returns to the Daily without changing preferences; first-time preview also leaves preferences and Daily records intact. **Force Normal / Force Hard / Force Hardcore** temporarily overrides presentation only, with **Use run mode** restoring the saved mode. These overrides do not rewrite the run or result mode and disappear on refresh. The DEV undo-count control edits an active run's used allowance within its fixed mode limit. An expandable **Full puzzle difficulty analysis** exposes solver evidence without adding it to production.

**Settings → Development tools → Enemy letter layout → Grid after reveal** previews a larger enemy grid in the Daily and disposable playtests. The intro still decodes the original row; once the wyrm docks, the same letter elements move into up to five columns in reading order. Armour, previews, removed-letter slots and targeting keep their existing identities. The grid uses the space above the definition and shares shorter screens with the playable board. **Row** restores the usual presentation. The setting defaults off, resets on reload, writes no preferences or Daily data, and is unavailable in production.

**DAMAGE MODE** and **LETTER-STRIKE MODE** launch disposable DEV comparisons. Switching or restarting creates a fresh encounter. They never save daily history; **Return to daily game** restores the saved daily. The previous numeric engine remains available through this DEV entry point; its rules and tests are intact.

The current letter-strike fixture is `JOYT / CHER / GLOM / SADE`, with Hit L at row 3 column 2, Life E at row 4 column 4, and armoured M/Y. A verified route is **JOY → CHEER → MELODY → GLAD → MOANER**, using Life E in CHEER and Hit L in MELODY. It deals 2, 3, 3, 2, 2 hits and wins with one life. The [prototype tuning notes](docs/melancholy-prototype.md) include the exact refill sequence, opening outcomes and alternative routes.

**GENERATOR / SOLVER** opens the separate generated-puzzle review browser, also available directly at `/?generator=1`. Its initial review is the published CHAOS v11 encounter, with the same frozen table used by gameplay. New batches start with CHAOS, seed `meaning-review`, a 20-tile initial finite budget and Revive enabled. New candidates carry frozen definition-backed meanings and disable grammar/LONG. Review cards distinguish archived rules, show vocabulary coverage, and let reviewers inspect any stored word’s definition, selected sense and classification reason. The generator API keeps its original padded-supply default unless `refillLimit` is supplied. `npm run generate -- --count 200 --enemy MELANCHOLY` runs a local batch; omit `--enemy` for automatic suitability-based selection. See the [generator guide](docs/generator.md) for APIs, mutation, quality metrics, search limits and JSON export, and the [five-candidate review report](docs/melancholy-generated-review.md) for earlier recorded results. Generation never publishes candidates automatically; dated publications use explicit frozen catalog entries.

The offline pipeline stores Open English Wordnet 2025 senses, definitions, inflected forms and source provenance. Local models assess all **116,395** admitted spellings across six enemy concepts, using all **112,646** distinct applicable source senses. Reviewed concepts supply source-backed reference meanings; model inference also classifies words outside those profiles. `compilePuzzleMeanings` exhausts the definition-backed spelling supply independently of solver budgets and freezes its assessed subset. Preview, submission, word discovery and terminal-state checks use that same table. Validation rejects missing or stale compilations; supply-changing mutations must recompile. See the [offline model guide](docs/offline-semantics.md) for reproducible inference and the [independent benchmark](docs/semantic-benchmark.md) for measured quality and limitations. Older rules remain frozen for archived games.

The olive background is **`#25281f`** in both system colour preferences. Definitions sit within a narrower centered measure and use at least **14px** text; adjective/grammar labels use at least **13px**. Essential resource, tile, selection-order and preview labels use **11–12px or more**. Phone spacing compresses before text or tiles shrink. At 320×568, 375×667 and 375×812, the Daily and both SAD demo steps share exactly the same board geometry (272px, 320.125px and 337.5px widths respectively), with no horizontal or vertical overflow in the checked states. Those board measurements are historical reference checks. The latest preview and spacing pass also fits 375×629 and 320×568 without overflow, with no tile or font reduction. The header has 4px more separation. Installed web apps use `viewport-fit=cover` and standalone safe-area padding, with at least 12px below the action row; a simulated 375×812 notch/home-indicator layout also fits. These are browser checks, not measurements on physical iPhone hardware. Main tile letter sizing is unchanged. Life uses a green square icon and border; Hit uses a blue diamond and border; Revive keeps its red border.

The resource row puts matching 11px **LIVES** and **REFILLS** labels above the segmented wyrm and reserve tiles. Each mini tile has a top-left count and an optically centred letter; all six ANGER groups fit on one line at 320px and 375px. Glyphs use the loaded font's visible ink bounds, with a small upward optical adjustment. Reserve letters scramble and counts show `?` until the wyrm reaches each mini tile; reduced motion uses static placeholders before the immediate reveal. The accessible description exposes the reserve once all its groups have decoded. Glyph positions are cached for the full alphabet so scrambling does not repeatedly measure layout. Resumed games show their reserve immediately. Earlier designs remain under `artifacts/supply-mockups`; those images are historical mockups, not the source of game state. The queue's order remains hidden.

In DEV settings, **MATCH HINT: OFF / DOT / UNDERLINE** compares two subtle blue indications that a tile letter still exists in the enemy. OFF is the default; hints are absent in production, never influence combat, and disappear when the final matching enemy instance dies. DOT leaves more space around the glyph and its special label on the mini viewport. Both alternatives remain available for comparison.

Tap and swipe selection can be mixed in one word: swipe CARE, release, then tap FUL. A swipe adds each crossed tile at most once, including tiles crossed between fast pointer events, and can begin on an already selected tile without removing the prefix. A tap still toggles a tile. Pointer cancellation, leaving the app and board changes end the gesture safely; keyboard and assistive button activation remain supported. Tutorial swipes apply highlighted-letter batches in order.

## Intro and verification

`WyrmDecoder.tsx` uses the selected footless A walk with the original glitch letters and full tile bounce. A single animation clock carries the wyrm from its exact life-meter position through the enemy, then refills, then the board, and back to lives. Each piece follows the same smooth route at its own distance behind the head, with a small body ripple; body squares stay upright and the head turns smoothly. Arrivals trigger individual reveals once, without hiding the wyrm or restarting between stages. The route uses a fixed layout snapshot, so reveal bounces cannot move its targets. Viewport changes or a font reflow finish the intro safely instead of moving its route mid-frame. The moving pieces share the life meter's shapes and dimensions, and settle into its exact measured centers before the static meter reappears. Reduced motion reveals everything quickly without travelling; resumed games show the meter immediately. Route and gait helpers live in `src/intro/tour.ts` and `src/intro/walk.ts`, with regression tests for reveal order, continuity, docking and phone viewport bounds. The interactive studies remain at `artifacts/walking-mockups/index.html`.

The legacy numeric-combat playtest retains its smaller header sprite and body/tongue loops; letter combat uses the shared life-meter shape throughout the intro.

Meaning tests cover frozen-table validity and classification, missing definitions, stale supply metadata, solver cache separation, terminal dictionary exhaustion and archived replay compatibility. Gesture tests cover mixed taps/swipes, crossing order, repeated tiles, cancellation and guided tutorial batching. Engine tests cover exact predicted targets versus submission, dead-slot identity/position, sequential armour hits, duplicate targeting, semantics, LONG/grammar stacking, independent specials, Lives and terminal states. Revive tests include revival, armour gain/cap, duplicate priority, post-strike ordering, invalid moves, preview parity and solver consequences. Daily tests cover versioned frozen content, schema migration, exact undo restoration, durable allowances, fixed modes, stale revisions, failed writes, completion locks, UTC boundaries, result/stat counts, positional share symbols and submission evidence. Difficulty tests compare depth, solution diversity, vocabulary and honest bounded estimates. Tutorial tests cover gated lesson progression, isolation from Daily data, Skip, first-time flow and manual replay. Hint tests check living/dead duplicate letters and their distinction from real predicted hits. Browser verification includes tutorial/Daily phone fit, visible predictions, mode selection, logs, undo and DEV/production separation.
