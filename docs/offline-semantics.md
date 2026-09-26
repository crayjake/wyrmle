# Offline semantic assessment

Puzzle authoring starts with two local, pinned CPU models: **all-MiniLM-L6-v2** for definition similarity and **nli-deberta-v3-xsmall** for directional entailment. A checksum-pinned Qwen3.5-9B contextual language-model review refines each publication's complete supply vocabulary. There is no inference service, model download or meaning lookup during play. The browser receives the puzzle's frozen definitions, classifications and assessment evidence.

## What was wrong

The previous compiler already enumerated all definition-backed spellings that fit the board plus refill supply. Its semantic profile was sparse: a spelling absent from the profile became `defined-neutral`. Finding every spelling did not mean assessing every spelling's meaning. This particularly missed ordinary counters outside the reviewed synonym/derivation paths.

The new compiler has no such fallback. An enemy must have an offline base assessment cache covering exactly the accepted dictionary, and each applicable word must have a source sense, classification and finite assessment scores. Missing or stale base assessments stop authoring. Solver search limits cannot truncate semantic coverage. Base assessment coverage does not establish contextual judgement quality: draft search and publication readiness are separate checks.

## Source coverage and scoring

`export-semantic-source.ts` exports **116,395 spellings**, **244,273 word-to-sense references**, and **112,646 distinct applicable senses**. Open English Wordnet supplies the base; the licensed Wiktionary supplement supplies admitted words absent from that source, including grammatical words. Every chosen definition must belong to that spelling's source senses. The exporter preserves the existing dictionary instead of changing word acceptance to fit the model.

Each distinct source sense is embedded once, using its lemma and definition. Both counter and reinforcing concepts are assessed separately. The second model checks retrieved definition pairs because close vectors can represent antonyms as well as synonyms. Exact reviewed scoring senses retain source-backed precedence; the model also discovers relations outside those reviewed entries. Source senses and exclusions remain inspectable, and neutral is a measured policy outcome rather than an absence of assessment.

Directed source proofs supplement model inference: a candidate sense can reach an approved concept through at most two source links. These can be WordNet `hypernym`, `entails` or `causes` links, optionally preceded by an explicit verb-to-state/event noun role (which consumes one of the two hops). Agent, instrument and generic derivation links do not qualify. Sharing an ancestor is insufficient; traversal must go from the candidate to the approved concept. These paths and the decision basis remain in the offline evidence. Reviewed exclusions prevent known broad or misleading senses from controlling a decision, including intermediate concepts. A source-backed classification can disagree with the statistical model, so the selected decision basis is shown separately from model scores in DEV inspection.

The pinned model files and tokenizers are checksum-verified. Configuration, source, vector and output digests accompany the offline results. Four-decimal scores and the selected source sense are packaged deterministically into an authoring cache. Each generated puzzle then freezes just the spelling superset possible from its complete physical supply. The same frozen table controls preview, submission, solver move discovery and exhausted-board detection.

Scores describe this model/policy's evidence; they are not calibrated probabilities that a human will agree. Multiple senses can compete. Independent tests include ambiguity cases and words outside the old profiles; measured limitations are recorded in the [benchmark report](semantic-benchmark.md).

Hypernym inheritance into a `noun.group` anchor cannot independently classify polarity. A series of unpleasant events is a collection, but being a collection does not make it a counter to CHAOS. Such paths fall through to the statistical/contextual assessment; direct reviewed and same-synset evidence remains eligible. This is a lexical-domain rule, with no spelling-specific exceptions.

## Contextual review before publication

Vectors retain three diagnostic similarity channels: lemma with definition, definition alone, and lemma alone. New publication reviews every word and every dictionary sense in the complete physical supply, including low-similarity neutrals and previously trusted source decisions. No similarity cutoff or source-proof exemption may bypass contextual review. The exhaustive manifest records `reviewScope: all-source-senses`, threshold `-1`, and no trusted-decision exemptions; packaging checks exact sense-set equality against the source export. Historical filtered manifests remain readable for reproducing old experiments but cannot authorize new publication.

The local language model receives the enemy concept and the complete licensed source sense set. It chooses a relation and source sense, with an explanation retained in the authoring evidence. One input can be shared by inflected spellings with the same sorted sense set. Every spelling still independently pins its base assessment. Invalid, missing or stale results cannot satisfy publication readiness.

The contextual cache records actual inference for the full puzzle vocabulary, not a claim that the model reviewed the entire dictionary. `compilePuzzleMeanings` can produce drafts while reviews are incomplete. Final review and packaging independently enumerate the spelling superset from the complete physical tile supply. Every spelling, with all its source senses, must have a matching successful review before the final solver and opening certificate can be accepted. A neutral decision displays its actual reviewed sense, just as a scoring decision does.

