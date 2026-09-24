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

## Letter-strike rules

- A valid word normally costs one Resolve. Invalid words spend nothing.
- **COUNTER:** every selected tile with an eligible same-letter target strikes.
- **NEUTRAL:** one normal matching strike, in spelling order. Related words are neutral.
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

The action area contains the selected word, semantic category, applied grammar and triggered Strike/Ward effects, followed by tiles and actions. Exact predicted outcomes appear on the enemy cells; neither the current word nor the Attack button duplicates them with a strike count. Normal play has no numeric enemy HP, DMG, charge bar, WORD/READY labels, player-area divider, or permanent recent-history panel. Validation, decode and terminal messages remain available.

The header's **Log** opens every submitted turn, newest first: strikes, semantic outcome, applied grammar, triggered effects, removed letters and armour breaks. Statistics are available from the Log and result screen. The definition stays attached to the enemy, with compact grammar labels underneath separated by dots, matching the current move's modifiers. Actual weaknesses are green and resistances red; neutral types are omitted. Exact allowances remain in accessible text and hover descriptions. Tile labels and explanations use the actual board and configured effects through `letterStrikeHud.ts`.

## Daily puzzle definition

Daily IDs are strictly validated UTC dates, `YYYY-MM-DD`, from `getDailyPuzzleId(date)`. Days change at midnight UTC, independent of timezone or daylight saving.

`src/daily/catalog.ts` contains the published encounter. `getDailyPuzzle(id)` returns a deeply frozen definition containing date/ID, game/puzzle versions, enemy word/definition, semantic groups, enemy letter identities/armour, starting Resolve, exact board/special tiles, refill queue and rules. The literal catalog is independent of mutable DEV encounter defaults.

**There is currently one authored encounter, MELANCHOLY, so it repeats across dates.** Each date has its own attempt and result. Add further encounters with explicit date assignments while preserving every previously published definition; content is never random or player-dependent.

Dates **2026-09-25 UTC onward** use `letter-strike-3` / puzzle version 3: `ADJECTIVE +1 STRIKE` and Strike tiles that preserve normal allowances. Earlier published dates retain their v1 rules. Saved v2 attempts with committed turns retain their original grammar and overlapping Strike rules; their outcomes and completion timestamps do not change. A v2 run with no committed turns can open under v3, with its original bytes kept until the first new commit. DEV letter-strike playtests use the current rules immediately. Old future-date DEV v1 records that disagree with the publication boundary remain unsupported and preserved; DEV reset is explicit.

Today's saved run/result takes opening priority; otherwise the latest unfinished earlier daily can resume. A tab crossing midnight keeps its attempt and offers **Play today**. Statistics also offers unfinished earlier dates. Starting a date does not delete earlier runs.

## Persistence and completion

| Data | Responsibility |
| --- | --- |
| `DailyPuzzleDefinition` | Immutable, versioned rules/content for a date |
| `DailyRun` | Enemy-letter/armour states, Resolve, board/IDs, refill cursor/next ID, committed words/hits/effects, status and finish time |
| `DailyResult` | Permanent completion summary and ordered turn evidence; statistics are derived from results |

Runs use `wyrmle:letter-strike:daily:v1:run:YYYY-MM-DD`; results use the matching `result:` namespace. Former numeric-mode `wyrmle:daily:*` records are preserved untouched, excluded from the new game/statistics, and never reinterpreted as letter-strike saves. DEV reset/clear affects only the new namespace.

`src/daily/persistence.ts` accepts an injected storage interface. It replays committed attacks against the canonical puzzle and verifies the entire snapshot: letter/armour states, board, Resolve, refill position, effects and result totals. Unsupported versions or corruption block the run while preserving the record.

Save schema 2 adds explicit positional outcomes. Valid schema 1 records for v1 dates are checked against their exact historical shape, then enriched in memory from canonical replay. Rules are pinned to the saved game/puzzle version for committed v1/v2 attempts, including their original Strike allowance behaviour. Reads never rewrite original bytes or completion timestamps; continuing an active run writes schema 2. Completed results remain authoritative and can display the new share format without replaying the puzzle.

Every accepted attack saves before the UI advances. Completion writes the authoritative result before the terminal run snapshot, so an interrupted second write cannot reopen the date. Results reconstruct missing/stale terminal runs; valid terminal runs recover missing results. The first completion stays authoritative. Stale tabs cannot replace it or regress progress, and storage events refresh other tabs.

Selections, errors and intro progress are transient. Refresh restores committed gameplay with letters and tiles revealed. Storage failures offer retry/reload actions. Data stays in this browser, with no accounts/cloud sync; clearing browser storage removes it. Version constants live in `src/daily/versions.ts`.

