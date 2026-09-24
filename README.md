# WYRMLE

A local, daily word-versus-concept game. Click to begin the existing enemy/tile decode sequence, then select any tiles in word order (adjacency is not required). Clear resets the selection; Attack submits the actual tile IDs. Invalid words do not consume tiles or Resolve. Refreshing resumes committed gameplay, and a win or loss permanently completes that date in this browser. The existing battle UI and combat rules are retained.

## Run and verify

```sh
npm install
npm run dev
npm test
npm run build
npm run lint
```

Tests use Node's built-in TypeScript support; use Node 22.18+ or a newer supported release. Word validation uses the same bundled `an-array-of-english-words` dictionary as the old project. Gameplay makes no API requests and requires no LLM.

## Daily puzzle flow

A game day runs from **00:00:00 UTC to the next midnight UTC**, everywhere. `getDailyPuzzleId(date)` returns `YYYY-MM-DD` from the instant's UTC date. Strict validation rejects malformed IDs and impossible dates rather than letting JavaScript normalize them. No local-time parsing or daylight-saving arithmetic is used.

```text
UTC date → immutable puzzle definition → saved completion / saved run / canonical start
                                             ↓
                              select tiles → submit → save committed turn
                                             ↓
                                  won/lost → permanent result
                                             ↓
                              result panel / share / derived statistics
```

`src/daily/puzzle.ts` creates a deeply frozen definition, independent of player history. `catalog.ts` is a literal v1 snapshot, including the enemy definition and semantic lists, 16 tile identities, Resolve, refill queue, and every encounter rule. It deliberately does not import mutable prototype rules. **The repository currently contains one authored encounter, so MELANCHOLY repeats across dates.** Dates have independent attempts; no generator, board shuffle, or new encounter content was added in this phase. Add future authored puzzles with explicit effective dates, keeping every already published date assignment intact.

On opening, a saved attempt/result for today takes priority; otherwise the latest unfinished past day is resumed. While a tab remains open across midnight, it keeps that run and offers **Play today**. The History menu also offers recent unfinished days. Beginning today's puzzle does not delete a past run. Intro progress, animation timers, tile selection, and validation errors are transient; a restored run reveals the board immediately.

## Persistence and result history

Three separate data structures have distinct responsibilities:

| Data | Source | Contents |
| --- | --- | --- |
| `DailyPuzzleDefinition` | Immutable code catalog, resolved by date | ID/date, game/puzzle versions, canonical encounter |
| `DailyRun` | `wyrmle:daily:run:YYYY-MM-DD` in local storage | Save/game/puzzle versions, HP, Resolve, exact board and tile IDs, refill cursor/next ID, committed turn history including used special tiles, status, finish time |
| `DailyResult` | `wyrmle:daily:result:YYYY-MM-DD` in local storage | Versioned result envelope; outcome, enemy, starting/remaining Resolve, attacks and words, damage, semantic/special counts, compact per-turn evidence, finish time |

The browser adapter in `src/daily/persistence.ts` takes an injected storage interface; the combat engine has no browser or storage dependency. It replays ordered tile IDs against the canonical puzzle before accepting stored HP, board, refill position, effects, and results. Unknown versions or corrupt records block that run and preserve the original data instead of silently starting over. There is no migration framework.

Each accepted attack is saved synchronously before the UI advances. A result is written **before** its terminal run snapshot; an interrupted second write cannot reopen the completed date. A valid result can reconstruct the terminal board even if the run is missing or stale. A valid terminal run can recover a missing result. The first stored completion remains authoritative, and stale tabs cannot replace it or regress a newer active history. The UI listens for storage changes from other tabs. Storage denial/quota failures are visible, with retry and reload options.

Local storage is browser-specific and user-clearable; there are no accounts, gameplay API requests, cloud saves, or anti-cheat guarantees. `GAME_VERSION`, `PUZZLE_VERSION`, and `SAVE_VERSION` are explicit in `src/daily/versions.ts`. Rule/format changes require deliberate version updates and retention of old published definitions or an explicit unsupported-version state.

