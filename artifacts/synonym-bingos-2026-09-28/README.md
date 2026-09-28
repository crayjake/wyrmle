# Synonyms dealing damage: lexical feasibility

Research run on 28 September 2026. No live rules, puzzles, schedules or generator classifications were changed.

## Scope

The scan reads the entire pinned Open English Wordnet 2025 catalog already in the repo: 107,519 synonym sets and 116,197 source-covered game spellings. It then considers the **30,514 admitted source lemmas of 3–8 letters** as possible enemies, and source lemmas of 3–16 letters as answers. Inferred and explicit inflections are not added as extra answers. The frequency inventory covers 116,395 spellings; its supplemental function words have no synonym sets in this catalog and are outside this scan.

Two different words must occur in the **same exact synonym set**, hence share a specific source sense. There is no conceptual-counter inference, synonym chaining, adjective similarity expansion or broad relatedness search. The enemy itself and answers containing the whole enemy as a contiguous substring are excluded. This removes whole-word extensions, including legitimate synonyms such as RAGE → OUTRAGE, from the count.

For full coverage, the answer must contain the enemy's complete letter **multiset**: two occurrences of a letter in the enemy require two occurrences in the answer. Armour capacity is calculated with the existing generator's rule: spare copies can add one extra hit to each enemy position, at most once per position. A two-armour pair has capacity for two extra hits; these need not be two distinct letter types if the enemy already repeats a letter.

“Familiar” below means both spellings score at least Zipf 3 in the existing pinned wordfreq inventory. This is a corpus-based screening threshold, not an editorial judgment of familiar senses. See [the familiarity documentation](../../docs/generator-familiarity.md).

## Results

Counts are **distinct enemy spellings**, not concepts or certified puzzles.

| Filter | Enemy spellings | Enemy/answer pairs |
| --- | ---: | ---: |
| At least one shared letter with a distinct, non-substring synonym | 19,207 | Not retained |
| Same, both spellings familiar | 6,999 | Not retained |
| A synonym covers every enemy letter | 1,395 | 1,594 |
| Full coverage, both spellings familiar | 250 | 276 |
| Full coverage, familiar, answer 7–15 letters | 189 | 199 |
| Full coverage, familiar, at least one armour point | 94 | 96 |
| Full coverage, familiar, at least two armour points | 23 | 23 |
| Full coverage, two armour points, without familiarity filter | 157 | 164 |

Of the 23 familiar two-armour pairs, only five have at least two other familiar, overlapping words in the **same source sense**. None have four. This is only a vocabulary-pool count: those alternatives are not guaranteed to cover the remaining letters or form playable shorter routes. Regional variants also remain in those counts; CENTER and CENTRE are separate spellings, not separate concepts.

## Follow-up: two or more armour, and a year of unique enemies

The original **23** means **at least two armour points**, not exactly two. Seventeen pairs have capacity for exactly two, five for three, and one for four. Three- and four-armour cases were already counted. Requiring extra armour cannot add candidates; every higher-capacity candidate already passes the lower minimum.

The first scan excluded all non-lemma answers and required Zipf 3 for both words. Those are research filters, not necessary gameplay rules. A follow-up keeps familiar enemy lemmas (Zipf ≥ 3), allows less-common answers (Zipf ≥ 2.2, the current discovery minimum for bingo spellings), and admits inflections of **other** lemmas. The enemy's own lemma remains excluded. Source synonymy is still one exact synset; no adjective similarity expansion is used in this table. Answer length is restricted to 7–15 letters for comparison with current bingo discovery.

| Minimum armour capacity | Candidate enemy spellings |
| --- | ---: |
| No minimum | 453 |
| At least one point | 264 |
| At least two points | 75 |
| At least three points | 11 |
| At least four points | 1 |

These 453 enemies correspond to 795 pairs. All 795 were independently checked with the existing TypeScript source API and armour allocator. Forms inherit a lemma sense; grammatical fit, sense familiarity, derivatives and spelling variants still need editorial review. The 453 count does not establish 453 distinct enemy concepts or playable boards, and it does not establish enough survivors for 365 good puzzles.

The current bingo discovery thresholds are lower for enemies too (Zipf ≥ 2.4). Applying those and allowing other-lemma inflections gives 578 enemy spellings with 7–15-letter answers, 341 with at least one armour point, and 102 with at least two. A separate broader mode permitting one direct adjective-similarity edge raises those counts to 646 / 382 / 117. That last mode is a near-synonym candidate search requiring review, not evidence of exact synonymy; it must not be silently merged into the strict results.

Assessment: a year of unique enemies **with two armour points on every puzzle is not supported by these scans**. Variable armour gives a larger pool worth testing, but the required semantic review and good independent two-/three-word routes will remove candidates. Reusing an enemy with a new board could increase the number of puzzles; it would not establish a year of fresh enemy words. Broader reviewed synonym sources might add candidates, but that increase has not been measured here.

