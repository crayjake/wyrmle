# Difficulty progression audit — 27 September 2026

**No puzzles or gameplay were changed.** This is an offline experiment on the 38 recently published bingo-first puzzles, including the five backdated samples. The generator currently proves wins and counts semantic choices; it does not require a three-word route to be easier to discover than a two-word route, or a two-word route to be easier than a bingo.

The evidence supports adding that requirement, but a single word-frequency cutoff would be too blunt. We need both approachable complete routes and checks on what happens after plausible opening moves.

## What was tested

- Replayed recorded ordinary solutions and every recorded starting bingo in the actual game engine, with exactly 3, 2 or 1 lives as appropriate.
- Searched each unchanged board for easier exact two- and three-word wins. Every returned witness was independently replayed.
- Kept the first two moves fixed for 203 recorded three-word routes and examined every admitted finishing word. The report retains the eight lowest-scoring finishers per position, plus full counts.
- Compared corpus frequency and word length. The trial route score is the **hardest individual word**, because a rare final word can make an otherwise approachable route frustrating.
- Checked hashes of the schedule, archive, guides, publication history and all 38 puzzle assets before and after the audit. All matched.

An ordinary route here must make positive damage on every move, use distinct dictionary lemmas, avoid starting-bingo lemmas, and include at least two counters in three words or one in two words. Adding a zero-hit word before a two-word win therefore cannot satisfy the three-word check. These are authoring constraints, not changes to what players may submit.

## Results

| Check | Result |
| --- | --- |
| Saved two-word witness beaten by another route already in its report | 22 / 38 |
| Easier two-word route found beyond the best recorded witness | 12 / 38 |
| Better three-word witness found, including one previously missing under the productive-move rule | 23 / 38 |
| Three-word witness with every word at Zipf ≥ 3.5 and at most eight letters | 30 / 38 |
| Strict trial ordering: three words < two words < easiest bingo | 22 / 38 |
| Two-word route scores harder than the easiest bingo after search | 2 / 38: LIE and GAIN |
| Fixed two-move prefixes with no finisher meeting that frequency/length threshold | 48 / 203 |
| Fixed prefixes whose saved finisher could be improved under the trial score | 68 / 203 |

Before the broader search, eight of 37 comparable reports appeared to require a harder three-word route than their best recorded two-word route. Afterwards, every board had a three-word witness scoring no worse than the best two-word witness. **That does not mean their natural opening lines are equally friendly.** The fixed-prefix checks expose difficulties that comparing just the easiest complete routes conceals.

All 38 two-word searches and 28 three-word searches completed within the stated search scope. Ten three-word searches reached the 6,000-position budget; their results are valid witnesses, not proven minima. The 22 strictly ordered boards are an observation under an uncalibrated score, not a human difficulty certification.

## Concrete examples — spoilers

| Enemy | Three-word example | Two-word example | Easiest bingo under the trial score |
| --- | --- | --- | --- |
| SPRINT | DRONE → WAITS → CREPT | CREPT → TARDINESS | PROCRASTINATE |
| STONE | SOFT → ICE → TENDER | SHOCK → TENDER | SOFTENED |
| LIE | TRUE → BASIC → HONESTLY | SOUTHLAND → CERTIFIES | ESTABLISHED |
| GAIN | LOSING → GRANT → AIR | DIE → GRANTING | FAILING |
| FAST | EAT → FED → MEALS | FED → EATS | FEAST |

SPRINT has a sensible overall progression in this model, yet **EASY → CREPT leaves only TARDINESS**. LIE's **HONEST → ALL leaves only CERTIFY**. These two singleton claims were additionally checked against all legal finishing words, including repeats and bingo families. SOIL's CLEANSE → POST leaves a group including DISTIL and STERILIZE, with no finisher passing the trial familiarity threshold. An easy route elsewhere does not rescue a player already in one of these positions.

STONE illustrates a different issue: its recorded SOFT → CUSHIONED → EYE route is much more demanding by the trial score than SOFT → ICE → TENDER. This is partly the choice of witness and continuation, rather than a fundamental lack of easier words. Its best two- and three-word witnesses tie because both bottlenecks are TENDER; this score cannot measure the planning difference between them.

FAST illustrates why checking the nominated bingo is insufficient. Its advertised answer is FEASTING, but **FEAST already wins**. That shorter shortcut should be considered when assessing future candidates. Five of the 38 boards have an available bingo scoring easier than their advertised answer.

LIE is a clear vocabulary reversal: SOUTHLAND → CERTIFIES scores harder than ESTABLISHED. GAIN has a similar, smaller reversal. Neither board was changed.

