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
