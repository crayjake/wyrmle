# Corpus familiarity for new puzzles

New model-assessed puzzles use **wordfreq 3.1.1**, the pinned large English corpus, to estimate how familiar a spelling is. This replaces the roughly 700-word editorial construction pool for new generation. The archived `localLexicalProvider` and `getWordCommonness` keep their old behaviour so old puzzle certificates remain reproducible.

Every one of the **116,395** accepted dictionary words was queried. **77,745** occur in the corpus list; **38,650** fall below its coverage. No accepted word is silently left without a lookup. Corpus absence is stored as the library's sentinel Zipf value zero and receives conservative familiarity zero; it does **not** mean a measured frequency of zero or that the word is invalid. Words outside the admitted dictionary return `null`.

The [official documentation](https://pypi.org/project/wordfreq/3.1.1/) defines Zipf frequency as the base-ten logarithm of occurrences per billion words. WYRMLE maps it to the existing solver's zero-to-one scale with `clamp((Zipf - 1) / 4, 0, 1)`. The familiar threshold of **0.5** therefore means **Zipf 3**, approximately once per million words. **22,470** accepted spellings meet that threshold. This is a documented construction policy, not a claim that every player knows every qualifying word.

Frequency applies to the spelling, not the selected meaning. Proper names, regional differences, specialist audiences and ambiguous senses can affect a corpus count; human review remains necessary for puzzle quality. Inflections use their own counts, without inheriting a lemma's score. The data reflects the package's historical corpus snapshot, not current popularity or a player study. Existing editorial scores are not combined with it, and there are no word-specific patches.

`meaningLexicalProvider.vocabulary()` exposes all 77,745 corpus-observed accepted words. Construction pools apply their configured minimum afterwards. `getGenerationFamiliarVocabulary(minimum)` supplies a complete thresholded vocabulary for the solver. New certificates must pass `getGenerationWordCommonness`, `GENERATION_COMMONNESS_SOURCE` and that vocabulary explicitly, then re-prove every witness under this source; legacy certificates cannot be relabelled as corpus-checked.

The [generated data](../src/generator/data/familiarity-v1.json) includes the dictionary version and SHA-256 of its sorted spelling list, exact query coverage, score policy, package hash and English corpus-file hash. Its source identifier records the package version, mapping and dictionary digest. [Attribution and data license](wordfreq-notice.md) accompany the table. All querying occurs during authoring; gameplay uses the already packaged puzzle.

To reproduce without changing the project's Python environment:

```sh
python3 -m venv /tmp/wyrmle-wordfreq-venv
/tmp/wyrmle-wordfreq-venv/bin/pip install -r scripts/familiarity/requirements.txt
node scripts/build-familiarity.ts /tmp/wyrmle-wordfreq-venv/bin/python
node --test --test-isolation=none tests/familiarity.test.ts
```

The exporter checks the installed wordfreq version and corpus bytes before querying. The Python package is installed only for authoring. Generated frequency bins are deterministic, use the upstream hundredth-Zipf precision and carry no timestamps.
