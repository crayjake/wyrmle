# Generated MELANCHOLY review set

These five boards were generated from seed-driven overlapping word pools and planned refills. None was hand-authored. Open `/?generator=1` in the development server to inspect and play them.

Candidate **#1**, score **69.53**, was published as **September 24, 2026 puzzle version 5**. Its archived runtime-only snapshot is [2026-09-24.json](../src/daily/puzzles/2026-09-24.json), independent of later DEV rankings. Started/completed version 5 attempts keep this board. New or untouched attempts on both September 24 and 25 UTC use the exact selected [DESPAIR candidate](enemy-variety-review.md), version 6. **Settings → Beta tools → Reset puzzle** clears an older attempt and opens DESPAIR for its date.

The recorded batch evaluated **80 candidates** (40 initial constructions plus 40 mutations), witnessed **76 solvable**, and recorded **33 passing evaluations / 31 distinct accepted exports**. Mean screening runtime was 4.81 seconds per evaluation; mean explored states were 106.9. Runtime is machine-dependent.

The top 20 were reanalysed with the final alternating breadth/depth fairness sampler; 17 passed. The saved five take the best variant from each construction family. This avoids presenting a parent and a minor refill mutation as two separate playtests.

## Ranked candidates

| # | Seed | Intended archetypes | Score | Winning lines found | Reasonable opening words | Best witnessed turns |
|---|---|---|---:|---:|---:|---:|
| 1 | `melancholy-review-v1:38:g0:p0:m0` | clutch-finish, refill-planning | 69.53 | 12 | 33 | 5 |
| 2 | `melancholy-review-v1:27:0` | clutch-finish, refill-planning | 67.34 | 12 | 8 | 5 |
| 3 | `melancholy-review-v1:15:g0:p0:m0` | armour-break, multiple-routes | 66.93 | 12 | 2 | 4 |
| 4 | `melancholy-review-v1:14:0` | strike-override, grammar-twist | 60.90 | 12 | 3 | 4 |
| 5 | `melancholy-review-v1:2:g0:p0:m0` | ward-timing, refill-planning | 60.57 | 12 | 53 | 4 |

All solution depths below are witnessed upper bounds, not proved minima. Twelve lines is the configured retained-witness cap, not the total number of possible solutions.

## Mechanics and vocabulary

| # | Counter / neutral / resisted usage in wins | Ward / Strike / armour / grammar importance | Mean known familiarity | Least familiar word in best fully annotated witness |
|---|---|---|---:|---:|
| 1 | 39% / 61% / 0% | 0.70 / 0.53 / 0.04 / 0.53 | 90% | 90% |
| 2 | 43% / 57% / 0% | 0.14 / 0.60 / 0.23 / 0.60 | 89% | 82% |
| 3 | 53% / 47% / 0% | 0.60 / 0.64 / 0.14 / 0.00 | 91% | 90% |
| 4 | 18% / 82% / 0% | 0.60 / 0.40 / 0.05 / 0.30 | 91% | 91% |
| 5 | 55% / 45% / 0% | 0.64 / 0.60 / 0.14 / 0.04 | 90% | 91% |

Importance is a 0–1 analysis signal from exact route replays and bounded counterfactual searches. Familiarity is a curated estimate, not corpus frequency. The winning samples here favour counters and neutrals; resisted bait remains something to assess during play.

## Fairness and rescue evidence

| # | Proven premature dead / sampled states | Possible dead-state range incl. unknowns | Assessed share | Final states with direct rescue / sampled | Unknown final states | Clutch positions / retained winning moves |
|---|---|---|---:|---:|---:|---:|
| 1 | 0 / 50 | 0%–80% | 20% | 2 / 2 | 0 | 5 / 19 |
| 2 | 0 / 46 | 0%–80% | 20% | 4 / 4 | 0 | 4 / 32 |
| 3 | 0 / 37 | 0%–46% | 54% | 4 / 5 | 1 | 5 / 33 |
| 4 | 0 / 41 | 0%–39% | 61% | 0 / 0 | 0 | 2 / 2 |
| 5 | 0 / 41 | 0%–59% | 41% | 0 / 0 | 0 | 1 / 1 |

**Zero proven premature losses is not proof of fairness.** The wide uncertainty ranges are deliberately visible. Final-state rescue rates use the reasonable-play sample; additional exact winning traces can supply clutch opportunities outside that sample. A zero final-state denominator is unknown, not a 0% rescue rate. Ward continuations are not falsely classified as hopeless when no immediate finish exists.

Acceptance is for human DEV review. All five satisfy current gates, but the bounded search leaves some states unresolved and cannot certify fun. Winning and clutch tile-ID lines can be inspected in the browser and replay through the real engine.

## Reproduction and stored evidence

```sh
npm run generate -- --count 40 --enemy MELANCHOLY --seed melancholy-review-v1 --out artifacts/melancholy/final --states 100 --beam 12 --counterfactual-states 40 --refine 1 --mutations 1
npm run review-generated -- --input artifacts/melancholy/final/top.json --out artifacts/melancholy/final/review.json --dev-top
```

The screening counts above record the completed batch before the final fairness-sampling refinement; current reruns use the final sampler throughout and can select a different shortlist. Candidate construction, mutations and replayed tile IDs remain deterministic. Solver budgets, provider data and validation settings also affect rankings.

The saved candidates and analyses are in [melancholy.json](../src/generator/data/melancholy.json); the compact batch report is in [melancholy-batch-report.json](../src/generator/data/melancholy-batch-report.json). The local `artifacts/melancholy/final/` directory contains every accepted export, the complete batch report and both shortlist passes. See the [generator guide](generator.md) for APIs and metric definitions.