The published header retains the full-dictionary base model provenance and a separate `refinement` record with the contextual model, prompt, eligibility policy, inventory digest, reviewed inventory digest and coverage counts. Per-word numeric scores remain base NLI evidence; `decisionBasis` distinguishes contextual decisions. Unrelated memo additions do not change an already reviewed puzzle's fingerprint. A change to its selected senses, labels, definitions, evidence or applicable model policy requires recertification.

Source quality also varies. A few original WordNet glosses are fragments; their sense identifiers and directed source context remain available, but a nonempty source definition is not a claim that every dictionary gloss is well written. Source wording is retained rather than silently invented by a model.

## Reproduce the authoring step

Use a Python virtual environment outside the repository. `--download` explicitly obtains the pinned Apache-2.0 model assets on the first run; subsequent inference is local and can run without network access. The model files and reusable vector cache are not shipped with the game.

```sh
uv venv /tmp/wyrmle-semantic-venv
uv pip install --python /tmp/wyrmle-semantic-venv/bin/python -r scripts/semantics/requirements.txt
node scripts/export-semantic-source.ts /tmp/wyrmle-semantic-source.json
/tmp/wyrmle-semantic-venv/bin/python scripts/semantics/infer.py /tmp/wyrmle-semantic-source.json --cache /tmp/wyrmle-semantic-cache --output /tmp/wyrmle-semantic-results --enemies ALL --download
node scripts/package-semantic-cache.ts /tmp/wyrmle-semantic-source.json /tmp/wyrmle-semantic-results src/generator/data/semantic-assessments-v1.json
```

Run the semantic quality gates before accepting an inference-policy change. Daily review and packaging collect actual current provider output and require 100% label accuracy, 100% required-source-sense accuracy, zero neutral false positives, and complete exhaustive review across primary, development, confirmation and later diagnostic regression sets. Historical thresholds and first-run reports remain unchanged in the archive. A saved passing report cannot authorize changed model inputs. Recompile candidates, rerun solver/quality review, and produce a new full opening certificate before packaging a daily. A certificate for previous meanings cannot certify new meanings, even if the physical board is identical. `package-assessed-daily.ts` independently enumerates and replays the submitted certificate before writing publication files.

The contextual authoring boundary has two additional commands. `package-semantic-refinement.ts` verifies the source export, complete retrieval artifacts, frozen prompt/policy manifest and actual per-word memos before producing the authoring overlay. `export-semantic-refinement-requests.ts` exports the exact eligible inputs for an inventory, including the JavaScript base-record digests; the local inference runner must preserve those digests rather than reconstructing floating-point JSON independently.

Played and completed archived games keep their original frozen rules. A new assessment publication is a new puzzle version, not a silent change to existing turn history.

### GPU inference and interruption-safe local runs

`contextual-assets.json` pins the model weights and both CPU and Vulkan builds of `llama.cpp`, including URLs, file sizes and SHA-256 hashes. Vulkan supports the author's Radeon RX 9070; CUDA is not required. The checked runtime offloads all model layers to the GPU. The driver and GPU must be accessible to the process. Model weights stay outside Git and the browser build.

Start the local server in one terminal (initial downloads need network access):

```sh
python scripts/semantics/serve.py --download
```

The current model is Qwen3.5-9B Q4_K_M, with non-thinking, independently cached source-sense classification and a 128-token output limit. Every sense receives its own categories-only request. Scoring proposals receive a separate direct-meaning verification request; code maps verified categories to game labels and selects a supporting source. The specification embeds and pins the first-pass classifier. The runner reuses its validated source cache or computes missing proposals, retaining both stages. Failed earlier candidates and their actual reports remain archived. The default is Vulkan on `127.0.0.1:8089`. `--backend cpu` selects the slower CPU runtime on port 8088. Both bind only to localhost. Later starts omit `--download`; assets are checksum-verified before execution. `--cache PATH` controls their location. The process stays in the terminal and Ctrl-C stops it.

In another terminal, prepare the retrieval index and a draft authoring overlay. The following continues the base-inference commands above:

```sh
/tmp/wyrmle-semantic-venv/bin/python scripts/semantics/retrieve.py \
  /tmp/wyrmle-semantic-source.json /tmp/wyrmle-semantic-results /tmp/wyrmle-retrieval \
  --cache /tmp/wyrmle-semantic-cache --audits /tmp/wyrmle-semantic-results
mkdir -p /tmp/wyrmle-word-memos
node scripts/package-semantic-refinement.ts \
  /tmp/wyrmle-semantic-source.json /tmp/wyrmle-retrieval \
  scripts/semantics/contextual-model.json /tmp/wyrmle-word-memos /tmp/wyrmle-refinement-draft.json
node scripts/export-semantic-refinement-requests.ts \
  /tmp/wyrmle-refinement-draft.json CHAOS \
  artifacts/semantic-assessment/compact-candidate/inventory.json /tmp/wyrmle-chaos-requests.json
python scripts/semantics/refine.py scripts/semantics/contextual-model.json \
  /tmp/wyrmle-chaos-requests.json /tmp/wyrmle-word-memos/chaos.json \
  --endpoint http://127.0.0.1:8089 --cache "$HOME/.cache/wyrmle/contextual-memos"
```

