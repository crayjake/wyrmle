# Definition coverage and CHAOS meaning correction

September 25 now uses **CHAOS v11** with the same physical board, 20 refills, five lives, armour and special tiles as v10. It fixes two different authoring failures: missing dictionary entries and missing reviewed semantic relationships. The [original v10 review](meaning-first-review.md) remains a historical record.

## WHERE: missing vocabulary

WHERE never reached classification because the OEWN-only validity dictionary omitted it. The coverage audit enumerated that reduced dictionary completely, which did not reveal omissions from everyday English. WordNet explicitly excludes several grammatical categories; see its [FAQ](https://wordnet.princeton.edu/frequently-asked-questions). Treating this semantic resource as a complete playing dictionary was the mistake.

The merged dictionary now contains **116,395 definition-backed spellings**, adding **198** to the original 116,197. A pinned Wiktionary import covers articles, conjunctions, determiners, particles, prepositions, pronouns, interrogative/relative adverbs and auxiliary/modal verbs, with a closure over explicitly attested auxiliary forms. WHERE, THE, AND, HOW, HER, SHE, HIM, YOU, WITH, WOULD, COULD, SHOULD and SHALL are covered. Definitions come from that same source; the game never admits a spelling and invents its meaning afterward.

The supplement preserves all eligible senses and exact source evidence, including alternative-form reference paths. Rebuilds are offline and checksum-pinned. An independent **191-word everyday vocabulary audit** now runs in the tests, alongside source integrity, placeholder rejection and reference-cycle checks. The audit list is not a runtime allowlist. [Source, licence and import policy](../src/lexicon/FUNCTION_WORDS.md) document the complete extraction and its limits.

WHERE does not fit today's CHAOS letter supply because it contains no W. It is now defined and works when the physical letters are available; the DEV inspector distinguishes this from a missing dictionary definition or an incomplete compiled table.

## CALM: incorrect default classification

CALM was already found, defined and stored. Its selected OEWN sense was correctly about keeping composure, but the CHAOS profile only covered some disorder/order families and omitted calmness. The compiler therefore assigned the default neutral classification. The solver simulated that label correctly; the error was in the semantic input to the solver.

CHAOS now uses `semantic-profiles-v2-chaos`, adding reviewed calmness, composure, quiet, tranquility, peace, relaxation and coherent arrangement concepts. Bounded source relationships expand each concept into its word family. **156 formerly neutral spellings become counters globally**, including CALM, CALMER, CALMNESS, SERENE and COHERENT. There are **33 new counters** within today's supply. Another 11 existing daily counters retain their classification with more direct evidence. The other five enemy profiles are unchanged.

The review pins specific senses and excludes drift into weather, physical stillness, sedation or political opposition to war alone. A spelling such as COOL uses its composure sense when it counters CHAOS; this does not claim that cold temperature opposes disorder. The [complete semantic correction report](../artifacts/meaning-v2/semantic-corrections.json) retains the old and new records. Tests cover both expected counter families and excluded meanings.

## Regenerated publication and proof

The new frozen table contains **29,719 words**: the original table plus **72 newly defined words**, with the reviewed semantic corrections above. Gameplay, preview, terminal-word detection, generation and solving use this same stored table. No dictionary or LLM calls run during play.

All **3,060 opening spellings and 8,041 physical selections**, producing **5,493 distinct successor states**, have a replayed familiar winning continuation. There are zero unsafe and zero unknown first moves. The v10 certificate was used only as a source of suggested continuations; v11 was enumerated and certified again against its own rules and fingerprint. Tests independently enumerate every selection and replay every proof line.

The broader bounded review retains 30 winning routes, including 10 with later play on a depleted board. Generation quality is 82.01 and difficulty remains **MEDIUM (estimate)**. Three words is a winning upper bound, not a proved minimum. The exhaustive first-word guarantee does not apply to arbitrary later choices; the broader sampled fairness review still has one unresolved state.

The [selected review and certificate](../artifacts/meaning-v2/selected.json.gz), [summary](../artifacts/meaning-v2/summary.json) and [replayed walkthroughs](../artifacts/meaning-v2/walkthroughs.json) contain exact evidence. The publication stores only changed/new meaning records over the immutable v10 base; decoding reconstructs the exact certified table without inference or a second full dictionary download.

Unfinished games upgrade only when replaying every past turn and Undo position gives identical results. Completed results stay archived. If a previously played CALM would now score differently, **Settings → Beta tools → Reset puzzle** starts the corrected version explicitly. [Save compatibility details](meaning-vocabulary-upgrade.md) explain this boundary.

Validation passes: **484 Node tests**, the independent Python importer checks, typecheck, lint and production build. [Browser evidence](../artifacts/meaning-v2/browser-qa.json) confirms CALM's counter preview, playing AND, saving/reloading v11 and the production icon metadata. The 375×629 check uses Chromium touch emulation, not physical iPhone Safari.

## What remains a semantic judgement

Full spelling/definition coverage is different from full semantic assessment. Current classifications still use reviewed concept profiles, and a default neutral record means no reviewed relationship matched. The DEV inspector now says this explicitly. This pass does not claim an individual LLM assessment of every stored word.

An offline LLM review can assess all candidate words against the exact enemy definition, retaining chosen source senses, classifications and reasons before solving. Pretrained vectors such as [ConceptNet Numberbatch](https://github.com/commonsense/conceptnet-numberbatch) can rank likely relationships, but cosine closeness alone cannot decide counter versus reinforcement: synonyms and antonyms can occupy similar contexts. Research on [distinguishing antonyms from synonyms](https://aclanthology.org/E17-1008/) addresses that distinction directly. Such a future stage needs a recorded model/version, complete assessment coverage, calibrated examples and fresh solver proofs; it must not present unassessed defaults as reviewed conclusions.