## What the existing familiarity data can and cannot tell us

The repository already includes pinned **wordfreq 3.1.1 English large** data in `src/generator/familiarity.ts`. Higher Zipf values mean more frequent spellings. Each point represents a tenfold frequency difference; Zipf 3 is approximately one occurrence per million words. See the [wordfreq documentation](https://github.com/rspeer/wordfreq) and the repository's [attribution notice](../../docs/wordfreq-notice.md).

| Word | Zipf |
| --- | ---: |
| SOFT | 4.68 |
| TENDER | 4.09 |
| FEAST | 3.95 |
| CUSHION | 3.58 |
| SPOTLESS | 3.12 |
| HALCYON | 2.65 |
| CUSHIONED | 2.62 |
| TARDINESS | 2.43 |

Frequency estimates exposure, not whether someone knows a word or will think of it on this board. SPOTLESS is perfectly understandable despite missing the trial Zipf 3.5 threshold. HALCYON is uncommon but can be an excellent discovery. Inflections can score much lower than a familiar base word. Common words such as FALL or RULED can depend on a less obvious selected sense. A frequency-only search can also choose arbitrary neutral fillers; the raw FAST search returns ASS instead of the more thematically satisfying MEALS in the table.

The trial score is deliberately simple and inspectable:

```text
word effort = 2 × max(0, 4.5 − Zipf) + 0.6 × max(0, letters − 5)
route effort = maximum word effort in the route
```

These weights are a hypothesis, not a calibrated player model. The score ignores semantic obviousness, spelling familiarity, base-word recognition, letter placement, distractions, and how many reasonable choices a player has. Varying the length weight from 0.4 to 0.8 changes the initial recorded three-versus-two reversals from nine to eight; this modest sensitivity check is not validation of the model. Frequency and length components remain available separately in the results.

The search uses Zipf ≥ 2.4, canonical selections of ordinary tiles, and the productive-route restrictions above. It optimises this bottleneck score, not total thinking time. Exact word counts matter: comparing “wins within three lives” with “wins within two lives” would automatically include the same two-word solutions and tell us little about progression.

## Recommended generation change — not implemented

Keep the bingo-first construction method. Change what makes a candidate acceptable:

1. **Build a friendly three-word foundation.** Require several routes using recognisable, reasonably short counters, with different plausible openings. Check the hardest required word, not average familiarity across the route.
2. **Protect likely continuations.** After common counter openings and sensible second moves, look for accessible finishers and useful choice breadth. Flag positions where a player must suddenly find a rare word. This need not make every possible move recoverable; meaningful mistakes and tempting similar words should remain.
3. **Make two-word wins require better coverage or planning.** Prefer more efficient combinations over simply rarer vocabulary. Compare the best available two-word routes with the friendly three-word routes, while recognising that a lexical-score tie can still involve a planning challenge.
4. **Inspect every available bingo.** The shortest or most obvious winning alternative matters, even when the nominated answer looks impressive. Preserve satisfying long words and lateral discoveries; flag accidental short shortcuts like FEAST before publication.
5. **Review semantic discoverability separately.** Frequency and length can screen candidates. A simple editorial distinction between direct counters and more lateral concepts, followed by playtesting, is needed to judge whether the counter will occur to a player. Do not change correct semantic labels to manufacture difficulty.

I would use strong accessibility checks for the three-word routes and suspicious-shortcut checks for bingos, then rank the remaining candidates for the desired progression. I would not require an arbitrary numerical gap on every board or remove good words such as HALCYON to make the scores behave.

## Reproduce

This is a reusable offline diagnostic, **not a new production acceptance rule**:

```bash
node --max-old-space-size=4096 scripts/audit-route-difficulty.ts --search '*' --budget 6000
```

To search selected enemies only, use `--search STONE,SPRINT,LIE`. All manifest entries still receive recorded-route and fixed-prefix checks. `--manifest` accepts a publication manifest containing puzzle assets and report paths; `--output` chooses the report directory. It never writes puzzle assets or the schedule.

- [Summary and unchanged-file hashes](summary.json)
- [Full metrics, exact tile selections and finishing alternatives](results.json)
- [Offline diagnostic](../../scripts/audit-route-difficulty.ts)
- [Search and scoring implementation](../../scripts/bingo/routeDifficulty.ts)
- [Regression checks](../../tests/route-difficulty-audit.test.ts)

Validation: 11 focused tests passed, covering the existing familiarity/difficulty code and the new read-only search, bounded-search reporting, zero-hit padding exclusion, unchanged boards, and fixed-prefix alternatives. Lint also passed.
