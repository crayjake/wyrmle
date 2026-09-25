# Meaning-first gameplay and September 25 CHAOS

This records the original **CHAOS v10** (`letter-strike-7`) publication. The current [v11 coverage and semantic correction](meaning-coverage-review.md) supersedes it while preserving the same physical puzzle: five lives, 20 finite replacement tiles, an armoured A, Hit A, Life R and Revive A. Archived v10 records and proof artifacts remain unchanged.

## Why CHEERFUL failed

The former pipeline broadened part-of-speech coverage while semantic scoring still depended on small enemy-specific lists. A defined adjective could therefore receive a type bonus but fall through to Neutral meaning. CHEERFUL was missing from ANGER's counter list; knowing its grammatical category did not establish its relationship to anger.

New generation disables both grammar and length bonuses. Counters use every matching tile, neutral meanings get one normal matching hit, and similar meanings get none. Hit, Life, armour and Revive retain their existing rules. The preview leads with the meaning match and actual hits, followed only by relevant special effects or a final-life warning.

## Definitions and semantics are compiled before search

The original v10 dictionary contains **116,197 forms** from [Open English Wordnet 2025](https://en-word.net/), including source irregulars and dictionary-filtered regular forms. It rejected words without source definitions. Using OEWN alone also wrongly excluded everyday words such as WHERE, THE and AND. The [v11 correction](meaning-coverage-review.md) supplies licensed definitions for those missing categories and adds an independent everyday-vocabulary audit. Archived v10 retains its original dictionary for replay.

The offline source catalog preserves 185,129 senses, 107,519 synsets, definitions and typed relationships. [WordNet's relationships](https://wordnet.princeton.edu/) primarily connect senses within grammatical categories; they do not provide a complete gameplay counter classifier. Reviewed enemy profiles therefore pin specific source senses for counters, reinforcing concepts and related concepts. Bounded same-sense, derivational, adjective and adverb links expand those concepts. Explicit exclusions prevent unrelated readings such as physical lightness or generic diligence leaking into ANGER counters. CHEERFUL, CHEERY, happiness, smiles and laughter counter ANGER; CAREFUL remains neutral. Direct disorder families such as ANARCHY reinforce CHAOS.

The compiler exhausts the definition-backed dictionary against the physical multiset of starting and refill letters, independently of solver budgets. Every possible allowed spelling gets a stored definition, lemma, sense ID, categories, semantic relationship and reason. The supply superset is deliberately conservative: it includes all reachable spellings, without claiming every stored spelling can actually appear on a reachable board. The selected puzzle packages **29,647 records**, including all **3,041 opening spellings**.

This is a reviewed gameplay policy, not complete natural-language understanding. A neutral record means its defined senses do not match this profile's counter or reinforcing concepts; it is not proof of universal semantic unrelatedness. No runtime model, dictionary service, semantic expansion or inference runs in the game. Definition lookup and scoring use the same frozen puzzle table. Validation independently recompiles the table and rejects missing, altered or stale records. Supply mutations recompile it too.

The publication uses lossless shared-string/record packing: approximately 10.3 MB of repetitive JSON becomes 2.48 MB before compression. Unpacking preserves every value and the certificate fingerprint. Undo saves store changing positions without repeating this table; restoring a run attaches the validated immutable catalog encounter. The full lexical graph and compiler remain outside the production bundle.

## Selection and opening recovery

An exploratory batch compared ANGER, DESPAIR and CHAOS with 12–18 initial refills and Revive enabled. Final review refined the selected CHAOS construction by adding reserve C and A. A complete opening audit caught the reason for the second A: some opening words spent both starting copies while the armoured A still needed two hits.

The final certificate enumerates **all 7,999 legal physical opening selections**, covering **3,041 words and 5,465 distinct successor states**. Each has a replayed winning continuation made entirely of familiarity-rated words. There are **zero unsafe and zero unknown openings**. This includes zero-hit words, resisted words, either duplicate A, and the Revive tile. The full certificate is independent of the narrower exploratory solver beam.

The guarantee applies to the first legal word and the documented rules. It does not make every later choice safe or tell the player which continuation to choose. Familiarity ratings are editorial estimates, not measured corpus frequencies.

The deeper review retained 30 winning strategies, including 10 wins with a later move on a reduced board. Disabling semantics or Revive changes real route outcomes. The quality score is 82.62; intrinsic difficulty is **MEDIUM**, estimated from a three-word winning witness. Three words is not a proved minimum, and the 30 routes are not an exhaustive solution count.

## Replayed examples — spoilers

Exact physical tile IDs and per-turn reserve, lives and recovery values are in [walkthroughs.json](../artifacts/meaning-v1/walkthroughs.json).

| Route | Lives left | Feature |
| --- | ---: | --- |
| CLEAR → SORT → HARMONY | 3 | Three-word win using semantic counters |
| CARE → SORT → HARMONY → NEAT | 2 | Revive changes the finish |
| REACH → SORT → ANGER → SYSTEM → CHAIN | 1 | Reserve runs out before the finish |
| CHARM → SORT → ANGER → SYSTEM → HAND → CAT | 0 | Final-life, three-letter finish on a reduced board |

The selected snapshot, analysis, full certificate and search options are stored in [selected.json.gz](../artifacts/meaning-v1/selected.json.gz). The readable [summary](../artifacts/meaning-v1/summary.json) records the gates and uncertainty. The frozen snapshot is authoritative; the seed records construction origin and the mutation history records refinements.

```sh
# Reanalyse the frozen publication and its actual opening witnesses.
node scripts/review-meaning-daily.ts

# Independently repeat full opening certification against the current date.
npm run certify-openings -- --date 2026-09-25 --scope all-valid-openings --successors 10000 --seconds 300 --states 100 --out /tmp/chaos-opening-safety.json

# Exact proof replays, stale-data checks, and compact save/Undo regressions.
node --test --test-isolation=none tests/meaning-daily.test.ts tests/meaning-persistence.test.ts
```

Swipe selection now collects crossed tiles in order and can be combined with individual taps. The tutorial uses the same batched gesture path. Header spacing, `viewport-fit=cover` and installed-app bottom safe-area padding were updated. Browser checks emulate phone dimensions; they do not claim actual iPhone Safari performance measurements.

Final verification: **461 tests pass**, including replaying all 7,999 opening selections. Typecheck, lint and production build pass. Touch gameplay, save/reload/Undo, three-word and final-life wins fit at 375×629 and 320×568 without overflow. Installed-app safe-area checks use an explicitly labelled CSS simulation. [Phone evidence and screenshots](../artifacts/meaning-v1/phone-qa.json) record those limits. A six-turn durable save is 39,470 characters, without repeated definition tables.