## Results, statistics and sharing

`buildDailyResult(puzzle, game, completedAt)` captures a completed run without consulting the clock itself. Total damage means the sum of scored attacks, including overkill. Opposites count as counters; similar and related words count as resisted; unrelated words count as neutral. Triggered special identities and Resolve protection are recorded per turn. No score, stars, perfect rating, or maximum-damage solver has been invented.

`calculateStats(results, todayId)` derives played/wins/win rate, current and longest streaks, average remaining Resolve on wins, average word length, longest word, counter/resisted hits, special usage, and different defeated enemy concepts. It never persists aggregate counters. One first completion per puzzle counts; future development dates are excluded. Current streak can end yesterday while today is unfinished/unplayed; a loss today, any prior loss, or any skipped UTC day breaks it. Longest streak also uses consecutive calendar days. Completing yesterday's run after midnight still belongs to yesterday's puzzle date.

`getDailyHistory(puzzles, results, inProgressIds)` projects requested dates into unplayed/in-progress/won/lost entries with Resolve quality and basic stats. Unplayed entries hide the enemy. The existing History button opens a compact statistics/recent-days panel; no calendar archive is built.

The result panel shows Resolve, attacks, strongest hit, counters, special effects, and an optional list of submitted words. `buildShareText(result)` produces only the date, outcome, Resolve, attack count, and abstract turn symbols: 🟩 counter, ⬜ neutral, 🟨 resisted, ✦ special, ◇ Resolve protected. It includes no submitted words, enemy identity/definition, tile IDs, or damage numbers. Clipboard failures expose selectable text for manual copying.

## Future ranking boundary

`buildDailyScoreSubmission(result)` in `src/daily/submission.ts` deterministically produces `DailyScoreSubmission`: puzzle ID, game/puzzle versions, won, remaining Resolve, turns used, total damage, and completion timestamp. It is separate from local display history, performs no networking, and adds no scoring rules.

A future `submitResult(summary, evidence)` can be called after persistence commits a completion in `useDailyRun.ts`; `result.turns.map(turn => turn.tileIds)` provides ordered replay evidence. A server must resolve the published puzzle, replay the moves, recompute outcomes, and use its own timing/receipt policy rather than trusting the client's clock or totals. `getGlobalRank(...)` can then supply an additional result-panel field. No leaderboard or submission service is implemented now.

## Development tools

In `npm run dev`, open the header's Development tools button or load `/?puzzle=2026-09-24`. The date input accepts any valid daily ID. Tools can reset just the current date, clear Wyrmle history/runs without touching unrelated application storage, inspect JSON, and replace the current attempt with a real canonical win/loss replay. Test outcomes use the normal engine and persistence checks. Development dates use the same local namespace; clear test history when finished.

The tool panel is dynamically imported only under `import.meta.env.DEV`; the date override and reset controls are absent from production. Opening a different date in development must never change that date's canonical puzzle.

Daily tests cover deterministic identity/definitions, UTC boundaries and invalid dates, exact resume, completion locks and partial-write recovery, corrupt/unsupported saves, stale tabs, date isolation, canonical reset, history/stats and both streaks, spoiler-free sharing, and deterministic future submissions.

## DEV combat comparison

Open **Development tools → DAMAGE MODE / LETTER-STRIKE MODE** to play disposable encounters. The daily damage game remains the default. Inside a playtest, the mode label or settings button opens the switcher; switching either mode starts fresh, and **Restart** repeats that mode. **Return to daily game** restores the saved daily attempt. Playtests never write runs, results, statistics, or a mode preference. The experiment and its solver are lazy-loaded only in development and excluded from production builds.

Letter-strike mode uses independent enemy-letter identities, with two-hit armour on M and Y. Counters strike with every matching selected tile; neutral words strike with the first eligible tile in spelling order; resisted words have no normal strikes. Related words count as neutral. A Strike tile guarantees its own matching hit but never doubles its normal hit. Ward makes a valid turn cost zero Resolve; otherwise it costs one. Matching finishes wounded armoured copies first, then follows left-to-right order. Distinct submitted tiles may hit the same armoured copy once each. Removed letters retain their slots, and clearing the final letter wins even on the last Resolve.

