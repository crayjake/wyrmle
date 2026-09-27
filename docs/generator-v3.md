# Bingo-first generator / validator v3

V3 keeps the counter-first construction method: choose a meaningful enemy/counter pair, derive armour from the bingo's repeated letters, grow a board from counter/similar word pools, and plan deterministic refills. It now rejects boards without a verified difficulty ladder. This is built into `generate:batch`, `generate:daily`, batch rechecking and both daily publication paths; it is not just a one-off audit.

## Run it

```sh
# Recheck the five published September 11–15 benchmarks and the rejected DAYS case.
# Read-only; prints difficulty scores without solution words.
npm run benchmark:v3

# Discover unused enemy/bingo candidates from the reviewed source concept pools.
npm run discover:batch -- --directory artifacts/daily-year-next-v3

# Generate and rank candidates; failed difficulty gates cannot be rescued by a high design score.
npm run generate:batch -- --directory artifacts/daily-year-next-v3 --seeds 12 --limit 20

# Optional: restrict to an enemy present in that directory's candidates.json.
npm run generate:batch -- --directory artifacts/daily-year-next-v3 --enemies TILT --seeds 12 --resume
```

Reports and frozen payloads go into that directory. `accepted: true` means the mechanical, novelty and v3 difficulty gates passed. It does **not** mean the semantic editorial review is complete. Rejected reports retain the difficulty issues when the ordinary-route and novelty prechecks reached v3. Search is bounded; more seeds can help, but no candidate is forced through.

Candidate discovery needs an existing source-pinned concept pool. Supplying an arbitrary new enemy does not invent its meanings or promise a puzzle. The older browser workshop and historical preview exporters remain research tools; use these batch commands for current bingo-first authoring.

## What the gate proves

The score is a reproducible vocabulary proxy:

`word effort = 2 × max(0, 4.5 − Zipf frequency) + 0.6 × max(0, word length − 5)`

A route's effort is its hardest word, **not** the sum. Counting all three words would penalise the easier route simply for having more moves. The frequency data is the existing pinned wordfreq inventory; a missing frequency scores as zero Zipf rather than making the word disappear.

V3 requires all of the following:

1. Every admitted starting bingo is enumerated and replayed. The easiest one determines the bingo threshold, including alternative spellings and shorter answers the author did not nominate.
2. An exhaustive search establishes the cheapest exact two-word win under this score. It includes every admitted spelling, repeated words/families, forms related to the bingo, neutral moves and zero-hit moves used to draw refills. A search-budget cutoff cannot pass as a proven lower bound.
3. A separate, productive two-word route uses distinct non-bingo families and words with Zipf ≥ 2.4. Its hardest word must score at least 0.4 below the easiest bingo. A shortened bingo cannot be the only intermediate challenge.
4. A counter-led three-word route scores at least 0.4 below **even the cheapest legal two-word shortcut**. Every move hits, at least two are counters, the families are distinct and none belongs to a starting bingo. Each word has Zipf ≥ 2.8 and the hardest word scores at most 4.8, so an obscure third word cannot serve as the only evidence of an easy route.
5. The existing gates still require multiple counter openings, at least four replayed counter routes, and counter/similar choices later in the game. All three difficulty witnesses replay in the real game engine with the actual life limit and frozen refills.
6. Known semantic misses also have explicit regression expectations. When a required word is spellable from the puzzle's full letter supply, its frozen relation must match. For STOP, the START, BEGIN, RESTART and RESUME forms must counter it. This rejects neutral fallbacks during generation as well as publication; it does not override labels during gameplay.

Normal copies of a letter are interchangeable for this search; there are no special tiles or grammar bonuses. The exact physical tile IDs for every witness are saved and replayed. Publication decodes the transported asset and recomputes the checks rather than trusting a stored pass flag.

This proves **available routes in the intended order under the score**. It does not promise that every three-word attempt is easier, that every opening can recover, or that every player will find a long familiar word harder than two short words. Recognition, conceptual distance, visual salience and planning are only partly reflected by word frequency and length. Playtesting remains necessary.

## Meaning review and publication

The difficulty gate cannot decide whether an enemy/counter pairing is satisfying. A source link or a clever letter fit is insufficient: DAYS → SHADY passed the old mechanics, but required reading DAYS as daylight. The original asset is retained as a failing benchmark and has been replaced in the calendar.

Before batch publication, put the chosen IDs in `editorial-shortlist.json` and add `editorialReview` and `semanticReview` to each chosen report. The latter has these fields:

- `fingerprint`: the report's progression fingerprint, binding the review to the exact enemy, board, refill supply, rules and frozen meanings.
- `verdict`: `approved` or `rejected`.
- `enemyConcept`: the intended ordinary reading and why the counter concept works against it.
- `bingoConcepts`: an explanation for **every** available starting bingo, keyed by its spelling.
- `routeVocabulary`: a review of the route words' naturalness and meanings, including the third-word finishers.
- `reviewer`: attribution for the editorial review.

The five benchmark proofs provide concrete examples. Changing the board, refills or meaning table invalidates that review. Batch rechecking clears stale review data; publishing rejects absent, rejected or stale reviews. The legacy month publisher also enforces v3 at publication.

```sh
# Recompile shortlisted candidates, rerun v3 and invalidate stale reviews.
npm run recheck:batch -- --directory artifacts/daily-year-next-v3

# After reviewing the surviving reports, append a reviewed batch.
# The existing publisher moves five random samples into the archive;
# this example needs at least 20 distinct approved puzzles.
npm run generate:batch -- --directory artifacts/daily-year-next-v3 --publish-only --days 20
```

This review is a scoped editorial check, not a claim that every admitted dictionary word has perfect contextual semantics. Unlabelled source-defined words still follow the frozen neutral policy. A generator cannot guarantee zero semantic misses from these benchmarks alone.

## Benchmark results

The calendar's September 11–15 cases are STOP, SOIL, TRUST, HIDE and DIM. SOIL, HIDE and DIM retain their exact assets. TRUST replaces DAYS on September 13. STOP retains its board, armour, refills and bingo, with corrected START and RESTART meanings. Previous assets remain available to the revision-backup mechanism; their saved results are backed up rather than applied to changed rules.

Lower scores mean easier vocabulary under the proxy. The two-word lower bound includes shortcuts that are excluded from the separately provided ordinary route.

| Date | Enemy | Three-word route | Any two-word win, lower bound | Independent two-word route | Easiest bingo |
| --- | --- | ---: | ---: | ---: | ---: |
| Sep 11 | STOP | 0.60 | 1.80 | 1.80 | 5.42 |
| Sep 12 | SOIL | 4.56 | 5.52 | 5.96 | 7.60 |
| Sep 13 | TRUST | 1.70 | 3.42 | 3.42 | 7.02 |
| Sep 14 | HIDE | 0.60 | 2.22 | 2.22 | 3.68 |
| Sep 15 | DIM | 2.24 | 2.88 | 2.88 | 5.60 |

The [benchmark artifacts](../artifacts/daily-year-v3-benchmarks-2026-09-27/README.md) contain **solution spoilers**, original/current asset identities, exact witnesses and editorial reviews. `npm run benchmark:v3 -- --publish` is the idempotent, narrowly scoped publisher for this reviewed five-date revision; it validates all cases before changing catalogs. Future daily batches use the commands above.
