# Fresh daily queue: 27 September–16 October 2026

Replaces exactly these twenty dates. The ten earlier archive dates, 26 September,
and 17–25 October retain their existing assets and guides. Today's replacement
enemy is **IGNITE**. Puzzle selection remains in the calendar; no beta UI returns.

All twenty enemies are new to the recorded published history. No starting letter
multiset or winning bingo lemma repeats an archived, retired-preview, or previously
queued puzzle. This also checks alternative starting bingos, not only the answer
chosen for the hints. A new tile order or refill queue alone is not considered new.

## Generation and validation

These use the bingo-first constructor, with pinned candidates in
`scripts/bingo/freshProfiles.json`. No board was manually assembled. Each candidate
starts with its counter answer, derives enemy armour from those letters, searches
for counter/resisted word anchors, and constructs and evaluates finite refills.

```sh
# Generate candidates without changing the site (fresh is now the default set).
npm run generate:daily -- --set fresh --start 2026-09-27 --days 20 --seeds 12

# Resume verified authoring payloads and publish an as-yet-unpublished selection.
npm run generate:daily -- --set fresh --start 2026-09-27 --days 20 --seeds 12 --resume --publish

# Validate the committed selection without regenerating or publishing it.
node --test --test-isolation=none tests/daily-refresh.test.ts tests/daily-schedule.test.ts tests/bingo-freshness.test.ts
```

The first search used two seeds. Five candidates needed a twelve-seed search.
Two cramped candidates still failed the unchanged quality requirements; their
pairings were replaced and searched again. The rejected CAGE/EMANCIPATING and
IGNITE/EXTINGUISHED reports remain as diagnostics and are not scheduled.

The published boards have **4–12 starting counter families**, **6–17 replayed wins
using multiple different counter families**, at least two resisted starting
families, and at least two later and final positions retaining counter/resisted
choices. Every puzzle has a verified bingo, an ordinary two-word win, and
three-move witnesses. Ordinary witnesses exclude all starting bingo lemmas and
never repeat a lemma. Every enemy needs more than three hits, so neutral-only
three-word wins are impossible. There are sixteen ordinary tiles, twenty-four
finite refills, and no special tiles.

The report referenced by each schedule entry contains the exact seed, semantic
roots, all sampled route witnesses, two-word proof and novelty result. The packed
public asset is immutable and content addressed. Publication merges the requested
date window instead of overwriting the entire schedule.

`scripts/bingo/published-history.json` remembers retired previews and replaced
queue entries as well as the active puzzles. Generation refuses to republish used
bingo families or letter pools; publishing another new batch requires fresh pinned
candidates. The history gate is intentional, including when rerunning the old
month's command. `--set classic` is available for investigating those older profiles.

New semantic themes use explicitly selected source senses, synonyms, inflections
and adjective-to-adverb links; unreviewed derivation edges are excluded. Existing
themes retain their reviewed roots and exclusions. Tests cover misleading
homographs such as CONSOLE, BROKE, FIREMAN and JITTERS. These are source-backed
game judgements, not a proof of error-free interpretation in every context.

## Saves and loading

Before replacing a date's saved board, the app keeps its complete record under
`wyrmle:daily:revision:v1:<date>:<asset>`. The original assets remain available,
and opening that asset through the progress module can replay its saved moves.
New boards start with their own attempts, hints, stars and three lives. Backups
are not counted twice in statistics. Cross-tab revision guards remain in place;
per-asset snapshots can restore a replacement's progress if an older app writes
its previous board back to the date key. A failed backup cannot erase the old save.

Only the selected day's asset is downloaded, about 0.44–1.37 MB compressed across
this batch. The additional content does not load all twenty puzzles at startup.

## Checks

- Full Node suite: **609 passed**, including the exact published assets, all
  ordinary route witnesses, source-sense regressions, novelty and save recovery.
- Lint and production build passed.
- [Browser check](browser-check.json): all twenty dates at 375 × 667, one puzzle
  request per date, no overflow, and an actual bingo through the UI.
- [Progress check](progress-browser-check.json): a completed previous FALSE save
  survives the replacement; IGNITE starts fresh, its win restores after reload,
  and the calendar shows its three stars.
