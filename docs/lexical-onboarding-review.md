# Lexical and onboarding review

## Why valid words were missing labels

Word validity, word discovery and word metadata were three different systems.
The accepted dictionary contains 274,937 spellings, but generated encounters
only carried 483 authored POS annotations. On DESPAIR's opening board, full
discovery finds 5,969 distinct spellings and 17,178 physical selections. Only 82
of those spellings had an old POS annotation. The bounded solver's default
1,600-selection / 64-retained-move search is not a complete list of legal words.

DIRTY was legal but unannotated. Also, the old grammar rule rejected every word
with multiple parts of speech, so merely adding adjective/verb metadata would
still not have awarded an adjective bonus. The new opt-in rule allows any
recognized use to qualify, chooses the best applicable modifier once, and never
stacks several word types. Old snapshots retain their original behavior.

WORRY was already explicitly marked related to DESPAIR. Related and unlisted
words both play as neutral; WORRY is not a synonym for hopelessness. The UI now
distinguishes a known related meaning from an unlisted semantic fallback.

## Reproducible classification before search

`src/lexicon` contains a frozen Open English Wordnet 2025 lookup, dictionary-
filtered regular inflections, source/dictionary SHA-256 checksums, per-POS
evidence and attribution. Rebuild with `scripts/build-lexicon.py`; see its help
and `src/lexicon/ATTRIBUTION.md`. The current dataset covers 116,197 accepted
spellings. Other words remain explicitly unknown. WordNet is sense-based and
does not supply exhaustive semantic judgements for every dictionary spelling.

The data supplies all four supported word types, retaining ambiguity. Enemy
semantic additions use selected noun senses and direct lexical relationships;
authored gameplay relationships take precedence. No individual DIRTY or WORRY
exception was added.

New encounters pin `lexicalRules.version` and a grammar policy. Runtime preview,
actual play, solver summaries, construction and mutation use the same lookup.
Old encounters without that field preserve saved previews and replays exactly.

Before bounded solving, `auditEncounterLexicon` independently scans the complete
dictionary. It labels every opening spelling and every spelling supported by
the complete refill-supply multiset. That latter collection is an optimistic
superset, not a claim that all its spellings occur on reachable boards. Reports
include explicit unknown POS, unlisted semantic fallback, coverage and input
fingerprints. Validation rejects absent/stale audits for new lexical rules.

```sh
npm run audit-lexicon -- --date 2026-09-25 --out artifacts/lexical-audit.json
npm run generate -- --enemy DESPAIR --regen --seed revive-review --count 10
```

Generation defaults to the new lexical rules. `--legacy` reproduces historical
seed output. Familiarity estimates are still a smaller editorial vocabulary;
absence of a familiarity rating is not evidence that a word is obscure.

## Recovery evidence

The new opening certifier enumerates all physical choices in its declared
spelling scope. Each safe result contains an actual replayed winning
continuation; proved losses and unknown searches remain separate. Checkpoints
can resume a bounded search without converting timeouts into safety claims.
Publication can require a current complete certificate, with restricted
vocabulary requiring an explicit narrower scope. See `certify-openings --help`.

The user's TILE → DAD → WHERE → ANGRY route was never dead. Full final discovery
found 35 winning spellings under v6 and 39 under v7; SHOP using the Heart O → POD
also wins. Exact replays and limitations are in `player-route-review.md`.

## Shorter tutorial and clearer language

The mandatory tutorial is now a brief introduction and two actual plays,
GLAD → SUN. Special tiles, armour, word types, resistance and long words are
optional examples. The grid uses the Daily layout, with a stable preview area
and no tutorial-only tile shrinkage or upward anchoring. A fresh browser-only
tester completed the tutorial and Daily entry on both small phone sizes.

The approach follows [NN/g's mobile onboarding research](https://www.nngroup.com/articles/mobile-app-onboarding/),
[progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
and [Microsoft's interactive-tutorial accessibility guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/109):
teach the essential action in context and make additional help available when
needed, rather than requiring a long sequence of explanatory screens.

Approved display terms are Lives, Heart tile, Hit tile, Play word, hits and
Revive. A Heart prevents that turn's life cost; it does not add a life. Internal
effect codes and saved-state fields are unchanged. The background is lighter,
definitions wrap within a narrower centered measure, and phone descriptions,
grammar labels and small HUD text are larger.

Refill-display images in `artifacts/supply-mockups` are illustrative mockups.
They do not change the queue length or reveal its order in the live game.

Lexical source: [Open English Wordnet downloads](https://en-word.net/downloads),
[WordNet's sense model](https://wordnet.princeton.edu/).
