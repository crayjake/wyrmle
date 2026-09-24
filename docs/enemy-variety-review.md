# Enemy comparison: finish variety

**DESPAIR is the strongest candidate from this screen for a mix of three-word wins and last-Resolve rescues. CRUELTY also offers several distinct quick routes.** This is a design judgment based on observed play, not proof that one enemy concept is universally better.

## Comparable screen

Six unmutated candidates per enemy, 36 total, using seeds `enemy-variety-v1:ENEMY:0` through `:5`. Each used the same bounded analysis: solver 100 states / beam 12, counterfactual solver 40 states / beam 8, 64 reasonable-state samples, existing validation gates. All 432 retained winning witnesses and 28 stored clutch continuations were replayed through the real engine. Additional familiar-vocabulary searches supplied the short DESPAIR routes and expanded ANGER routes. These searches establish examples, not global minimum lengths or total solution counts.

| Enemy | Accepted / six | Best accepted screening score | Main observation |
|---|---:|---:|---|
| DESPAIR | 3/6 | 56.79 | Selected board :5 supports 3, 4, 5 and 6 words, including a last-Resolve rescue. |
| CRUELTY | 3/6 | 55.85 | Selected board :3 supports 3, 4 and 5 words; seven observed strategy signatures in the initial screen. |
| ANGER | 2/6 | 53.61 | Selected board :4 supports 3, 4 and 5 words; many finishing alternatives remove the same final letter. |
| MELANCHOLY | 4/6 | 66.35 | Strongest score in this screen and more sampled clutch positions; quick three-word wins were not found. |
| CHAOS | 0/6 | — | No accepted board in this small sample; short wins and weak mechanic relevance caused rejections. |
| FEAR | 0/6 | — | No accepted board in this small sample; semantics and Strike had weak measured relevance. |

The earlier September 24 MELANCHOLY publication (puzzle version 5) scored **69.53** in its larger earlier review; this new screen’s best MELANCHOLY scored **66.35**. The selected DESPAIR is **56.08**, CRUELTY **52.90**, ANGER **53.61**. The selection prioritises the requested variety in finish lengths; it does not claim a higher overall generator score. Zero accepted boards in six attempts does not establish that an enemy is unsuitable.

## Replayed examples

All DESPAIR routes below share seed **enemy-variety-v1:DESPAIR:5**, published for **both September 24 and 25, 2026 UTC, puzzle version 6**. Both dates use the exact frozen snapshot at [2026-09-24-v6.json](../src/daily/puzzles/2026-09-24-v6.json). New or untouched attempts use DESPAIR; started/completed attempts keep their original boards, including September 24 MELANCHOLY and September 25 authored version 4. **Settings → Beta tools → Reset puzzle** switches an older attempt to the current board for its date. CRUELTY routes share **enemy-variety-v1:CRUELTY:3**; ANGER uses **enemy-variety-v1:ANGER:4**. CRUELTY and ANGER remain review candidates.

Number the 16 board positions left to right, top to bottom. Positions remain fixed as letters refill. Select the listed positions in order; duplicate-letter choices matter. E² means E needs two hits.

### DESPAIR: three words

| Word | Board positions | Hits | Effects | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| WINTER | 2 → 15 → 10 → 14 → 16 → 8 | I, E, R | STRIKE | 4 | DESPA |
| HOPE | 10 → 12 → 15 → 16 | P, E | WARD | 4 | DSA |
| SCARED | 6 → 16 → 1 → 11 → 10 → 5 | S, A, D | — | 3 | Defeated |

### DESPAIR: four words

| Word | Board positions | Hits | Effects | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| FOREST | 3 → 12 → 8 → 16 → 6 → 14 | R, E, S | STRIKE + WARD | 5 | DEPAI |
| HOPE | 8 → 9 → 14 → 16 | P, E | — | 4 | DAI |
| CHILDREN | 16 → 14 → 15 → 13 → 5 → 11 → 8 → 10 | I, D | — | 3 | A |
| CARE | 14 → 1 → 9 → 16 | A | — | 2 | Defeated |

### DESPAIR: five words

