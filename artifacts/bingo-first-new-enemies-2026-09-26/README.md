# Five new bingo-first beta puzzles

Open **Settings → Beta puzzles → Five new puzzles**. The new set uses **ARID, ROT, INERT, STINGY and FALSE**, each with a different intended bingo. Earlier variants remain in their own tab.

After deployment: [beta picker](https://crayjake.github.io/wyrmle/?preview=bingos). Locally: [beta picker](http://localhost:5173/?preview=bingos). Direct queries are `?preview=bingo-arid-1`, `?preview=bingo-rot-1`, `?preview=bingo-inert-1`, `?preview=bingo-stingy-1` and `?preview=bingo-false-1`. Three lives is the default; append `&lives=4` or `&lives=5` to compare budgets.

Every preview, including the original and earlier variants, has **Hints** above the board. It shows one clue at a time, from an indirect meaning clue to a more specific third clue. Only after the third clue does **Reveal answer** appear. Closing the panel preserves the current clue; restarting resets it. Revealing does not play the answer or affect daily progress.

## Built-in generation

This is a reproducible implementation of the proposed bingo-first method, not five hand-written boards:

```sh
# Compare twelve deterministic candidates for each supported enemy; write reports.
npm run generate:bingo -- --seeds 12

# Generate, validate and export the same selection into the beta picker.
npm run generate:bingo -- --seeds 12 --export

# Investigate a supported enemy with a larger search budget.
npm run generate:bingo -- --enemies STINGY --seeds 24 --output artifacts/stingy-study
```

1. Start with reviewed opposite/similar senses for each enemy in `scripts/bingo/profiles.json`. Inventory opposite words that cover every enemy letter. The profile selects an intended bingo and its three clues.
2. Reserve that bingo's exact letter multiset. Its extra copies of enemy letters supply armour, up to two hits per enemy position. All five examples have at least two armoured positions.
3. Explore combinations of counter and resisted words sharing those letters. Keep a beam of 48 combinations before selecting the spare letters, rather than letting one initial bait consume all the spare slots. Fill a sixteen-tile board; ordinary dictionary words provide the neutral pool.
4. Propose 24 finite refill letters with the existing forward planner, favouring later counter and resisted options. The bingo family cannot serve as the planned ordinary solution.
5. Evaluate the actual frozen meanings and engine through three turns. Sample familiar counter, resisted and neutral openings; search for winning continuations. Exclude **all initial bingo lemmas** and **repeated lemmas within a route**, so replaying a bingo plural or repeating a counter cannot inflate the ordinary-route score.
6. Export only candidates with at least four starting counter families, four winning routes using at least two different counter lemmas, two resisted opening families, two positions with counter/resisted choices after the first move, and two such positions after the second move. Prefer more routes and penalize one-counter/two-neutral cleanup.
7. Pack/unpack the frozen meaning table and replay every reported win at 3, 4 and 5 lives before export. Profiles have content fingerprints; changes require regenerating the frozen data.

The JSON reports record the selected seed, anchors, board, refills, bingo inventory, source derivations, candidate scores and actual tile-ID witnesses. They contain spoilers. The selection is the best **of the tested candidates**, not a proof of global optimality or that every possible opening remains winnable.

## Selected set

These are the twelve-seed results. Starting counter counts are sampled and capped at twelve. Ordinary wins exclude bingo lemmas and repeated lemmas. A later position counts only if it offers several counter choices and resisted bait; these counts concern sampled routes, not all reachable boards.

| Enemy | Enemy hits | Starting counter families | Ordinary winning openings | Mixed positions after first / second word | Counter + two neutral cleanup openings |
| --- | ---: | ---: | ---: | ---: | ---: |
| ARID | 6 | 12 | 16 | 18 / 8 | 0 |
| ROT | 6 | 11 | 12 | 13 / 2 | 1 |
| INERT | 8 | 12 | 16 | 18 / 10 | 0 |
| STINGY | 9 | 5 | 5 | 7 / 5 | 0 |
| FALSE | 7 | 12 | 16 | 17 / 9 | 0 |

STINGY is the tighter puzzle: its long bingo leaves four free tiles, and its ordinary routes must remove nine hits in three moves. The spare-letter search finds several counter families without reducing the armour or weakening acceptance criteria. ROT retains one tested counter/two-neutral cleanup; it is penalized rather than claimed absent. No puzzle can be won by three ordinary one-hit neutral moves from full health.

## Semantics and limits

These are **source-reviewed drafts**, not certified dailies. They use the local Open English Wordnet 2025 evidence: exact pinned senses, their synonym sets, one direct derivation, and explicit adjective/adverb links. Derivations that change the relevant meaning are excluded. Word forms retain supported senses; the FALSE profile also excludes the erroneous entry-wide link from LAY/LAIN to lying about the truth. LIED remains resisted.

Every admitted supply-spellable word has a definition and a stored decision. Words without a matching reviewed counter/reinforcing sense are neutral **under this beta policy**; having a complete table does not prove that every contextual relation has been caught. The existing model cache covers the older enemy set and is not being passed off as coverage of these new enemies. Full contextual review and daily publication certification are still outstanding. No zero-miss guarantee is made.

To add an arbitrary new enemy, first add and review its source profile and bingo; the command deliberately rejects enemies with no profile. It does not silently turn missing model evidence into certified neutrality.

## Why prefer this method here?

The general generator begins with vocabulary/board proposals and scores the resulting play. That is more flexible when a bingo is optional. Bingo-first reserves a meaningful one-word win before spending the free letters, which makes armour and the hidden answer deliberate design choices. Its difficulty moves into the remaining slots and the refill branches: a valid bingo alone says little about the ordinary game.

For these three-life bingo puzzles, prefer bingo-first **plus the real engine and branching validation**. Both methods still need semantic review and play testing. Four or five lives preserve the same verified wins but give more recovery room and can make neutral cleanup easier; this batch is designed and gated at three lives.

## Verification

```sh
node --test --test-isolation=none tests/bingo-preview.test.ts tests/bingo-catalog.test.ts tests/bingo-new-set.test.ts
npm run typecheck
npm run lint
VITE_BASE_PATH=/wyrmle/ npm run build
```

The tests replay the original and earlier previews, all five new bingos, all recorded new ordinary routes at each supported life count, all sixteen hint answers, source pins, profile fingerprints and selected semantic/inflection regressions. Browser results are recorded in `browser-check.json`; those checks cover phone portrait/landscape layouts, both picker tabs, each hint and reveal stage, restarts, bingo wins, navigation and daily-storage isolation. Chromium checks are not an iOS Safari test.
