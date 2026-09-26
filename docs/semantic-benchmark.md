# Independent semantic assessment benchmark

The [version 1 fixture](../tests/fixtures/semantic-benchmark-v1.json) checks whether an offline semantic assessor produces sensible scoring labels, separately from whether the solver can win using those labels. A puzzle can be fully enumerated and solvable while its labels are wrong. Neither a winning certificate nor agreement with the existing profiles substitutes for this evaluation.

The fixture contains **144 scored word/enemy cases**: 24 each for ANGER, DESPAIR, FEAR, MELANCHOLY, CRUELTY and CHAOS. Each enemy has 12 development cases and 12 held-out cases. Six further cases record borderline policy questions without affecting headline accuracy. These are independently authored game-language judgements, not model-generated labels or a claim of objective linguistic ground truth.

Development examples may inform model settings. Holdout examples must be scored only after model, prompts, retrieval rules and thresholds are frozen. Once a holdout result has informed a change, it is a regression set for that change; a new independent holdout is needed before claiming another unseen evaluation. Do not describe all 144 as unseen examples: several development regressions deliberately repeat the user-reported failures and established game rules.

The separate [development extension](../tests/fixtures/semantic-development-extension-v1.json) adds 13 definition-backed calibration cases missed or under-classified by the legacy profiles. It was authored after the first model's aggregate result exposed poor recall beyond existing profiles. It contains no held-out words or their inflections and must never be reported as unseen evaluation evidence.

The [36-case confirmation set](../tests/fixtures/semantic-confirmation-v1.json) contains no words from either earlier fixture. Its first evaluation used the actual complete production outputs, after the main suite passed. The original fixture was frozen as SHA-256 `d80825ceb816cb613eacac83cfd387d8c1e93a2e79319355a44ded367c9744ff`; its [original bytes](../artifacts/semantic-assessment/evaluation/confirmation-original-fixture.json) and [first report](../artifacts/semantic-assessment/evaluation/role-aware-first-confirmation-report.json) remain archived. Later model iteration must not be described as another untouched confirmation.

## What the labels mean

- `opposite`: a supported sense counters the stated enemy concept. This includes the game's deliberate broader counters, such as good spirits against ANGER and composure against CHAOS.
- `similar`: a supported sense expresses or reinforces the enemy concept.
- `neutral`: neither scoring direction is justified. Existing `related` and `unrelated` runtime labels both map here because they have the same semantic hit modifier.

Every scored word must have a definition in the actual playing dictionary. Function words test neutral assessment and coverage separately from emotional vocabulary. Topical objects, possible causes, colours, occupations and mood-setting objects check that association alone does not become a bonus or penalty.

Thirty cases also constrain the selected source sense. Correctly calling a word a counter while displaying an unrelated definition is a failure. Constraints admit multiple relevant senses where appropriate; they do not demand the dictionary's first sense. Source identifiers and definitions are checked against the imported dictionary, including the definition-backed function-word supplement.

The first source audit corrected two fixture errors, retained in its `errata`: CAREFUL has an explicitly anxious sense that reinforces FEAR, and CLOUD has a verb sense meaning to make gloomy or depressed that reinforces MELANCHOLY. Their original neutral expectations had considered only attentiveness and weather. Both now require the relevant source sense. Thresholds were unchanged, and the first model still failed after these corrections.

A subsequent independent policy review widened REGULATE's source constraint to accept both conformity to rules and regulation of time, amount, degree or rate. Both fit CHAOS's established ORDER/CONTROL policy. The initial constraint admitted only the rules phrasing. The model's neutral label remains a counted error; accepting another legitimate definition does not make that label correct. Reports before this source clarification remain in the archive.

The source audit also admitted the legitimate verb readings of DISORGANIZED and SATISFIED: removing organization and making someone happy or satisfied preserve their scoring meanings. Their earlier constraints had included only adjective senses. These corrections change neither expected label nor any accuracy threshold.

A later source audit also accepts DEJECTED's verb sense, `oewn-deject__2.37.00..` ("lower someone's spirits; make downhearted"), alongside its adjective sense. This follows the same causative policy as CLOUD. The expected reinforcement label is unchanged. The [preceding development fixture](../artifacts/semantic-assessment/evaluation/development-before-deject-source-audit.json) and the failed model reports retain the earlier source constraint.

Exhaustive sense review exposed another fixture omission: TABLE has the verb sense `oewn-table__2.36.00..`, "arrange or enter in tabular form". Under the existing policy allowing actions that directly organize things, this is a counter to CHAOS. The corrected case requires that precise verb sense; the furniture and data-object noun senses remain insufficient. The [preceding primary fixture](../artifacts/semantic-assessment/evaluation/primary-before-table-source-audit.json) and previous reports are preserved. This is a source-backed label correction, not a lowered accuracy gate.

