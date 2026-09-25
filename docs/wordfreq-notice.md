# Word frequency data attribution

`src/generator/data/familiarity-v1.json` is a transformed subset of **wordfreq 3.1.1**, by **Robyn Speer**, copyright 2022 Robyn Speer. Its frequency data is distributed under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This generated derivative retains that license. Changes made for WYRMLE: restrict to the admitted English dictionary, query lowercase spellings, store integer hundredths of Zipf frequency, and group words into frequency bins. The original Python package code is Apache-2.0; it is an authoring dependency and is not distributed in the game.

Official sources: [wordfreq 3.1.1 on PyPI](https://pypi.org/project/wordfreq/3.1.1/), [wordfreq repository](https://github.com/rspeer/wordfreq), [upstream attribution notice](https://github.com/rspeer/wordfreq/blob/master/NOTICE.md). The package and actual English data file are pinned by SHA-256 in [wordfreq-lock.json](../scripts/familiarity/wordfreq-lock.json).

The upstream notice credits data from:

- [Google Books Ngrams](https://books.google.com/ngrams) and [Google Books Syntactic Ngrams](https://commondatastorage.googleapis.com/books/syntactic-ngrams/index.html).
- [Leeds Internet Corpus](https://corpus.leeds.ac.uk/list.html), University of Leeds Centre for Translation Studies.
- [Wikipedia](https://www.wikipedia.org/) and [ParaCrawl](https://paracrawl.eu/).
- [OPUS OpenSubtitles 2018](https://opus.nlpl.eu/OpenSubtitles.php), originating from [OpenSubtitles](https://www.opensubtitles.org/).
- **Marc Brysbaert and colleagues**, authors of SUBTLEX-US, SUBTLEX-UK, SUBTLEX-CH, SUBTLEX-DE and SUBTLEX-NL. [SUBTLEX is freely available data](http://crr.ugent.be/programs-data/subtitle-frequencies); wordfreq's notice records permission to redistribute it for any purpose with attribution.

The English combined corpus also includes news, web text, and aggregate social-media word statistics as described in the upstream documentation. No source posts, messages, or user information are included in this derived frequency table.
