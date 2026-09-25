# Offline semantic assessment

Puzzle authoring starts with two local, pinned CPU models: **all-MiniLM-L6-v2** for definition similarity and **nli-deberta-v3-xsmall** for directional entailment. A separate contextual language-model review refines each publication's eligible vocabulary. There is no inference service, model download or meaning lookup during play. The browser receives the puzzle's frozen definitions, classifications and assessment evidence.

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

Vectors retrieve candidate source senses through three inputs: lemma with definition, definition alone, and lemma alone. A spelling's meaning is not assigned from vector distance alone. Contextual review includes every novel NLI scoring decision and neutral spellings with an unexcluded source sense reaching the frozen retrieval threshold. Reviewed source classifications and bounded source proofs retain the explicitly documented precedence policy.

The local language model receives the enemy concept and the qualified licensed source senses. It chooses a relation and source sense, with an explanation retained in the authoring evidence. One input can be shared by inflected spellings with the same sorted sense set. Every spelling still independently pins its base assessment. Invalid, missing or stale results cannot satisfy publication readiness.

The contextual cache is a memo of actual inference, not a claim that a language model reviewed the entire dictionary. `compilePuzzleMeanings` can produce drafts while reviews are incomplete. Final review and packaging require `isMeaningPublicationReady` and independently enumerate the complete spelling superset from the physical tile supply. Every eligible spelling in that inventory must have a matching successful review before the final solver and opening certificate can be accepted.

The published header retains the full-dictionary base model provenance and a separate `refinement` record with the contextual model, prompt, eligibility policy, inventory digest, reviewed subset digest and coverage counts. Per-word numeric scores remain base NLI evidence; `decisionBasis` distinguishes contextual decisions. Unrelated memo additions do not change an already reviewed puzzle's fingerprint. A change to its selected senses, labels, definitions, evidence or applicable model policy requires recertification.

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

Run the independent benchmark before accepting an inference-policy change. Recompile candidates, rerun solver/quality review, and produce a new full opening certificate before packaging a daily. A certificate for previous meanings cannot certify new meanings, even if the physical board is identical. `package-assessed-daily.ts` independently enumerates and replays the submitted certificate before writing publication files.

The contextual authoring boundary has two additional commands. `package-semantic-refinement.ts` verifies the source export, complete retrieval artifacts, frozen prompt/policy manifest and actual per-word memos before producing the authoring overlay. `export-semantic-refinement-requests.ts` exports the exact eligible inputs for an inventory, including the JavaScript base-record digests; the local inference runner must preserve those digests rather than reconstructing floating-point JSON independently.

Played and completed archived games keep their original frozen rules. A new assessment publication is a new puzzle version, not a silent change to existing turn history.

### GPU inference and interruption-safe local runs

`contextual-assets.json` pins the model weights and both CPU and Vulkan builds of `llama.cpp`, including URLs, file sizes and SHA-256 hashes. Vulkan supports the author's Radeon RX 9070; CUDA is not required. The checked runtime offloads all model layers to the GPU. The driver and GPU must be accessible to the process. Model weights stay outside Git and the browser build.

Start the local server in one terminal (initial downloads need network access):

```sh
python scripts/semantics/serve.py --download
```

The default is Vulkan on `127.0.0.1:8089`. `--backend cpu` selects the slower CPU runtime on port 8088. Both bind only to localhost. Later starts omit `--download`; assets are checksum-verified before execution. `--cache PATH` controls their location. The process stays in the terminal and Ctrl-C stops it.

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

`refine.py` runs without an assistant session. Rerunning the exact command reuses completed, verified inputs and resumes missing ones. Raw responses, validation retries, source choices and request digests are saved per input; the word-level output checkpoints every 20 completions. Valid semantic decisions are never resampled to obtain a preferred answer. Failed outputs remain failures unless explicitly retried with `--retry-errors`; previous attempts are retained. Changing the model/prompt/policy requires a new output memo directory.

Repackage using the populated memo directory, evaluate the frozen independent quality gates, then fresh-compile and certify the physical candidate using `scripts/prepare-assessed-openings.ts`. The [compact candidate's authoring notes](../artifacts/semantic-assessment/compact-candidate/README.md) contain its exact replay command. Old witnesses are only search hints: they must all replay successfully under the final frozen meanings before publication. Inference completion alone does not publish a daily.

For durable unattended work, substitute a persistent work directory for the example `/tmp` paths. Keep the model server running while `refine.py` works; GPU inference does not depend on this chat staying open.

## Primary references and licenses

- [Sentence Transformers semantic similarity documentation](https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html).
- [Retrieve and re-rank architecture](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html).
- [Pinned MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/blob/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/README.md) and [pinned DeBERTa NLI model card](https://huggingface.co/cross-encoder/nli-deberta-v3-xsmall/blob/a150876415327c80daeff35ca6f68f5ed8cf5c24/README.md), Apache-2.0. Exact file hashes are in `scripts/semantics/model-lock.json`.
- [OEWN source documentation](../src/lexicon/ATTRIBUTION.md) and [Wiktionary supplement provenance and attribution](../src/lexicon/FUNCTION_WORDS.md). Stored source wording retains its original license and provenance.
