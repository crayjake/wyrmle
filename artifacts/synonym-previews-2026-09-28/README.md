# Playable concept previews

Share **https://crayjake.github.io/wyrmle/?preview=concepts**. Also available from Daily → Settings → Concept previews.

The landing page explains two experiments, lists all four puzzles, and shows each device's saved attempts and best stars. The existing Daily battle screen supplies lives, refills, letter underlines, animations, Settings, and results. Grid, two-ring, single-ring, square and round tile choices now live in Settings and persist across puzzles. The original grid/square defaults remain.

## Rules

- Three lives, one life per accepted word. Clear every enemy letter to win.
- Words expressing the displayed enemy meaning hit with every matching letter. Other dictionary words do no damage, but consume a life and draw refills.
- The enemy and its own inflections/derivatives are excluded; ordinary inflections of other synonyms remain valid.
- In the POWER experiments, each selected blue tile adds one hit to the first surviving enemy position **after** ordinary matching hits. It only activates in a synonym, can cover a missing letter, and is consumed once. The tile's printed letter still has to be part of the word.
- All puzzles have a bingo and verified two-/three-word wins. Best stars are 3 for one word, 2 for two, 1 for three. Replaying keeps the best result. Easy mode enables three hints and an answer reveal.

## Boards and route witnesses (spoilers)

| Preview | Bingo | Two words | Three words |
| --- | --- | --- | --- |
| [FICTION](https://crayjake.github.io/wyrmle/?preview=concepts&puzzle=fiction) | FABRICATION | FALSITY → DECEPTION | FANCY → LIE → INVENTION |
| [ETERNAL](https://crayjake.github.io/wyrmle/?preview=concepts&puzzle=eternal) | INTERMINABLE | ENDLESS → IMMORTAL | ENDLESS → LASTING → FOREVER |
| [CALM + POWER](https://crayjake.github.io/wyrmle/?preview=concepts&puzzle=calm-power) | PEACEFUL | PEACE → MILD | MILD → EASE → PEACE |
| [GLOOM + POWER](https://crayjake.github.io/wyrmle/?preview=concepts&puzzle=gloom-power) | MELANCHOLY | MOROSE → LOW | LOW → MISERY → SORROW |

CALM's blue F supplies the missing M in PEACEFUL. GLOOM's blue M and C supply G and a second O in MELANCHOLY. Enumerating playable starting words on the same boards with POWER removed finds **zero bingos** in both cases. Thus the power expands feasible enemy/answer combinations, rather than merely extending the number of turns. This does not establish how many publishable puzzles that expansion would yield.

## Rebuild and evidence

Run `npm run generate:concept-previews`. The builder takes reviewed sense pools and designed letter/refill supplies from [profiles.ts](../../scripts/synonyms/profiles.ts), compiles all defined words spellable from their total supply, freezes their labels, packs/downloads dictionaries, and replays route witnesses through the real engine. It writes content-addressed assets, the preview catalog, and [proofs.json](proofs.json), including physical tile IDs, hits, POWER hits, all starting synonyms/bingos, source senses, and a familiarity/length effort estimate.

This is a reproducible builder for these four authored examples, **not an automatic arbitrary-enemy generator or a v3 difficulty certificate**. The semantic policy admits reviewed same-meaning families across word types (for example sadness and words describing sadness). Those editorial boundaries still need player testing; exact source synonym groups alone omit ordinary alternatives. No antonym, sentiment-score, or recursive thesaurus expansion is used.

Assets are fetched only when a puzzle is selected. Preview move logs use `wyrmle:preview:synonyms:v1:<id>:<asset revision>`, separate from Daily and retired beta progress. Reload replays saved physical moves; revisions get fresh progress. Progress is local to the browser/device, not shared by the link.

`tests/concept-previews.test.ts` checks route wins, preview/submission agreement, non-synonym damage, enemy exclusions, inflections, POWER consumption, unpowered impossibility, saved progress and isolation. The full suite passes **650 tests**, with typecheck/build and lint passing. Browser checks cover 320×480, 320×568, 390×844 and 844×390 fitting, sharing, reload/resume, all four bingos, Settings layouts and results.

Source meanings derive from the repository's pinned Open English Wordnet 2025 data. See [source attribution](../../src/lexicon/ATTRIBUTION.md) and [wordfreq attribution](../../docs/wordfreq-notice.md).