The preview and submission share `src/experimental/letterStrike.ts`. `maxStrikes.ts` searches legal words from the existing dictionary and accounts for actual special-tile identities to determine the charge bar's maximum immediate strikes. This is an immediate-turn comparison, not a strategy recommendation. Grammar damage modifiers do not apply in this mode. Recent and full playtest logs show strikes, semantic results, and selected special effects.

The fixed board is `JOYC / HEER / GLOO / MADS`, with Ward Y and Strike L. One verified six-attack route is **JOY → MERRY → CHEER → ELATED → MOLD → NAG**: preserve the original Strike L for MOLD and use the normal L in ELATED. It deals 2, 3, 2, 2, 2, 1 strikes and wins at zero Resolve. The deterministic queue is deliberately authored for testing, not yet balanced.

Experimental tests cover matching order, identity, semantic categories, special effects, armour, duplicate targeting, terminal rules, preview/submission agreement, a full winning replay, and exact maximum-strike results against exhaustive small-board selections. To remove the experiment, delete `src/experimental/` and its two test files, remove the DEV entry points from App/DevPanel, and remove the optional presentation props; numeric combat and daily persistence remain independent.

## Wordwyrm intro

`src/components/WyrmDecoder.tsx` controls the CSS snake's intro route. It follows a continuous sine wave centered vertically on the enemy letters, revealing them as it passes, then leaves the screen and re-enters beside the board. After decoding the tiles, it exits again and re-enters at the title, passing through WYRMLE left-to-right before resting beside it. Completion callbacks preserve the `waiting → enemy → tiles → ready` phases; gameplay stays disabled until the intro finishes. Travel reads actual element bounds to follow resizing. `WyrmCharacter.tsx` provides its body wave, head bob, and occasional tongue flick, with slower idle motion in the header. Reduced motion skips travel, reveals both stages quickly, and keeps the header snake still.

`src/intro/paths.ts` defines board visitation without changing gameplay tiles. The default follows alternating rows with rounded turns and a slower sine wave through each row; optional `'shuffle'` mode still uses a stable seed. `src/intro/movement.ts` defines centered sine movement, curved row turns, and head direction along the route. `WyrmDecoder` accepts `tilePath` and `seed` props for future puzzles. All intro durations, wave sizes, scramble intervals, and idle timing are in `src/intro/config.ts`; the full reveal and title pass take about eight seconds.

## Encounter HUD

Enemy information stays attached to the object it describes. `Enemy.tsx` keeps the individually decoded letter cells and definition together, with grammatical matchups directly beneath the definition. `getActiveGrammarModifiers` supplies the actual encounter's nonzero grammar effects: positive values are green, negative values red, and labels use the normal foreground. There is no separate ENCOUNTER or BOARD panel.

`EncounterHud.tsx` shows only RECENT: the two latest submitted attacks, newest first, with word, damage, semantic outcome, and any triggered special effects. It renders nothing before the first attack. `getRecentBattleEvents` reads submission snapshots so previewing a new word cannot alter the history. The enemy, definition, grammar matchups and history remain one group centered in the available upper area, separated from the current move by the existing subtle rule.

Special tiles carry their own small POWER or WARD label and symbol. `TileGrid` matches each actual gem's identity to `getCurrentTileSummary` metadata; labels, symbols, and effect tooltips come from the engine's configured summary, without duplicating effect rules in the UI. Labels appear with the existing tile reveal and disappear when a used gem is refilled as a normal tile. The main letter, tile sizing, selection, and decoding animations are unchanged. Active modifiers for the word being built remain in `AttackInfo` below the current word. No presentation variants or comparison selectors are exposed.

## Pure engine

`src/game/` has no React or browser dependencies. Call `createGame(encounter)`, `toggleTile(state, tileId)`, `clearSelection(state)`, `previewAttack(state, selectedTileIds)`, and `submitWord(state, selectedTileIds)`. Functions return new state; selection order defines the word. Preview and submission use the same damage calculation. The tile-ID interface also supports future non-UI callers.

