// Compile with Typst 0.15.1: typst compile docs/generator-and-semantics.typ docs/generator-and-semantics.pdf
#set document(title: "WYRMLE: generation, semantics and certification", author: "WYRMLE")
#set page(paper: "a4", margin: (x: 22mm, top: 19mm, bottom: 20mm), numbering: "1", number-align: center)
#set text(font: "Libertinus Serif", size: 10.2pt, lang: "en")
#set par(justify: true, leading: 0.45em)
#set heading(numbering: "1.")
#set math.equation(numbering: "(1)")
#show heading: set text(font: "DejaVu Sans", fill: rgb("23483f"))
#show raw: set text(size: 8.8pt)
#show link: set text(fill: rgb("285f80"))
#align(left)[
  #text(font: "DejaVu Sans", size: 24pt, weight: "bold", fill: rgb("23483f"))[WYRMLE]
  #v(3pt)
  #text(size: 16pt)[Generation, semantics and certification]
  #v(4pt)
  #text(size: 9pt, fill: rgb("5b6663"))[Technical note · September 2026 · implementation and proof boundaries]
]
#v(5pt)

This is a technical account of the implementation, with separate claims for vocabulary coverage, semantic judgement and game solvability. The central design is a *compiler boundary*: expensive, probabilistic semantic work happens during authoring; gameplay and solver transitions use the same immutable, versioned table.

#block(width: 100%, inset: 11pt, fill: rgb("f1f5f4"), radius: 4pt)[
  #set text(size: 9pt)
  *AUTHORING* Licensed senses + enemy policy → embeddings / NLI → seeded candidate


  Complete supply vocabulary → local contextual review → frozen meanings


  Actual-engine search → witness replay + opening certificate → publication


  *PLAY* Immutable word-table lookup → deterministic combat and refill
]

= Vocabulary coverage is a finite enumeration problem

Let $D$ be the accepted, definition-backed dictionary, $S(w)$ the licensed source senses of spelling $w$, and $nu(w) in NN^(26)$ its letter-count vector. For a candidate with initial board $B$, finite refill sequence $Q$, minimum word length $m$, and board capacity $n=16$, compile

$ D_P = {w in D : m <= abs(w) <= n, quad nu(w) <= nu(B) + nu(Q)}. $

The inequality is componentwise. This is a *complete superset* of words playable on any reachable board: it ignores timing, consumption and refill order. It can include unreachable words, but cannot omit a reachable spelling. The compiler examines this set independently of solver budgets; a beam-search cutoff therefore cannot remove a word's definition or silently make it neutral.

The current source export has *116,395 spellings, 112,646 distinct senses and 244,273 spelling–sense references*. Definitions come from Open English Wordnet plus the licensed Wiktionary supplement for uncovered words, including function words. An admitted spelling must have a stored source definition. The LLM does not invent definitions or decide spelling validity.

The original failure was principally sparse semantic coverage: the compiler found spellings, but absence from a small enemy relation profile implied neutrality. Enumerating $D_P$ did not imply evaluating its meanings. The replacement removes that fallback.

= Semantic classification is a policy over senses

For each enemy $e$, an authored concept policy supplies counter and reinforcing anchors $A_e^C$ and $A_e^R$, with source sense identifiers. This is game semantics: *calm* counters *chaos* through composure/order; it need not be a strict dictionary antonym. Related negative emotions are not interchangeable. The assessed enemy set is ANGER, CHAOS, CRUELTY, DESPAIR, FEAR and MELANCHOLY; adding an enemy requires its policy, complete offline assessment and evaluation, not merely another seed.

== Retrieval and directional evidence

The base model embeds lemma-plus-definition strings with pinned *all-MiniLM-L6-v2*. After mean pooling and normalization, similarity is the dot product of 384-dimensional vectors. For each source sense, retrieve up to four anchors *on each side*, subject to cosine similarity at least $0.50$. A pinned *nli-deberta-v3-xsmall* then evaluates directional entailment between the candidate definition and each retrieved anchor definition.

Cosine similarity alone is unsuitable for polarity: antonyms often occupy similar contexts. NLI provides a second, asymmetric signal. The statistical base decision takes the strongest entailment, breaking ties by cosine; scores below $0.55$ produce neutrality. Stored per-side scores are maxima over the word's assessed senses and retrieved anchors. They are model outputs, *not calibrated human-agreement probabilities*.

Source evidence has explicit precedence:

1. Existing reviewed scoring senses and their lexical expansions.
2. A directed source proof reaching an approved concept in at most two edges.
3. The vector/NLI decision.

