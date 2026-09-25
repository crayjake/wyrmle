This directory contains derived data from **Open English Wordnet 2025**,
published by the Open English Wordnet contributors and the Global WordNet
Association under **Creative Commons Attribution 4.0 International**.

- Project: https://github.com/globalwordnet/english-wordnet
- Downloads: https://en-word.net/downloads
- License: https://creativecommons.org/licenses/by/4.0/
- Source archive: https://en-word.net/static/english-wordnet-2025.xml.gz

Changes made for WYRMLE: extract supported parts of speech and explicit forms;
intersect spellings with the existing game dictionary; add conservative regular
inflections; combine all categories for each spelling; encode category bit masks;
extract direct relations from six selected enemy noun senses. The source archive
and dictionary SHA-256 hashes, coverage counts, and transformation policy are in
`data/oewn-2025-metadata-v1.json`. Relation evidence identifies exact source senses
in `data/oewn-2025-relations-v1.json`.

Rebuild after explicitly downloading the archive:

```sh
python3 scripts/build-lexicon.py /path/to/english-wordnet-2025.xml.gz
```

The data does not cover every word in the game's larger validity dictionary.
Missing POS is unknown. Missing semantic links are unknown, not evidence that
words are unrelated. Synonyms share only the configured noun sense; antonyms
must have a direct sense link; derivations are related, not automatically synonyms.
This avoids mixing physical chaos with disorder, reverential fear with danger,
or the historical bodily-humour meaning of melancholy with sadness.

Inflection does not invent adjective readings for participles or adverb readings
for words ending in `ly`. Noun plurals, verb inflections and regular adjective
comparatives use spelling rules and must also exist in the game dictionary.
OEWN explicit forms retain irregulars. One-vowel-group consonant doubling is
conservative; unknown stress patterns and uncovered irregular forms remain unknown.
Every supported part of speech is preserved, including ambiguous words.

The separate **`oewn-2025-meanings-v1`** catalog retains all source lexical
entries, senses, synset definitions, sense relations and synset relations.
Non-game entries remain in the relation graph so references resolve correctly.
Spellings accepted by the game are indexed to every applicable source sense;
lemma, explicit irregular-form and inferred regular-form evidence remain
distinct. No missing definition is manufactured, and the catalog does not
classify a word as neutral merely because it has no direct enemy relation.
Its source and dictionary checksums, exact coverage and compressed artifact
checksum are recorded in `data/oewn-2025-meanings-v1-metadata.json`.

The Node-only authoring API is `scripts/lib/wordMeanings.ts`. It loads the
compressed catalog offline and exposes exact senses, definitions, relations
and missing coverage. This full catalog is not a browser import. Puzzle
compilation must retain the applicable evidence and reviewed classification in
the published puzzle rather than looking up meanings during play.

```sh
python3 scripts/build-word-meanings.py /path/to/english-wordnet-2025.xml.gz
```

The dictionary remains larger than OEWN: this catalog covers 116,197 of its
274,937 spellings (63,750 directly attested and 52,447 morphology-only).
The other 158,740 spellings are explicitly missing. Source definitions do not
by themselves prove a game-specific opposition; synonym, antonym, derivation
and broader concept relations must keep their distinct meanings, as documented
in the [Global WordNet schema](https://globalwordnet.github.io/schemas/).

`data/meaning-dictionary-v1.json` is a compact, browser-safe export for the new
definition-backed validity rules. It contains 116,197 spellings and 47,383
deduplicated display definitions. Every spelling retains its display sense ID,
source lemma and all supported parts of speech. The first source sense is only
a display fallback; semantic compilation uses all senses and stores the
specific matched sense for a meaning bonus. Source sense order is preserved
within an entry; OEWN does not provide an overall frequency ranking across all
parts of speech for a spelling.

The original OEWN-only dictionary omitted common grammatical words such as
WHERE, THE and AND. That coverage gap is repaired by the separately pinned
[Wiktionary function-word supplement](FUNCTION_WORDS.md). The merged
`wyrmle-defined-dictionary-v2` preserves existing OEWN entries and adds licensed
definitions for missing spellings. Importing whole grammatical categories and
auditing an independent everyday-word corpus avoids a word-specific allowlist.
Published puzzles retain each selected source sense and source identifier;
archived v10 data keeps its original dictionary for historical replay.

`data/semantic-profiles-v1.json` contains the offline game judgements, generated
from reviewed, sense-pinned concepts in `scripts/lib/semanticProfileRoots.ts`.
For example, good spirits are an authored counter-concept to ANGER; the file
does not claim that OEWN labels CHEERFUL as a direct dictionary antonym of ANGER.
Every non-neutral record stores its exact source sense, definition, lemma,
reviewed concept root and the complete lexical path used to reach it.
Synonyms stay inside a source synset. Expansion permits one derivation before
one adjective-head-to-satellite similarity edge, exact adverb pertainyms and
explicitly approved core antonyms. Reviewed exclusions reject drift into broad
physical, financial or precision senses. No hypernym search or word-ending
guess supplies a meaning relation. Unmatched defined words receive no meaning
bonus under this policy; this is not a universal claim that their meanings are
unrelated in every context.

```sh
node scripts/export-meaning-dictionary.ts
node scripts/build-semantic-profiles.ts
```

All compilation happens before publication. The published encounter freezes
definitions and classifications for its whole possible letter supply, and the
game reads those stored records without querying a dictionary or model.

The optional publication transport in `src/game/meaningPacking.ts` deduplicates
strings, POS lists and identical records. Its separately versioned decoder
restores every definition, source sense, classification, reason and evidence
field without semantic inference. It preserves the compiler's JSON field order
so packing does not change an encounter's certificate fingerprint. Decoded
records are immutable; invalid versions, indices and enum values are rejected.
