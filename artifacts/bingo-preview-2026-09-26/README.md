# Three lives and a hidden bingo

Run `npm run dev`, then open **[the beta preview](http://localhost:5173/?preview=bingo)**. The same `?preview=bingo` entry point works in a production build. It is a separate practice puzzle: no daily attempt, preference, result or statistic is written. Restart returns the identical puzzle. Back to daily returns to the ordinary five-life game.

The preview has three lives, sixteen normal tiles, finite refills and six enemy hits. There are no Life extensions, Hit overrides, Revives, grammar bonuses or long-word bonuses. A bingo succeeds through the existing counter rules. The three-piece wyrm travels through the intro and docks in the life meter; spent segments animate after hit resolution. Reduced motion skips both effects.

[Phone opening](opening-375.png) · [Small-phone opening](opening-320.png) · [Desktop opening](opening-900.png)

## What the experiment establishes

- Exhaustive opening enumeration checked **15,137 physical selections / 3,325 distinct words**. Exactly one spelling wins immediately, with one physical selection.
- All twelve tested openings have replayed wins in two or three words. The sample includes eight counters plus ROAR, STORM, CHAOS and MESS. This is a collection of witnesses, not proof that every possible opening can be rescued.
- After the eight tested counter openings, bounded familiarity-filtered inspection finds **8–32 damaging counter words** and **1–9 resisted words**. These counts include inflections; they are not distinct semantic families or human discovery rates.
- The same `CALMS → HEN → OAR → SEA` line wins with five lives. With three lives it loses after OAR. The latter three words are neutral and each hits once. Three lives prevents that particular counter-then-chip-away fallback.
- A purely neutral line cannot win here: six enemy hits require more than three one-hit words, and no tile grants extra hits or lives.

Three lives is a promising constraint for a puzzle built around it. The refill design needed extra S tiles so a resisted opening did not permanently consume the armour-breaking supply. Cutting the lives on an existing puzzle alone would not establish fairness.

A guaranteed bingo works best as an optional discovery alongside approachable alternatives. Making it universal restricts enemy/counter pairs: a counter must contain every required enemy letter, including armour duplicates, and fit the board. Three lives reduces search depth, but finding several fair routes under that tighter limit can make construction harder. This preview does not benchmark generator speed or measure player difficulty.

## Spoilers and exact evidence

<details>
<summary>Reveal the bingo and example routes</summary>

**ORCHESTRATES** counters CHAOS through the sense “plan and direct (a complex undertaking).” It contains C, H, A and O, plus two copies of S to break and remove the armoured S. ORCHESTRATE alone leaves that final S alive. This is a twelve-letter word, with no invented scoring exception.

Some alternatives:

| Route | Words | Remaining lives |
| --- | ---: | ---: |
| CALMNESS → COHERENT | 2 | 1 |
| SCHEMA → REASON | 2 | 1 |
| HARMONY → CLASS | 2 | 1 |
| CALMS → ORCHESTRATE | 2 | 1 |
| STORM → CHARTS → REASON | 3 | 0 |
| MESS → HALCYON → REASONS | 3 | 0 |

[Selected bingo](bingo-selected-375.png) · [Bingo win](bingo-win-375.png) · [Last-life recovery from STORM](storm-finish-375.png) · [Neutral cleanup loss](loss-finish-375.png)

The precise physical tile IDs, refills, all twelve route witnesses, eight construction candidates, later word choices and controlled life comparison are in [review.json](review.json). Starting from the bingo's multiset, construction adds L/M/N/Y, shuffles eight boards/refill orders, checks familiar continuations through the real engine, ranks their surviving options, and exhaustively verifies the chosen opening.

</details>

## Meaning scope

The frozen preview covers **5,489 definition-backed spellings** compatible with its full letter supply. Of these, 4,499 inherit the published CHAOS inventory; 990 require new contextual review. The new words use existing offline base assessments plus seventeen explicit, source-backed preview corrections, including ORCHESTRATE(S), CLATTER(S), SCATTER(S) and RATTLE(S). HALCYON and HALCYONS retain their corrected counter meanings.

This is **not a semantically certified daily**. Full contextual review and inventory certification remain required before publication; no zero-error guarantee is claimed. [semantic-evidence.json.gz](semantic-evidence.json.gz) preserves the original model evidence and the separate editorial corrections. The preview transport omits model attestations; it does not change or fabricate responses in the model caches. Production publication gates remain intact and reject this preview.

## Reproduce

```sh
node scripts/generate-bingo-preview.ts
node --test --test-isolation=none tests/bingo-preview.test.ts
npm run dev
```

Generation writes only the isolated preview snapshot and this experiment's reports. The ordinary generator's three-turn minimum gate and the published daily catalog are unchanged. This is a specific backwards-construction experiment, not a general claim that any enemy can support a bingo.

Browser checks exercise the production build at 320 × 568, 375 × 667 and 900 × 900, including normal/reduced motion, the actual one-word win, two- and three-word wins, defeat, retry, storage preservation and returning to a five-life daily. See [browser-check.json](browser-check.json).

All **574 tests passed** on Node 24 in 107.5 seconds, along with lint and the production build. The five added regression tests verify exhaustive bingo uniqueness, the duplicate-letter armour requirement, every stored alternative route, the controlled three-versus-five-life comparison, key meaning families and separation from daily publication. The tested default boards fit both phone heights without scrolling or horizontal overflow.