Proof edges are forward `hypernym`, `entails` or `causes`; an optional verb-to-state/event noun role consumes one of the two hops. Sharing a hypernym does not constitute a proof. Hypernym inheritance into a collective `noun.group` anchor is also insufficient: belonging to a series does not imply countering disorder. Those candidates fall through to ordinary statistical and contextual review. Excluded senses and intermediate concepts are respected. The selected source, path and decision basis remain inspectable.

== Contextual refinement

A second retrieval index uses the union of three representations: *lemma + definition, definition alone, and lemma alone*. Let

$ q_e(s) = max_(r in {ell d, d, ell}) max_(a in A_e^C union A_e^R) ⟨ f_r(s), f_r(a) ⟩ . $

The local LLM must review every word in the complete supply vocabulary and every dictionary sense of each word. Similarity does not filter review inputs, and previously trusted source decisions receive the same contextual review. The exhaustive source index is checked against the source export before packaging. Historical filtered experiments remain reproducible, but their narrower coverage cannot satisfy new publication readiness.

The contextual model is pinned *Qwen3.5-9B*, executed locally through `llama.cpp` using a checksum-pinned Q4_K_M conversion. It makes one non-thinking request per distinct source sense, receiving its lemma, definition, part of speech and lexical domain. The response contains only one to four categories from the frozen policy. Sampling parameters and seed are pinned; the output limit is 128 tokens.

The categories distinguish feelings and abstract qualities from occupations, objects, physical properties and fields of study. A source sense receives the same categories wherever it appears, independently of the enemy. A second request verifies every proposed scoring category against that same source definition, rejecting associations that do not directly express the quality. Non-scoring first-pass responses remain intact. Code maps the verified categories to counter, resisted or neutral. A fixed preference for reinforcement resolves words with scoring senses on both sides. Category descriptions and this precedence are game policy, not a claim that language has one objective label.

Every sense requires an actual response. Code binds it to its input definition; the model never supplies a source index. The word-level audit retains the first-pass response, its source digest, any verification response, and whether verification was required. Packaging rejects any scoring proposal without a verification response, any category introduced by the verifier, or a changed unverified neutral response. Packaging independently checks complete coverage, source identities, response categories, final labels and explanation text. Invalid formatting can receive up to three frozen, audited attempts; exhausted retries block publication. Valid semantic decisions are never retried to obtain a preferred answer.

When several reviewed senses support the same final relation, display selection prefers the baseline source only if its new category agrees. Otherwise it prefers direct qualities and actions over associated objects or roles, using frozen lexical-domain priorities. A neutral word can retain its baseline display definition only after every sense has been reviewed. Baseline labels never bypass the contextual review. Inflections and enemies reuse identical source requests, while each spelling pins its own baseline record. Missing, stale or failed reviews block publication.

Editorial source review follows the model pass. The versioned `semantic-source-reviews-v1.json` ledger records exact dictionary sense IDs, definitions, corrected categories and reasons. Corrections apply to every spelling carrying that sense, are pinned to the source export and model policy, and never overwrite raw model responses or substitute for missing inference. Final words distinguish `source-reviewed` decisions from `local-llm` decisions. The scoped correction digest is part of the frozen refinement identity, so changing an applicable correction invalidates the gameplay certificate. The inventory audit lists every scoring source and flags potentially missed neutral meanings for inspection; keyword matches never assign labels.

Publication also requires a matching inventory audit in `semantic-inventory-reviews-v1.json`. Every final word record is hashed, with the source, model policy and editorial correction policy pinned. New spellings or changed meanings remain drafts until reviewed and registered; passing the model benchmark alone cannot approve them. Audited subsets may be reused when a candidate changes only its physical layout or reduces its vocabulary.

= The frozen label changes the transition system

Let $C(s,a)$ be the number of matching enemy hits the selected physical tiles could deliver in state $s$. With grammar and long-word bonuses disabled, the normal allowance is

$ b(s,a) = cases(C(s,a) & "counter", 1 & "neutral", 0 & "resisted"). $

Actual hits still require matching letters and follow the engine's deterministic targeting order. A counter is therefore not a fixed “+1”: it unlocks all available matching hits. A Hit tile can strike without consuming the normal allowance. A Life tile cancels that turn's usual life cost. Revive applies its specified recovery after damage. Armour and duplicate enemy letters remain individual targets.

The same stored word table controls acceptance, preview, submission, move discovery and exhausted-board detection. Neither the browser nor a solver rollout calls a model. Numeric assessment fields remain the base NLI scores even when contextual review changes the final label; the separate decision basis prevents presenting them as LLM confidence.

= Construction proposes; search establishes witnesses

Construction is seeded and reproducible. It selects semantic anchors, shares their letter multisets to form a 16-tile board, places armour and special tiles, then plans refills forward using actual engine previews. Mutation changes letters, placement, armour, life count or refill supply. A finite refill budget can invalidate the construction plan, so only its genuinely replayed prefix is retained as a search hint.