`refine.py` runs without an assistant session. Rerunning the exact command reuses completed, verified inputs and resumes missing ones. Raw individual source responses, validation retries, source choices and request digests are saved per input; the word-level output checkpoints every 20 completions. Valid semantic decisions are never resampled to obtain a preferred answer. Failed outputs remain failures unless explicitly retried with `--retry-errors`; previous attempts are retained. Changing the model/prompt/policy requires a new output memo directory.

Repackage using the populated memo directory, evaluate the frozen independent quality gates, then fresh-compile and certify the physical candidate using `scripts/prepare-assessed-openings.ts`. The [compact candidate's authoring notes](../artifacts/semantic-assessment/compact-candidate/README.md) contain its exact replay command. Old witnesses are only search hints: they must all replay successfully under the final frozen meanings before publication. Inference completion alone does not publish a daily.

Editorial source review follows the model pass. The versioned `semantic-source-reviews-v1.json` ledger records exact dictionary sense IDs, definitions, corrected categories and reasons. Corrections apply to every spelling carrying that sense, are pinned to the source export and model policy, and never overwrite raw model responses or substitute for missing inference. Final words distinguish `source-reviewed` decisions from `local-llm` decisions. The scoped correction digest is part of the frozen refinement identity, so changing an applicable correction invalidates the gameplay certificate. The inventory audit lists every scoring source and flags potentially missed neutral meanings for inspection; keyword matches never assign labels.

Publication also requires a matching inventory audit in `semantic-inventory-reviews-v1.json`. Every final word record is hashed, with the source, model policy and editorial correction policy pinned. New spellings or changed meanings remain drafts until reviewed and registered; passing the model benchmark alone cannot approve them. Audited subsets may be reused when a candidate changes only its physical layout or reduces its vocabulary.

For durable unattended work, substitute a persistent work directory for the example `/tmp` paths. Keep the model server running while `refine.py` works; GPU inference does not depend on this chat staying open.

## Primary references and licenses

- [Sentence Transformers semantic similarity documentation](https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html).
- [Retrieve and re-rank architecture](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html).
- [Pinned MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/blob/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/README.md) and [pinned DeBERTa NLI model card](https://huggingface.co/cross-encoder/nli-deberta-v3-xsmall/blob/a150876415327c80daeff35ca6f68f5ed8cf5c24/README.md), Apache-2.0. Exact file hashes are in `scripts/semantics/model-lock.json`.
- [OEWN source documentation](../src/lexicon/ATTRIBUTION.md) and [Wiktionary supplement provenance and attribution](../src/lexicon/FUNCTION_WORDS.md). Stored source wording retains its original license and provenance.

## Publication choice checks

Construction uses the validated contextual overlay for counter and resistance pools, including removed baseline false positives and newly discovered counters. Missing reviews still describe a draft; they cannot satisfy publication readiness. Final review enumerates every physical opening and independently replays the retained winning routes. It requires at least six familiar counter lemmas, four familiar multi-hit counter openings, four openings whose counter meaning adds hits beyond the identical neutral selection, three counter lemmas used in winning routes, and six distinct familiar winning openings. Inflections are reported separately from lemma diversity. These are explicit review thresholds, not an estimate of player enjoyment.

The review and packaging scripts share these gates. Packaging recomputes the choice audit, reruns validation, checks the current semantic benchmarks, and independently replays the full opening certificate before writing files. Played and undone saves remain pinned to their exact original table; only an untouched attempt or an explicit reset opens the current publication.


The audit workflow is explicit:

```sh
node scripts/audit-semantic-inventory.ts CACHE.json CHAOS WORDS.json AUDIT_DIRECTORY
# Inspect the scoring sources and neutral review queue; record any source corrections.
# Re-evaluate actual provider output and document the completed audit and its scope.
node scripts/record-semantic-inventory-review.ts CACHE.json CHAOS WORDS.json COMPLETED_AUDIT.json
```

The registration command verifies the completed audit's inventory size, refinement metadata and correction-policy digest before storing the exact final word hashes. It does not perform or replace editorial inspection. CHAOS has an enemy-specific neutral triage queue; other enemies queue all neutral sources until their own triage is authored.