| Word | Board positions | Hits | Effects | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| FRIENDLY | 3 → 8 → 15 → 16 → 10 → 5 → 13 → 4 | R, I, E, D | STRIKE | 4 | ESPA |
| STEADY | 6 → 14 → 13 → 4 → 7 → 8 | S, E, A | — | 3 | P |
| DOG | 13 → 12 → 14 | None | WARD | 3 | P |
| ANGER | 1 → 14 → 8 → 15 → 16 | None | — | 2 | P |
| HOPE | 5 → 7 → 3 → 1 | P | — | 1 | Defeated |

### DESPAIR: final-Resolve clutch

| Word | Board positions | Hits | Effects | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| ORDER | 12 → 8 → 5 → 16 → 11 | R, E | STRIKE + WARD | 5 | DESPAI |
| HAPPY | 11 → 1 → 5 → 16 → 4 | A, P | — | 4 | DESI |
| CHEER | 16 → 11 → 1 → 4 → 5 | E | — | 3 | DSI |
| DOG | 7 → 9 → 4 | D | — | 2 | SI |
| CONFIDENT | 4 → 1 → 10 → 3 → 15 → 5 → 9 → 7 → 14 | I | — | 1 | S |
| OPTIMISM | 4 → 14 → 7 → 5 → 1 → 15 → 6 → 3 | S | — | 0 | Defeated |

### CRUELTY: three counters

| Word | Board positions | Hits | Effects | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| CARE | 14 → 3 → 4 → 11 | C, R, E | STRIKE + WARD | 5 | UELTY |
| HUMANITY | 5 → 14 → 11 → 3 → 7 → 8 → 16 → 15 | U, T, Y | — | 4 | EL |
| HELP | 15 → 4 → 12 → 7 | E, L | — | 3 | Defeated |

### CRUELTY: neutral and counter combination

| Word | Board positions | Hits | Effects | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| CHILDREN | 14 → 5 → 8 → 12 → 10 → 4 → 11 → 7 | C, L, E | STRIKE + WARD | 5 | RUETY |
| EMPATHY | 5 → 7 → 12 → 10 → 16 → 6 → 15 | E, T, Y | — | 4 | RU |
| RESCUE | 1 → 5 → 13 → 12 → 8 → 10 | R, U | — | 3 | Defeated |

### ANGER: two-letter finishing hit

| Word | Board positions | Hits | Effects | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| EVENING | 9 → 13 → 10 → 15 → 14 → 16 → 11 | E, E, N | STRIKE + WARD | 5 | A²GR |
| DANGER | 8 → 3 → 11 → 10 → 13 → 7 | A, G | — | 4 | AR |
| STREAM | 5 → 4 → 1 → 2 → 3 → 10 | R, A | — | 3 | Defeated |

On DESPAIR, **SCARED** finishes S, A and D together through its adjective and long-word bonuses. Another verified three-word route, **END → AFRAID → SLEEPY**, finishes a different set: E, S and P. **SAD → FRIENDLY → HOPE** finishes E and P. These are distinct finishing situations on the same board.

The six-word route reaches the final turn with 1 Resolve and only S remaining. The separately verified alternatives **OPTIMISM, SAD, POST, SLOW, SADLY, SALTY and TOAST** can each finish that exact position; they are different words but all solve the same one-letter cleanup. This distinction matters when judging strategic variety. Some five-word witnesses use zero-damage detours; their existence alone does not make them compelling strategies.

## Saved evidence and reproduction

Full candidate encounters, solver witnesses, validation reasons and scores are saved locally under `artifacts/enemy-variety-v1/`. `DESPAIR-5-walkthroughs.json` contains supplemental routes and rescue choices; `ANGER-best-deeper.json` contains the deeper ANGER search. No encounter or game rule was changed to obtain these wins.

Reproduce the initial screen with `generateForEnemy(enemy, "enemy-variety-v1:" + enemy, { candidateCount: 6, keep: 6, refinementRounds: 0, analysis: { solver: { maxStates: 100, beamWidth: 12 }, counterfactualSolver: { maxStates: 40, beamWidth: 8 }, maxReasonableStates: 64 } })`.