Reused and refactored from `../bookworm-game/src/game/`: numeric tile IDs, tile-attached gem effects, ordered selection/word construction, bundled dictionary lookup, immutable transitions, board-position refill with fresh IDs, successful attack history, preview structure, and win-before-loss resolution. The old test patterns for selection, deterministic replay, immutability, preview agreement, and distinct same-letter gems were adapted too. No old UI components, CSS, or assets were copied.

Creature encounters, tile locking, generic creature hooks, Sapphire damage, length/double-letter bonuses, and the separate `turnsRemaining` model were removed. Enemy concepts and configurable scoring data replace those assumptions. Repeated words remain legal when the board contains the necessary actual tiles.

## Rules and data

- `src/game/encounters.ts`: MELANCHOLY's definition, noun POS, 33 HP, handcrafted semantic groups, starting Resolve, 4×4 board, and deterministic refill queue. `rules` holds tunable scoring amounts and the grammar toggle.
- `src/game/rules.ts`: default semantic, grammar, and special-tile numbers. Each encounter can override these through its `rules` object.
- `src/game/semantic.ts`: exact, case-insensitive group matching and the semantic modifier. Unknown words are unrelated; no inferred semantic similarity.
- `src/game/grammar.ts`: optional +2 adjective→noun, adverb→verb, and adverb→adjective bonuses. Unknown or ambiguous POS data earns no grammar bonus.
- `src/game/dictionary.ts`: local word validity and a deliberately small, inspectable POS lexicon. Missing POS does not invalidate a dictionary word.
- `src/game/tiles.ts`: actual tile identities, Ward/Power effects, and deterministic consumption/refill. Effects are configured by the encounter's rules.
- `src/game/damage.ts`: word-length base damage → semantic adjustment (minimum 1) → optional grammar → tile bonuses. Preview includes the component amounts, effects, Resolve cost, and display bonuses.
- `src/game/game.ts`: validation, selections, attack submission, and terminal states.

`playerResolve` is the only remaining-turns/player-health resource. A valid attack normally costs exactly 1; including a Ward tile makes its cost 0. Multiple Wards do not heal. Each Power tile adds 3 damage. Enemy defeat is checked before Resolve exhaustion, so a lethal final attack wins. The result panel's attack count is derived from history; the battle HUD shows only the two health resources.

The refill queue is consumed in board-position order, regardless of selection order, and never wraps or randomizes. New tiles have fresh IDs and no special effect. Encounter creation validates enough refill capacity for the starting Resolve plus possible Ward turns.

## Prototype examples

| Word | Damage | Resolve cost |
| --- | --- | --- |
| JOY with Ward Y | 3 + 5 counter = **8** | **0** |
| CHEER with Power E | 5 + 5 counter + 3 Power = **13** | **1** |
| SAD | max(1, 3 − 3 similar) + 2 adjective = **3** | **1** |
| GLOOM | 5 − 3 similar = **2** | **1** |

Grammar is enabled for numeric damage mode. Setting `rules.grammar.enabled` to `false` makes SAD deal 1; its semantic resistance is applied before the grammatical bonus. JOY is stronger than the longer GLOOM. The queue supports the complete route **JOY → CHEER → HAPPY** (8 + 13 + 12 damage), ending in victory with 3 Resolve.

## Add another encounter

For engine experiments, add a plain `Encounter` object in `src/game/encounters.ts` with an enemy word, definition, POS, maximum HP, and explicit `similar`, `opposite`, and `related` word lists. Supply starting Resolve, 16 tiles with unique numeric IDs, an ample uppercase refill string, and scoring rules. Set a tile's `type: 'gem'` and `gem: 'ward'` or `'power'` to give that tile an effect. Add only confidently known POS entries to the small lexicon as needed. Daily publication is a separate step: add an immutable catalog entry and an explicit date assignment in `src/daily/`, preserving existing dates and versioning rule changes. The battle components read the selected daily encounter automatically.
