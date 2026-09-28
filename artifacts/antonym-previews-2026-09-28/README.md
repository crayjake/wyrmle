# Antonyms and one-family counters

Share **https://crayjake.github.io/wyrmle/?preview=concepts** (also Daily → Settings → Concept previews). Three tabs keep the six boards accessible without scrolling: Antonyms, + POWER, One family. Each card shows local progress and best stars. Settings retain grid/rings and square/round tiles. Easy mode provides three hints, then the answer.

The original four previews now require opposite meanings **in the enemy’s word type**. Each accepted damaging reading is pinned to a reviewed dictionary sense. Noun-to-adjective associations, unrelated meanings and neutral words do no damage. A non-counter still costs a life and draws refills. All accepted words cost one life; the enemy and its own forms are excluded.

The two additional previews restrict counters to a **single stated action family**:

- **SEARS**, verb: **add water**, using verbs. Matches the enemy’s word type.
- **DIRT**, noun: **clean**, using verbs. Deliberately crosses word types while keeping one counter idea. Cleaning includes hygienic cleaning; rearranging, beautifying or covering dirt does not count.

A blue **POWER** tile, played inside a counter, hits one additional surviving enemy letter after the normal matches. It is consumed once, and cannot activate in a non-counter. DREAD has two, ETERNAL and SEARS have one each. Exhaustive starting-board checks find no unpowered bingo for any of these three.

## Routes (spoilers)

| Enemy | Three words | Two productive counters | Hinted bingo |
| --- | --- | --- | --- |
| DRY | DAMP → SOGGY → RAINY | DAMP → WATERY | HYDRATED |
| MEAN | KIND → NICE → WARM | KIND → AMIABLE | COMPASSIONATE |
| DREAD | EASE → NERVE → RELIEF | BOLDNESS → DARING | FEARLESSNESS |
| ETERNAL | BRIEF → FINITE → MORTAL | TEMPORAL → FINITE | IMPERMANENT |
| SEARS | MIST → SOAK → WATER | SPRINKLE → WATERS | IRRIGATES |
| DIRT | DUST → WIPE → SCRUB | DUST → RINSE | STERILISED |

SEARS also admits **SPARGE**, a less familiar water-sprinkling verb, as a bingo. It is included in the difficulty check; answers are not suppressed just to fit the intended route. IRRIGATES is the hinted answer. The blue G supplies the second S.

## Difficulty checks

The checker searches **every legal first word**, including non-counters that draw useful refills, repeats and all choices between using/saving physical POWER tiles. It proves the cheapest two-word win under the existing bottleneck effort proxy: `max(2 × max(0, 4.5 − Zipf) + 0.6 × max(0, length − 5))` across a route. Interchangeable ordinary tile copies are canonicalized; POWER choices are not.

Each three-word witness must have three different counter lemmas, positive hits every turn, no starting-bingo lemma, minimum word Zipf 2.8, effort at most 4.8, and a 0.4 effort gap below even the easiest two-word solution. The authored two-word route must likewise use distinct productive non-bingo counters, and sit at least 0.4 below **every** initial bingo. Routes replay in the actual game engine using the physical tile IDs recorded in [proofs.json](proofs.json).

| Enemy | Three-word effort | Cheapest two-word effort | Easiest bingo effort |
| --- | ---: | ---: | ---: |
| DRY | 2.72 | 3.22 | 4.26 |
| MEAN | 0.00 | 2.56 | 6.70 |
| DREAD | 0.62 | 3.14 | 8.28 |
| ETERNAL | 2.10 | 3.54 | 8.22 |
| SEARS | 1.78 | 4.02 | 6.72 |
| DIRT | 1.62 | 2.04 | 7.40 |

MEAN has a cheaper two-counter route, NICEST → WARM, than the authored KIND → AMIABLE route. DREAD’s cheapest is EASES → RELIEF, with BOLDNESS → DARING as another two-word win. Both meet the progression. DIRT has a small margin and is particularly worth playtesting. Word frequency and length do **not** measure a person’s insight or semantic familiarity: these are enforceable editorial gates, not a guarantee that every player or every three-word route finds the same difficulty ordering.

## Rebuild and validation

Run `npm run generate:concept-previews`. The reproducible builder reads [reviewed profiles](../../scripts/antonyms/profiles.ts), compiles defined words over the full starting/refill supply, applies the sense and word-type policy, verifies routes and the [difficulty gates](../../scripts/antonyms/progression.ts), then writes the catalog and content-addressed puzzle dictionaries. It is a builder for six authored examples, not an arbitrary-enemy automatic generator. Daily generation and its v3 checks are unchanged.

Run `node --test tests/concept-previews.test.ts` for real downloaded-asset progression checks, semantic boundaries, POWER behavior, saved-progress isolation and decoding. The definitions and inflections use pinned Open English Wordnet 2025 with the existing supplementary dictionary; source IDs and review decisions are preserved in the proofs. See [attribution](../../src/lexicon/ATTRIBUTION.md) and [word frequency license](../../docs/wordfreq-notice.md).

Only the selected puzzle dictionary downloads. Progress uses `wyrmle:preview:antonyms:v2:<id>:<revision>` and does not carry scores from the retired synonym boards. Their historical research report remains available alongside this one.


The supplementary adjective readings of [HYDRATED](https://en.wiktionary.org/w/index.php?title=hydrated&oldid=85896008) and [SATURATED](https://en.wiktionary.org/w/index.php?title=saturated&oldid=92016973) are adapted from the linked Wiktionary revisions and their contributors, under Wiktionary’s Attribution-ShareAlike terms. Their everyday bodily-water/moisture readings are kept separate from the chemical readings in OEWN. The builder makes no live dictionary or model requests.

The water family also includes the [wetting verb DAMP and its forms](https://en.wiktionary.org/w/index.php?title=damp&oldid=92515406), which OEWN omits, and the liquid-filling reading of SATURATE. DAMP's short supplementary definition is adapted from that pinned Wiktionary entry under the same terms.