## Results and statistics

`buildDailyResult(puzzle, game, completedAt)` is pure. It records outcome/enemy, remaining Resolve, words used, total strikes, letters removed, armour broken, largest single-turn removal, strongest strike count, Counter/Neutral/Resisted counts, actual Strike activations and Ward saves. The result presents Victory/Defeat, numeric Resolve plus one segment per starting Resolve, semantic breakdown and letter/effect totals. Word count is secondary in the optional history. Strike counts only when its tile hits. Ward counts once per protected turn. Armour is counted once per armoured letter. No score, stars or rankings are invented.

`calculateStats(results, todayId)` derives played, wins, win rate, current/longest winning streaks, average Resolve on wins, best Resolve, largest turn by strikes, total removed letters, Counter/Neutral/Resisted moves, Strike activations, Ward saves and armour breaks, plus word-length and different-enemy statistics. Aggregates are not stored. Only the first completion per puzzle counts; future DEV dates are excluded. Streaks follow consecutive UTC dates. Yesterday can sustain a streak while today is unplayed. Completing an earlier run after midnight still belongs to its puzzle date.

## Spoiler-safe sharing

`buildShareText(result)` in `src/daily/share.ts` is pure and independent of the UI. It returns date, outcome, a Resolve bar and one positional row per submitted word:

```text
WYRMLE 2026-09-25 · VICTORY

RESOLVE
□□□□□ 0/5

C  ·······■·◐ ◇
C  ◐■·······■
C  ·····■■···
C  ··■■······
N  ■·······■· ◆
N  ····■·····
```

C/N/R mean Counter/Neutral/Resisted. Each slot is `·` untouched that turn, `◐` armour broken but surviving, `■` removed, or `▣` armour broken and removed in the same word. ◇ means Ward and ◆ means Strike triggered. A previously broken letter removed on a later turn uses `■`, not `▣`. There is no redundant word count. The result's expandable share preview explains the notation; the copied text omits the legend and all enemy/submitted words, board letters and tile IDs. Clipboard denial provides a selectable fallback.

The engine emits `letterOutcomes` for every original slot on every turn, including before/after hits and armour-break/removal flags, from that turn's ordered hit records. Result turns copy these events. Sharing never guesses the turn history from the final enemy state, and a same-word double hit correctly produces `▣`.

## Future global ranking boundary

`buildDailyScoreSubmission(result)` in `src/daily/submission.ts` creates a deterministic payload: puzzle/game/puzzle versions, outcome, Resolve, turns, total strikes, removed letters, armour breaks, semantic sequence, per-turn positional outcomes, Ward/Strike usage, completion time, and ordered tile IDs for replay. A future submission call can run after successful completion persistence in `useDailyRun.ts`.

A server must resolve the versioned puzzle, replay the evidence and calculate comparison values itself. Client timestamps and totals are not authoritative. No network request, leaderboard or fake ranking is implemented.

## Development comparison and tools

In `npm run dev`, settings offers date selection, puzzle reset, history inspection/clear, and real engine win/loss replays. `/?puzzle=2026-09-24` selects a test date. Controls and date override are absent from production.

**DAMAGE MODE** and **LETTER-STRIKE MODE** launch disposable DEV comparisons. Switching or restarting creates a fresh encounter. They never save daily history; **Return to daily game** restores the saved daily. The previous numeric engine remains available through this DEV entry point; its rules and tests are intact.

The letter-strike fixture is `JOYC / HEER / GLOO / MADS`, with Ward Y, Strike L and armoured M/Y. A verified route is **JOY → MERRY → CHEER → ELATED → MOLD → NAG**; preserve the original Strike L for MOLD and use normal L in ELATED. It deals 2, 3, 2, 2, 2, 1 strikes and wins at zero Resolve. This is authored test content, not a generated or balanced catalog.

## Intro and verification

`WyrmDecoder.tsx` keeps the `waiting → enemy → tiles → ready` sequence and measures actual element bounds while moving. Enemy cells decode first, tiles follow the alternating-row route, and the wyrm returns through the title. Reduced motion reveals both stages quickly. Paths, timings, tile dimensions, fonts and palette are unchanged.

Engine tests cover exact predicted targets versus submission, dead-slot identity/position, sequential armour hits, duplicate targeting, semantics, grammar, specials, Resolve and terminal states. Daily tests cover versioned frozen content, old/new exact restore, tampering, completion locks/partial writes, stale tabs, UTC boundaries, result/stat counts, all positional share symbols/row counts/Resolve bars and submission evidence. Browser checks cover red/blue targets, borderless dot centering and stable geometry, ordered armour animation, phone fit, old/new reloads, logs, share preview/fallback and DEV/production separation.
