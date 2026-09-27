# V3 progression benchmarks — solution spoilers in JSON

The five September 11–15 backdated samples are the regression set for [bingo-first v3](../../docs/generator-v3.md). Run `npm run benchmark:v3` to verify them without printing answers. `tests/generator-v3.test.ts` also runs in CI.

`benchmarks.json` records each previous/current calendar entry. SOIL, HIDE and DIM keep their exact assets and progress. STOP keeps its physical puzzle with corrected start/restart meanings (see below). DAYS is replaced by TRUST, constructed by the runnable bingo-first generator with seed `bingo-first-3:TRUST:UNCERTAINTIES:13:two-turn-route` and the current source profile. Its generation command was:

```sh
npm run generate:batch -- --directory artifacts/daily-year-v3-benchmarks-2026-09-27 --enemies TRUST --seeds 2 --limit 1
```

This command generated the staged asset before publication; rerunning after publication correctly encounters its identity in the novelty ledger. The immutable asset and proofs remain committed for deterministic replays.

`proofs/` contains five v3 reports, exact 3/2/1-life witnesses, exhaustive two-word lower bounds and fingerprint-bound meaning reviews. `rejected-days.json` keeps the original negative example: SHADY was an easier hidden bingo than SHADOWY, its low-cost two- and three-word routes tie, and treating DAYS as daylight was not a fair enemy reading.

The independent two-word solution is intentionally separate from the unrestricted lower-bound search. Before its semantic correction, STOP's cheapest legal shortcut used TRANSPORT, related to the bingo; SOIL's uses the uncommon DISTIL. These shortcuts must influence the bound even though neither is required as the offered intermediate route. The old STOP asset remains a regression fixture for that search.

## STOP semantic correction

The motion concept pool omitted starting and restarting. Five pinned verb senses now cover START, BEGIN, RESTART and RESUME with their inflections. Only the eight START/RESTART forms change labels in STOP's playable inventory; broad GET forms and surprise words such as STARTLED remain neutral. The board, armour, refills and bingo stay identical, and the novelty identity is unchanged.

The corrected asset is `motion-0-stop-transports-9f7ab6081bf2.json`. Its report records the old asset and the changed spellings. The old frozen asset is retained for saved-revision backups. START/STARTED/STARTING hit three enemy units; STARTS hits four. V3 is rerun against these stronger counters: GONE → DROP → STARTS scores 0.60, STARTED → PROGRESS scores 1.80, and the easiest bingo scores 5.42. The semantic regression gate now refuses to certify STOP with any spellable start/begin/restart/resume form missing or neutral.

A v3 pass guarantees the documented frequency/length ordering of available routes, not universal human difficulty or easy recovery from every first two moves. The ordinary third-word routes were reviewed for natural vocabulary. In particular, SOIL's easy route finishes with SPOTLESS rather than requiring an obscure distillation word.