The source audit also admits TRUST's direct interpersonal-confidence sense (`oewn-trust__1.07.00..`, believing in others' honesty and reliability). It denotes the same confidence concept as the already accepted trust senses. Financial and institutional readings remain excluded. The [preceding confirmation fixture](../artifacts/semantic-assessment/evaluation/confirmation-before-trust-source-audit.json) is retained, and the expected label is unchanged.

## Historical evaluation gates

The initial thresholds were fixed before model evaluation. A separate novel-concept recall gate was added after the first candidate failed, before evaluating the second candidate. This strengthens the gate: a model cannot pass primarily by retaining old profiles while still missing most new scoring concepts.

| Check | Required |
| --- | --- |
| Assessment coverage | 100% |
| Fifteen core regressions | 100% correct |
| All scored cases | At least 90% correct |
| Held-out cases | At least 85% correct |
| Each enemy | At least 80% correct |
| Neutral words given a bonus or penalty | At most 5% |
| Selected source senses exist for their words | 100% |
| Explicit ambiguity constraints | 100% |
| Previously unprofiled scoring concepts | At least 80% recalled |

The [legacy coverage manifest](../tests/fixtures/semantic-legacy-coverage-v1.json) freezes the old profile's coverage and checksum. Novel-concept recall considers scored counter/reinforcement cases with no old profile entry. The evaluator does not reread evolving profiles to decide which examples count as novel.

Missing predictions fail coverage and count as incorrect. Duplicated predictions fail rather than allowing whichever answer appears last to hide disagreement. The six review cases remain visible in reports but have no scored expectation; they need an explicit game-policy decision before becoming regressions.

These gates detect obvious regressions and a range of unseen concepts. Passing a small benchmark cannot establish that every one of the dictionary's words has a perfect semantic label. Full assessment coverage, retained model/configuration provenance, source-sense validation and inspection of uncertain records are additional requirements.

The [evaluation archive](../artifacts/semantic-assessment/evaluation/summary.json) retains failed candidates as well as subsequent results. During development, aggregate failure rates and structural diagnoses informed model changes; held-out word identities and expected labels were initially withheld from the model implementer. Later gameplay/source discussion also exposed a concept family from the confirmation set. Subsequent results on these fixtures are regression results, not final unseen-performance claims. Initial and corrected source-audit results are both retained. A separately frozen diagnostic evaluated once after final model selection must be reported on its own, without retroactively replacing these results or changing publication thresholds.

## Current publication standard

New publications require **zero known errors**: 100% labels, 100% required source senses, zero neutral false positives, and complete contextual review on all four existing regression sets (144 primary, 13 development, 36 confirmation and 18 later diagnostic cases). Every puzzle-inventory spelling receives review across all its dictionary senses, including previously trusted and low-similarity words. `scripts/lib/semanticQuality.ts` applies these stricter gates to actual provider output at both review and packaging. Historical fixtures, thresholds and failed reports remain unchanged for comparison. These repeatedly inspected sets are regression evidence; passing them does not establish perfect unseen accuracy.

## Running the evaluator

Export the frozen model's **actual predictions**, without replacing failures with benchmark labels:

```json
{
  "modelId": "pinned-model-or-assessor-version",
  "configurationHash": "hash-of-models-prompts-and-thresholds",
  "records": [
    { "enemy": "CHAOS", "word": "CALM", "relation": "opposite", "senseId": "oewn-calm__5.00.00.composed.00" }
  ]
}
```

```sh
node scripts/evaluate-semantic-benchmark.ts predictions.json --split=development --output=development-report.json
node scripts/evaluate-semantic-benchmark.ts predictions.json --split=holdout --output=holdout-report.json
node scripts/evaluate-semantic-benchmark.ts predictions.json --output=complete-report.json
```

The command exits unsuccessfully when a gate fails. Reports retain every actual result, the mismatch rationale, per-enemy and holdout accuracy, false-positive rate, source-sense checks and the supplied configuration identity. This evaluator imports definitions to validate provenance; it does **not** import the generator's semantic profiles, model anchors or scoring implementation.

For a review of the complete **baseline** classifier, extract predictions from the actual six compressed inference outputs. This catches changes caused by corpus ordering, batching, source exclusions or packaging:

```sh
node scripts/review-semantic-cache.ts artifacts/semantic-assessment/cache artifacts/semantic-assessment/evaluation/base-predictions.json artifacts/semantic-assessment/evaluation/base
```

The resulting snapshot includes raw-output checksums, the source/configuration/model identities and actual predictions for all evaluation words. The command writes its reports even when a gate fails, then exits unsuccessfully; failed results must remain visible.

## Evaluating the contextual review layer

The complete dictionary-wide vector/NLI cache is a baseline. Its coverage and source checks remain separate from the final method's semantic quality. New puzzle publication also requires the frozen local LLM reviewer to finish every word and every dictionary sense in that puzzle's complete possible-word inventory. No retrieval cutoff or trusted-baseline exemption bypasses review; missing reviews cannot silently become neutral decisions.