Subsequent user clarification: **armour need not be present, provided the bingo is not a trivial synonym**. The two-armour condition is therefore not a requirement for the proposed design. The relevant next assessment is available difficulty and route quality with optional armour.

The comparison is reproducible, read-only, and uses the same pinned inputs as the original scan:

```sh
python3 artifacts/synonym-bingos-2026-09-28/year-sensitivity.py
```

[year-sensitivity.json](year-sensitivity.json) stores the complete matrix for lemma-only versus other-lemma forms, exact synonymy versus one adjective-similarity edge, both answer-length ranges, three frequency policies and armour minimums 0–4. It counts unique enemy spellings and pairs separately. There is no live game or generator change.

## Examples worth examining

These examples pass source synonymy and letter/armour checks. They have not had boards, refills or difficulty ladders generated.

| Enemy | Synonym covering all letters | Sense to use | Letters that can take armour |
| --- | --- | --- | --- |
| SANE | REASONABLE | Showing sound judgment | A, E |
| LIT | ILLUMINATED | Provided with artificial light | I, L |
| NOISE | DISSONANCE | Unpleasant or unmusical sound | N, S |
| STERN | RELENTLESS | Unyielding; not easily appeased | E, S |
| PRIME | PREMIER | First in rank | E, R |

Sense labels matter. SANE → REASONABLE uses the judgment sense, not a claim that every use of those words is interchangeable. NOISE → DISSONANCE uses disagreeable sound, not arbitrary sound. The all-sense census also contains weak gameplay candidates, rare senses of common words, spelling variants and related derivations; these require editorial rejection or review.

Examples for the follow-up request, where armour is optional:

| Enemy | Possible bingo | Shared sense |
| --- | --- | --- |
| REST | RESPITE | A break or pause |
| FICTION | FABRICATION | An invented, false account |
| SURPLUS | SUPERFLUOUS | More than needed |
| DEBATE | DELIBERATE | Consider or discuss carefully |
| CURSE | SCOURGE | Something causing misery |
| ETERNAL | INTERMINABLE | Seemingly endless; tiresomely long |

All six have exact source-synset evidence and full enemy-letter multiset coverage in the original candidates artifact. None needs armour to qualify for a hypothetical bingo. SURPLUS also shares its source sense with EXTRA, SPARE, EXCESS and REDUNDANT; those are potential shorter plays, not a verified two-/three-word route. The examples do not change current gameplay, which still uses the existing counter rules.

## Design implications

- Direct synonym damage gives players one visible semantic target. A separate opposite word or weakness clue would not be necessary.
- The physical bingo requirement survives: a valid synonym still has to clear every enemy position and its armour.
- A prototype needs an explicit rule against playing the enemy itself or merely inflecting it. Every bingo board necessarily contains the enemy's unarmoured letters, so self-matching would be a predictable shortcut. The scan excludes non-lemma forms; that is not an implemented game rule.
- The main unproven part is preserving several accessible shorter routes. A promising bingo pair alone does not establish this.
- Exact synonym sets are intentionally narrow. Ordinary near-synonyms can live in different sets, so these counts are neither an exhaustive English-language total nor a ceiling on good puzzles. Expanding a reviewed vocabulary may help, but unrestricted graph expansion would reintroduce uncertain semantic judgments.
- Two armour points are an optional design filter, not a requirement imposed by this report. Requiring them sharply reduces this strict candidate pool.

## Reproduce and inspect

```sh
python3 scripts/assess-synonym-bingos.py --output artifacts/synonym-bingos-2026-09-28
```

The script uses the standard library, needs no network or model, and writes only the requested research directory. Without `--output`, it prints the summary and writes no files. The run took about 1.3 seconds locally, excluding this write-up and independent verification.

- [summary.json](summary.json): exact scope, source hashes, policy and counts.
- [candidates.json.gz](candidates.json.gz): all 1,594 full-coverage pairs, source sense IDs/definitions, frequencies, armour capacity and same-sense alternatives.
- [Assessment script](../../scripts/assess-synonym-bingos.py).

All 1,594 retained pairs were independently checked through the repo's existing TypeScript source and familiarity APIs and `bingoArmour` allocator. This verifies lexical evidence and letter arithmetic; no battle routes were certified.

Derived source data: [Open English Wordnet](https://en-word.net/), 2025 release, by the Open English Wordnet contributors, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This report groups admitted lemmas and filters them by letter overlap; definitions and sense IDs retain the source evidence. See the repo's [source attribution](../../src/lexicon/ATTRIBUTION.md) for the pinned release and transformations, and [wordfreq attribution](../../docs/wordfreq-notice.md) for the familiarity data.
