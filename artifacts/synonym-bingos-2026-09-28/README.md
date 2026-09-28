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