The final quality snapshot comes from `semanticRefinementProvider.refine` applied to all benchmark spellings, using ordinary frozen inference memo records. It retains actual failures as well as successes. Neither collection nor the provider receives expected labels. The independent evaluator checks the collected decisions afterwards:

```sh
node scripts/review-contextual-semantics.ts tests/fixtures/semantic-model-quality-v1.json artifacts/semantic-assessment/evaluation/contextual-final
node --test --test-isolation=none tests/semantic-model-quality.test.ts
```

The snapshot pins the baseline cache identities, reviewer manifests, complete refinement-file digest, per-word input and memo provenance, and each evaluated inventory's review completeness. It fails publication quality if any required memo is missing, stale, invalid or unsuccessful, even when an unreviewed baseline happens to give the expected answer. Tests compare the snapshot with the actual current provider output.

An optional third argument supplies a candidate refinement cache before replacing the published cache. It uses the same production provider and digest validation. Candidate results are archived separately; the committed quality snapshot must ultimately be regenerated from the actual published cache.

This checks the fixed assessment algorithm on independent fixtures. A separate publication check proves that the particular puzzle has complete eligible-word review and valid source senses. Reviewing only fixture words does not certify an unrelated puzzle; reviewing a whole puzzle does not establish semantic correctness without the independent quality evaluation.

## Fresh diagnostic after the contextual policy froze

The [18-case diagnostic](../tests/fixtures/semantic-fresh-diagnostic-v1.json) was authored after policy `3e8f1135c0e5bb5f2cca1d5ede645a140d223017b9d56e983445107c9f5d341d` froze, before its predictions were inspected. It contains one counter, reinforcement and neutral word for each enemy. Both spellings and their dictionary lemmas are disjoint from all earlier scored and review cases. The [freeze record](../artifacts/semantic-assessment/evaluation/fresh-diagnostic/freeze.json) pins the original bytes as SHA-256 `4c86ac7f2e987526cdaacfd21207e824ad05888a6d5c1bba9f3d50616ad450b2`. No words or expected labels were supplied to the model implementer before the run.

The [first actual hybrid result](../artifacts/semantic-assessment/evaluation/fresh-diagnostic/first-run/report.json) is **18/18 labels**, **12/12 constrained source senses**, **7/7 previously unprofiled scoring concepts**, and **0/6 neutral false positives**. Four decisions used the local LLM, three used source-direction proofs, five retained lexical expansions, and six retained baseline neutral decisions. This is a small assistant-authored diagnostic of the complete hybrid algorithm, not 18 new LLM classifications, a representative dictionary sample, or an estimate of dictionary-wide accuracy. It does not replace earlier failed reports or change the publication gates.

That same frozen candidate **failed the existing quality gates** in its [actual contextual assessment](../artifacts/semantic-assessment/evaluation/contextual-candidate/summary.json): primary accuracy 140/144 with 29/30 source constraints, development-extension labels 13/13 with 12/13 source constraints, and confirmation accuracy 31/36 with one enemy at 4/6. All 44 eligible benchmark reviews were present and valid. The fresh diagnostic's success therefore does not justify publication. If the model changes in response, the 18 cases also become regression evidence for the later model.

The one-shot reviewer refuses to overwrite existing results and verifies the frozen fixture and model-policy digests:

```sh
node scripts/review-fresh-semantic-diagnostic.ts candidate-refinement.json artifacts/semantic-assessment/evaluation/fresh-diagnostic/first-run
```

Any later execution belongs in a separate regression directory and must not be described as another unseen diagnostic.

### Full-inventory editorial regressions

The inventory review found errors outside the earlier passing suites, including AHEAD, ENCOURAGE, CLEAN, COMB and CORE. These are recorded in `semantic-inventory-regressions-v1.json`, with inflection and incidental-organization cases. The actual model failures remain in the evaluation archive. A separate source-level correction ledger fixes audited definition errors across every affected spelling, while preserving model responses. Reported final quality evaluates this complete hybrid method; it is not a claim that the raw model had the same accuracy. The correction policy is included in the quality snapshot identity.


The final hybrid passes **269/269 scored cases**: 144 primary, 13 development, 36 confirmation, 18 diagnostic and 58 inventory regressions. Required source constraints also pass. The raw model passed the earlier 211 cases but only **7/58** inventory regressions; both outputs remain in `artifacts/semantic-assessment/evaluation/contextual-final`. This is regression evidence after editorial correction, not unseen model accuracy.

The source ledger contains 142 reviewed senses. Across the 10,379-word audited inventory (the candidate vocabulary plus 28 evaluation spellings), corrections change 186 labels and 192 label/source selections. The review inspected all final scoring sources, 780 cue-matching neutral definitions and 116 baseline conflicts. A frozen per-word inventory registry now prevents new or changed meanings from publishing solely on the strength of a passing benchmark. Unseen meanings still require review.
