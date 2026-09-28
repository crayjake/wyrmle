# Plain antonym release

29 September's Daily is a new DEAR puzzle, in the **expensive** sense. All damaging words are opposite adjectives. Other dictionary words spend a life and draw refills but do no damage. The previous DRY entry is replaced only on this date; every other scheduled date is unchanged.

Five fresh plain previews are available under `?preview=concepts`: ALERT, TRUE, STERN, HOSTILE and RUDE. The original previews and their saved progress remain available. Pages keep the selection screen within a phone viewport.

Spoilers follow. Each row is verified through the actual game engine, with distinct, productive words on the ordinary routes.

| Enemy | Three words | Two words | Bingo | Difficulty, 3 / 2 / 1 |
|---|---|---|---|---|
| DEAR | CHEAP → LOWER → MODEST | LOWER → MODERATE | AFFORDABLE | 1.54 / 2.26 / 3.56 |
| ALERT | SLOW → TIRED → LAZY | LANGUID → TIRED | LETHARGIC | 0.52 / 5.12 / 5.84 |
| TRUE | WRONG → BOGUS → TWISTED | INCORRECT → BOGUS | INACCURATE | 2.24 / 3.52 / 4.70 |
| STERN | NICE → WARM → SOFT | TENDER → EASY | CONSIDERATE | 0 / 1.42 / 6 |
| HOSTILE | NICE → SOFT → HELPFUL | SOCIAL → HEARTY | HOSPITABLE | 1.34 / 2.84 / 6.08 |
| RUDE | WARM → KIND → HUMANE | REFINED → SUAVE | CULTURED | 2.36 / 3.20 / 4.20 |

Difficulty uses dictionary frequency and word length. It is a proxy, not a claim about every player's solving time. Certification considers every legal first word (including zero-damage refill setups), repeats and physical tile choices when finding the cheapest two-word win. Every initial bingo must be harder than the authored three-word route and the cheapest two-word route. The full certificates and pinned semantic reviews are in the JSON reports.

Reproduce with `npm run generate:concept-previews` and `npm run publish:antonym-daily`. The latter deliberately targets only 2026-09-29, checks freshness against publication history and writes the hashed asset, guide, certificate and schedule entry. Both use `scripts/antonyms/build.ts` and the same difficulty validator. Source meanings come from the repository's pinned Open English WordNet 2025 catalog; existing attribution applies.
