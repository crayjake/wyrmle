# Meaning throughout the puzzle

Open [the interactive workbench](index.html) to inspect actual boards after different word sequences, their resisted temptations, available counters and definitions. The report includes the current CHAOS puzzle, a new generator draft and six HALCYON studies.

## Design decisions

The target is recurring semantic tension: familiar words reinforce the enemy, while less obvious but understandable counters reward discovery. HALCYON is the model for an optional literary discovery. A rare word should not be the only winning vocabulary route. Your CALMS → tempting ROAR example adds an endgame criterion: a resisted word can contain the remaining letters while a counter on the same board actually wins.

Neutral words still have a role in rearranging the board, preserving special tiles and landing an occasional final hit. A routine “one counter, then neutral words until victory” is a design failure. A high opening counter count and a solver's clever favourite line do not establish that real play stays interesting.

Generator v5 now:

- Seeds clear thematic words and discovery counters; lower-frequency counters such as HALCYON survive the construction cutoff.
- Uses spare refills for both additional counters and recurring resisted words.
- Gives short enemies more health (CHAOS normally starts with nine HP).
- Samples neutral, resisted and counter branches through later turns, including different refill offsets and physical special-tile choices.
- Measures actual counter damage advantages, repeated counter use in winning routes, neutral tails and ten simple chip-away runs.
- Rewards endings with tempting resisted words and winning counter alternatives.
- Rejects drafts with counter droughts, fading themes or easy neutral finishes. Scores cannot override these gates.
- Probes Hit-assisted ordinary/resisted openings so counter-first search does not mistake an unexamined special-tile use for a useless mechanic.
- Supports zero to three enemy Revive tiles, through both the DEV form and `--revives N`.

These are bounded diagnostics, not proofs about every possible sequence or calibrated models of human attention. Familiarity is a frequency proxy. Full semantic inventory review, opening certificates, independent publication checks and human playtesting remain separate requirements.

## Balance comparison

This comparison holds CHAOS's letters and refill queue fixed, changes one balance setting at a time, and replays two deterministic neutral policies after no counter or four strong opening counters. The ten runs are strategy probes, not player win probabilities. All variants have independently replayed wins; their shortest observed routes are not proved minima.

| Variant | Chip-away wins | Shortest win found |
| --- | ---: | ---: |
| Current: 7 enemy HP, 5 lives, 1 Revive | 8/10 | 3 |
| 4 player lives | 6/10 | 3 |
| 9 enemy HP | 0/10 | 3 |
| 10 enemy HP | 0/10 | 3 |
| 2 Revive tiles | 6/10 | 3 |
| 9 enemy HP and 2 Revives | 0/10 | 4 |

Nine HP is the most promising first adjustment. Adding another Revive alone does not solve the easy neutral finish. Combining both pressures makes the fight longer and reduces later counter availability in this sample, so more punishment is not automatically more interesting.

The final four-candidate generator batch accepts **one draft** for development review. Its opening anchors include STORM and TANGLE versus SCHEMA and SERENE. The exact accepted draft and rejected candidates, with all gate reasons, are in `final-generator-check.json.gz`. This draft is **not publication-ready**: its larger supply has 975 words still missing contextual review, and it needs a complete inventory audit and opening certification. No unreviewed experimental meanings replace a daily.

## HALCYON as an enemy

The intended enemy is the adjective “idyllically calm and peaceful; suggesting happy tranquillity.” It supports a useful reversal: CALM, SERENE and HARMONY become resisted; CLAMOR, CLASH, HOWLING, NOISY and ANARCHY become counters. The letters offer different counter families, including options for the difficult Y.

Six real-engine studies use an explicit **70-word reviewed vocabulary**. Words outside that list are rejected, not assumed neutral. They are experiments, not normal full-dictionary puzzles. The default dictionary senses and editorial relations are visible in `halcyon/reviewed-vocabulary.json`; no HALCYON model review is claimed or fabricated.

All six are solvable. A four-life study has the winning counter sequence **CHAOS → NOISY → HOWLING → CLASH**. The first four generated queues lose the calm theme too quickly. Replenishing the theme explicitly raises its later sampled presence to 50% in study 5, while 83% of later sampled boards retain multiple counter meanings. That is promising, but does not yet sustain the intended theme across the whole puzzle. The six studies use different construction seeds; their health/life differences alone do not establish causal effects.

Enemy HALCYON also falls below the ordinary automated enemy-familiarity cutoff. A designer can deliberately choose a literary word and explain its meaning, but the production classifier must first gain a complete, reviewed HALCYON inventory. The study does not weaken that gate.

## Reproduce and inspect

```sh
# Normal v5 discovery generation; does not edit the daily catalog.
npm run generate -- --enemy CHAOS --count 4 --seed semantic-discovery-v5 --refills 24 --revives 1 --states 60 --beam 10 --counterfactual-states 24 --out artifacts/generated/design-review

# Rebuild the explicit HALCYON word-list studies and visual report.
node scripts/test-halcyon-enemy.ts
node scripts/build-puzzle-design-report.ts
```

`--classic-design` keeps the previous meaning-era constructor available for comparison. Legacy seed reproduction remains unchanged. The exact final generator batch uses seeds `semantic-discovery-v5:0` through `:3` in a single `generateForEnemy` call; the general CLI adds its own outer batch suffix.

`balance-comparison.json.gz` contains compact replayable winning routes and journey diagnostics for the six controlled CHAOS variants. `balance-summary.json` is the readable comparison. `current-chaos-journey.json` records the original v12 diagnosis. `halcyon/study.json.gz` contains each complete experimental encounter and replayable routes. Browser screenshots and checks are alongside this file.

## Packaged daily and icon changes

The daily change is **CHAOS v13**, correcting HALCYONS through its mythical calming-bird sense. All 8,041 opening choices were recertified and the three-word minimum reproved. Previously played versions remain pinned. The new health/refill experiments are unpublished.

Icon concept 1 is installed as the v3 browser, Apple and manifest assets. The approved original is `assets/brand/wyrm-w-v3.png`; the original built-in image-generation prompt remains in `artifacts/icon-concepts-2026-09-26/prompts.json`. No new generation was used to export the selected icon.

All 562 Node tests pass, along with lint and the production build (including typecheck). Mobile browser checks play both daily dates to victory, preserve an existing attempt and report no runtime errors or horizontal overflow. A browser generation batch completes with two Revives. The report's study selector, branch selector and meaning inspector work at desktop and mobile sizes. Exact checks are in `verification.json` and `../meaning-v4-halcyons/verification.json`. These are local repository changes; no remote deployment was performed.