Word familiarity is a separate signal: pinned `wordfreq` corpus data maps Zipf frequency $z$ to $op("clip")((z-1)/4,0,1)$. A threshold of $0.5$ corresponds to Zipf 3, approximately one occurrence per million words. Familiarity influences construction/ranking and the certified continuation vocabulary; it does not delete definition-backed words from $D_P$.

The solver searches a deterministic state graph with ordered physical board $B_"id"$, enemy HP $H_"id"$, lives $L$, refill index $i_Q$, next tile identity $t_"next"$, and fixed rules $R$:

$ s = (B_"id", H_"id", L, i_Q, t_"next", R). $

Refills are assigned by board position, so choosing different copies of the same letter can produce different successors. Physical selections cannot generally be merged merely because they spell the same word. State keys include future-relevant rules and word classifications; history and UI selection are omitted.

Beam search gives economical witnesses. Exhaustive BFS can establish impossibility or shortest depth only when vocabulary, move enumeration and every relevant layer are complete. Otherwise the result is *unknown*, not unsolvable. Construction hints and imported word routes must be replayed with real tile IDs under current rules.

= What validation does—and does not—prove

A quality score is a weighted heuristic over observed evidence: varied winning strategies, semantic impact, meaningful special-tile choices, armour, refill-dependent moves, wins continuing after refill exhaustion, familiar vocabulary and final-life rescues. Counterfactual replays/search estimate how outcomes change when a mechanic is disabled. These estimates are search-budget dependent; the score is neither a solvability proof nor a calibrated difficulty probability.

The stronger first-move certificate checks

$ forall a in cal(A)(s_0), quad exists pi_a in cal(A)_"familiar"^* : T^*(T(s_0,a), pi_a) in "Won". $

Here $cal(A)(s_0)$ includes *every legal physical opening selection*, not just sampled words. Each continuation is an independently replayable witness. Publication requires complete opening enumeration, zero unsafe openings and zero unknown openings. A proved supply deficit or terminal loss can refute safety; failure to find a route within a budget cannot.

This guarantees recoverability after one word. It does *not* guarantee recoverability after arbitrary later choices, prove a globally shortest solution, or establish an observation-based winning policy for a player who cannot see refill order. The solver knows the fixed refill sequence. The visible refill inventory improves player information, but it is not itself a proof of fairness under partial observability.

= Evaluation, reproducibility and remaining uncertainty

Semantic regression tests cover counter/resisted/neutral decisions, polysemy, physical objects and previously uncovered words. Independent evaluation distinguishes old-profile cases from novel meanings. Development results are not presented as unseen generalization; the #link("https://github.com/crayjake/wyrmle/blob/main/docs/semantic-benchmark.md")[ benchmark report ] records the fixed gates, prior adaptive feedback and the later diagnostic sample. Coverage tests independently enumerate the dictionary and verify source membership, stored definitions and artifact hashes.

Hashes establish provenance and cache consistency, not semantic truth. All inventory words and their dictionary senses now receive contextual review, eliminating the similarity-cutoff coverage gap. Source glosses, policy boundaries and LLM judgement can still produce mistakes. Publication requires zero known label errors and zero required-source-sense errors across all current regression sets; this is a release standard, not a proof of perfect unseen linguistic judgement.

Publication stores only the puzzle's needed definitions, classifications and evidence; large authoring caches and model weights are not runtime dependencies. Changing applicable meanings invalidates the puzzle's certificate. Played archives retain their frozen version; a fresh publication/reset uses the new version. This prevents a model update from rewriting an already played turn.

The CI slowdown exposed an unrelated scaling bug: refill planning recomputed full-vocabulary letter coverage inside each prospective move's score. Precomputing per-letter distinct-word counts removes that quadratic scan. Frozen semantic lists also get normalized lookup indices, while mutable lists retain live lookup behavior. Exact candidate comparisons verify that these optimizations change cost, not puzzle output.

Meaning-based construction also omits the redundant full-vocabulary parts-of-speech table: its frozen meanings already provide those records. Keeping the duplicate table inflated every search-state key and exhausted the browser worker heap. The large contextual audit cache is imported as raw JSON text in Vite so TypeScript does not infer millions of literal types; Node authoring tools retain the ordinary JSON loader.

For operational reproduction and model/source licenses, see #link("https://github.com/crayjake/wyrmle/blob/main/docs/offline-semantics.md")[ offline semantics ]. Entry points are `meaningCompiler.ts`, `semantics/infer.py`, `semantics/retrieve.py`, `semantics/refine.py`, `solve.ts`, `openingSafety.ts`, and the strict daily review/packaging scripts.
