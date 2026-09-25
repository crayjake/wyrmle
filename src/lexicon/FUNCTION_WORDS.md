The function-word supplement fixes a known boundary of Open English Wordnet:
WordNet deliberately omits closed-class words, including many pronouns,
determiners, conjunctions and prepositions. It is a semantic lexicon rather than
a complete English spelling dictionary. See the [WordNet FAQ](https://wordnet.princeton.edu/frequently-asked-questions).

`data/function-words-v1.json` contains definitions by **English Wiktionary
contributors**, extracted by [Kaikki / Wiktextract](https://kaikki.org/dictionary/English/index.html).
The dictionary content and this derived supplement are available under
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
Individual records link to their Wiktionary source pages and retain upstream
sense IDs where provided. Per-word exports without IDs instead retain an exact
source SHA-256 plus entry/sense-position locator. Those pages also link to contributor histories. Wiktionary's original
entry text is additionally available under the GFDL; this project distributes
the extracted definitions under CC BY-SA 4.0. See
[Wiktionary's copyright information](https://en.wiktionary.org/wiki/Wiktionary:Copyrights).
The same attribution and license apply to these definitions when copied into
published puzzle records. This data license does not change the license of
unrelated game code or artwork.

The import uses the complete article, conjunction, determiner, particle,
preposition and pronoun partitions, plus adverbs tagged interrogative or
relative and verbs tagged auxiliary or modal. This is a category-based repair
rather than an exception for WHERE.
It covers WHERE's interrogative and relative adverb senses as well as its
conjunction and pronoun senses, and HOW's question adverb senses. It does not
claim to import the entire Wiktionary dictionary or every sense outside those
categories. The importer also follows explicitly attested auxiliary-verb forms
which are still absent from the merged dictionary, downloading their own complete
entries rather than creating definitions by inflection. The pinned snapshot
contains all twelve such source entries. For example, COULD is explicitly listed
under CAN but its own entry lacks an auxiliary tag. Its full source definitions
are retained, including its conditional uses. The import verifies that the
form-entry downloads exactly cover the systematic closure; their filenames are
source pins, not a manually chosen acceptance list.

The pinned input was extracted on **20 September 2026** from the **2 September
2026** English Wiktionary dump and downloaded on **25 September 2026**.
All 22 exact download URLs, sizes and SHA-256 checksums are recorded in
`data/function-words-v1-metadata.json`. These postprocessed Kaikki endpoints are
deprecated upstream, so rebuilds do not depend on their future availability.
The committed `data/function-words-source-v1.json.gz` is a deterministic,
checksum-pinned projection of those inputs. It retains headwords, parts of
speech, glosses, sense IDs or locators, usage tags and explicit form references. Usage
quotations, translations, recordings and illustrations are excluded.

Selection intersects alphabetic source headwords with the pinned existing game
spelling list. It never invents inflections. Senses tagged archaic, obsolete,
nonstandard, proscribed, misspelling, pronunciation-spelling, dated or historical
are excluded. Other usage tags, including dialectal, informal, regional and
rare, remain attached to their source senses; excluding those would remove
valid English variants already in the spelling list. A word with another
eligible sense remains available.

Missing or placeholder definitions are rejected. An upstream extraction warning
alone does not discard a complete glossary definition: for example THIS has
`error-lua-timeout` tags but complete English glosses, checked against its
[Wiktionary entry](https://en.wiktionary.org/wiki/this#English). The warning is
retained for review. Alternative-form and inflected-form definitions require
an acyclic same-part-of-speech path to a concrete source definition. Exact
original glosses and the resolved source evidence remain available. A reference
without a resolvable definition is excluded.

Every eligible source sense is retained. A deterministic display preference
puts direct, less restricted senses first, then chooses adverb, pronoun,
article, determiner, conjunction, preposition, particle, verb, preserving source entry
and sense order within each class. This is a display policy, not an asserted
frequency ranking. No semantic enemy bonus is inferred from grammatical POS.

The supplement contains **462 headwords and 1,513 senses**, including **198
spellings absent from the previous definition-backed dictionary**. Existing
OEWN records are preserved when dictionaries are merged. The importer checks
191 everyday words and grammatical words as a coverage regression; that list is an audit,
not the source of accepted words.

Rebuild offline from the committed source projection:

```sh
python3 scripts/build-function-words.py
```

To verify/recreate the projection from the exact original downloads,
save them as `article.jsonl`, `conj.jsonl`, `det.jsonl`, `particle.jsonl`,
`prep.jsonl`, `pron.jsonl`, `interrogative.jsonl`, `relative.jsonl`,
`auxiliary.jsonl`, `modal.jsonl` and the twelve `form-<word>.jsonl` files named
in the metadata, then run:

```sh
python3 scripts/build-function-words.py --source-dir /path/to/pinned/downloads
```

Both forms reject changed source hashes. An upstream update requires an explicit
new version and coverage review; normal game builds and gameplay perform no
dictionary network requests.

The normal `npm test` suite independently checks the 191-word baseline, source
and export hashes, all sense identities, and every resolved form reference.
The Python importer has separate fixture checks for missing definitions,
placeholder glosses, obsolete senses and circular or unresolved references:

```sh
python3 tests/test_function_word_import.py
```
