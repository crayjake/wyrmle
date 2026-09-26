# Generator, solver and review workflow

Current authoring (generator v6) uses ordinary letter tiles only. The browser generator has no Revive control; `--regen`, `--revives` and new special-tile requests are rejected. Published v14 likewise removes specials while keeping v13 available for saved-game replay. Historical special-tile analysis below describes archived encounters, not new puzzles.

This is a local **development review pipeline** for the letter-strike game. New generation defaults to meaning-first rules: a definition-backed word table is compiled before search; grammar and long-word bonuses are disabled. Generated encounters use the existing `createLetterStrikeGame`, `previewLetterStrike` and `submitLetterStrike` functions. Nothing is published automatically. Committed Daily attempts keep their frozen rules and meanings; **Reset puzzle** deliberately opens that date’s current publication.

The archived September 26–27 **CHAOS v13** publication has twelve refills and 10,351 frozen, contextually reviewed word meanings. It corrects HALCYONS through its calming-bird noun sense. The [selected artifact](../artifacts/meaning-v4-halcyons/selected.json.gz) contains its complete review and opening certificate; the [publication review](meaning-assessment-review.md) records the semantic audit and three-word minimum proof. Fresh games from September 26 use v14 with the same reviewed meanings and ordinary tiles. The v13 opening certificate and minimum proof do not certify the changed board. September 25 remains the archived v11 puzzle.

## What you can do yourself

Enter **CHAOS, ANGER, DESPAIR, FEAR, MELANCHOLY or CRUELTY** in the DEV form below, or run a batch from the command line. Those six enemies have complete baseline model-assessment caches. The generator constructs alternatives, tries mutations, replays winning routes, rejects designs that fail its gates and ranks the survivors. You do not need an assistant to run searches or playtest the results.

“Best” means highest scoring among the candidates searched under those settings. Search and later-turn design sampling are bounded; the score is a design heuristic, and a batch may return no accepted candidates. More seeds and refinement explore more alternatives, without proving global optimality or how enjoyable a puzzle will feel to a player.

**Accepted for DEV review is not ready for publication.** The current CHAOS daily has complete contextual review and no known failures in the 270-case semantic regression suite. A different tile supply can admit extra words: the latest accepted discovery draft still has 975 words awaiting contextual review. Its baseline classifications exist, but they are not fully audited final meanings. Publication additionally requires current review of every inventory spelling and source sense, an audited final inventory, complete opening certificates and final playtesting. No finite benchmark can guarantee that no unseen semantic mistake exists.

An arbitrary new enemy needs its own intended sense, reference concepts, model assessment and reviewed inventory. **HALCYON is currently an explicit 70-word experiment**, outside those six production caches; entering it in the ordinary generator does not create that semantic data. See [offline semantics](offline-semantics.md) for the processing steps and [the design study](../artifacts/puzzle-design-2026-09-26/README.md) for the current experiments. The remaining review work can be done by a developer or puzzle editor; there is no automatic “enemy to approved daily” command yet.

The [earlier ANGER review](revive-candidate-notes.md) and September 25 v9 certificates describe the archived 19-refill bonus-based encounter. Their results do not transfer to a new meaning-first puzzle.

## Run and play

```sh
npm run dev
```

Open `http://localhost:5173/?generator=1`, or **Settings → Development → GENERATOR / SOLVER**. The review queue starts empty so an archived special-tile puzzle cannot be mistaken for a new candidate. The form starts with CHAOS, seed `meaning-review`, and a finite refill budget of 20. Each generated card shows letters, armour, refill blocks, semantic anchors, quality measurements and uncertainty. Its word lookup shows the frozen definition and classification. **Play** uses the real battle engine; returning to the generator preserves the review queue. These playtests do not write daily history.

Enter an enemy, seed and candidate count to make another batch. Automatic mode screens the provider's enemy concepts first. Generation runs in a cancellable worker so the page remains usable. Solver answers and the generator worker/data are excluded from production builds.

## Batch commands

```sh
# A small discovery batch with later-turn checks and ordinary tiles.
npm run generate -- --enemy CHAOS --count 8 --seed my-chaos --refills 24 --refine 1 --out artifacts/generated/my-chaos

# 200 meaning-first MELANCHOLY candidates; JSON and report written locally.
npm run generate -- --count 200 --enemy MELANCHOLY --seed meaning-review --out artifacts/melancholy

# 1,000 seeds with automatic suitability-based enemy selection.
npm run generate -- --count 1000 --seed discovery --out artifacts/generated

# Evaluate nearby mutations as well as each initial construction.
npm run generate -- --count 40 --enemy MELANCHOLY --seed refine --refine 1 --mutations 2

# Explore finite replacement supplies; length may change in refinement.
npm run generate -- --count 8 --enemy ANGER --seed finite-review --refills 18 --refine 1

# Compare the earlier lexical mode using ordinary tiles.
npm run generate -- --count 40 --enemy MELANCHOLY --seed melancholy-review-v1 --legacy --dev-top

# Compare the earlier grammar/length scoring mode using ordinary tiles.
npm run generate -- --count 8 --enemy ANGER --seed bonus-review --legacy-bonuses

# Reanalyse an archived shortlist after tuning metrics, without changing its boards.
npm run review-generated -- --input artifacts/melancholy/top.json --dev-top

# Recheck the archived DESPAIR v6 three-word minimum (not v7 or ANGER).
node scripts/prove-daily-minimum.ts

# Label all opening words and the optimistic full-supply vocabulary before search.
npm run audit-lexicon -- --date 2026-09-25 --out artifacts/lexical-audit.json

# Certify every physical choice within an explicitly curated opening scope.
npm run certify-openings -- --date 2026-09-25 --common-openings --scope all-valid-openings --successors 1000 --seconds 600 --out artifacts/opening-safety.json

# Reproduce the archived ANGER v8 review.
node scripts/review-revive-daily.ts

# Reproduce archived ANGER v9's exact route replays and scoped publication gates.
node scripts/review-finite-daily.ts

# Rebuild offline Daily difficulty analyses and the public label-only file.
node scripts/rate-dailies.ts
```

`--count` counts requested initial seeds. `attempted` also counts evaluated mutations and automatic enemy fallbacks. Generation is CPU work: large batches can take minutes or hours. Progress and `report.json` are updated after each seed. Accepted candidates are separate JSON files; `top.json` contains the best twenty. The legacy `--dev-top` option refreshes `data/melancholy.json`, retaining one variant per construction family; the current workshop instead opens `data/meaning-review.json`. Reports include enemy/candidate rejections, archetypes, explored states, elapsed time, hopelessness/clutch distributions, scores and accepted candidate seeds. `--states`, `--beam` and `--counterfactual-states` expose search budgets. Identical seeds, lexical data, options and code produce identical candidates and rankings; timing fields are intentionally nondeterministic.

## TypeScript entry points

```ts
import { generateForEnemy, generatePuzzle, createCandidate, analysePuzzle } from './src/generator/index.ts'

const melancholy = generateForEnemy('MELANCHOLY', 'review-42', {
  candidateCount: 12, keep: 5, refinementRounds: 1, mutationsPerRound: 2,
})
const automatic = generatePuzzle('daily-experiment-42', { candidateCount: 8 })
const rejected = generateForEnemy('XERO', 'review-42')
// rejected.enemySuitability.rejectionReasons explains why construction was skipped.

// Reconstruct the first unmutated construction from batch seed review-42:
const candidate = createCandidate('MELANCHOLY', 'review-42:0')
const analysis = analysePuzzle(candidate)

// Ordinary tiles with a finite supply and meaning-first scoring.
const finite = createCandidate('ANGER', 'meaning-review:0', { refillLimit: 18 })

// Preserve historical generation streams when reproducing old reviews.
const lexicalBonus = createCandidate('ANGER', 'old-seed', { scoringMode: 'legacy-bonuses', archivedSpecialTiles: true })
const original = createCandidate('MELANCHOLY', 'old-seed', { lexicalMode: 'legacy', archivedSpecialTiles: true })
```

Both generation entry points return a `GenerationResult` containing the enemy suitability report, all ranked evaluated candidates, accepted candidates, rejection counts and provenance. All candidates use `CandidatePuzzle`. `accepted` can be empty; unsuitable enemies and unconvincing boards are never forced through. Load saved JSON for a mutated candidate, whose parent and mutation list are recorded.

## How construction works

Meaning generation defaults to **v6 sustained discovery**: two thematic resisted anchors and two counter anchors, refills that support both families, additional armour on short enemies, and sampled later-turn checks for recurring themes, counter alternatives and actual meaning benefits. Ten simple chip-away strategies test whether at most one opening counter followed by neutral words wins too easily. `--classic-design` compares the earlier anchor strategy using ordinary tiles too. These design checks supplement the semantic and publication gates described below.

1. **Enemy suitability.** Familiarity, definition quality, part-of-speech clarity, valid counter/resisted/related counts, counter letter coverage, ordinary English letter proportions, length and semantic confidence contribute explicit weighted scores. Hard gates reject missing senses, sparse semantic neighbourhoods and inappropriate lengths. `enemySuitability.ts` holds thresholds and weights. `selectEnemy` makes a seeded suitability-weighted choice; automatic generation can try another suitable concept when boards are rejected.
2. **Definition-backed vocabulary and offline model assessments.** `meaningLexicalProvider` reads the same complete per-enemy assessment cache that the puzzle compiler uses. Model-era construction and continuation familiarity use pinned `wordfreq` corpus data; legacy generation retains its earlier editorial estimates. Source definitions come from Open English Wordnet 2025 senses and dictionary-filtered forms, plus the pinned Wiktionary grammatical-word supplement. Local embedding and entailment models assess all source senses against both counter and reinforcing references, extending beyond the sparse reviewed profiles. A counter can be an idea that overcomes the enemy rather than a strict antonym: good spirits counter ANGER. Missing or stale caches stop generation. Runtime uses only the frozen encounter table. See [offline model setup and reproduction](offline-semantics.md). `scoringMode: 'legacy-bonuses'` / `--legacy-bonuses` and `lexicalMode: 'legacy'` / `--legacy` preserve the earlier generators explicitly.
3. **Starting board and armour.** Shared letters from counter and resisted anchors fill sixteen ordinary tiles. Armour creates repeated-letter requirements. Current construction places no Hit, Life or Revive tiles.
4. **Refills.** Forward planning evaluates actual selected IDs through the engine, preserves unused tiles, identifies missing letters for a later word, and places those letters in the next consumed-slot refill block. It targets several useful turns instead of maximising immediate hits. Clutch goals target the last available life. By default, the remaining queue cycles lexical support blocks and meets the engine's worst-case capacity requirement. An explicit `refillLimit` enables finite supply, truncates the planned queue, then replays its physical IDs under the final finite rules; only a legal trace prefix survives. After the final supply is known, `withCompiledMeanings` freezes every definition-backed spelling that fits its letter multiset, including words absent from the construction vocabulary. A construction trace is a hypothesis, not a winning proof or optimality claim.
5. **Refinement.** A small deterministic beam retains high-scoring validated parents and evaluates nearby mutations. Primitives edit starting/refill letters, swap slots, alter armour or its duplicate copy, replace an anchor, and optionally adjust Lives. Finite encounters additionally support `refill-length`: add or remove 1–4 letters within 0–96. Lives mutations never pad a finite queue. Special-tile movement exists only when replaying an archived candidate that contains those tiles. Supply-changing meaning-first mutations recompile the stored table before analysis; stale letter-supply metadata is rejected. Every mutation is analysed afresh. No mutation inherits a parent's winning proof. `refinementRounds`, `mutationsPerRound` and `refinementBeamWidth` bound the work.

The CLI's `--refills N`, TypeScript's `refillLimit` and the DEV form's **Finite refill supply** all accept integers **0–96**. Zero means no replacement letters; omission preserves the original padded-supply rules. The form and worker validate the same range. The supplied number is the initial construction budget; refinement can change it, and every candidate shows its final count.

## Solver guarantees and limits

`findValidMoves(state)` enumerates the encounter’s valid words with actual physical tile assignments. Each move comes from `submitLetterStrike`: semantic class, Life/Hit/Revive use, ordered enemy hits and recoveries, lives cost and successor state all come from gameplay. Historical encounters also retain their recorded POS/grammar/LONG behavior. Different consumed board slots and special-tile ordering remain distinct. Equivalent permutations of identical copies within the same consumed set are canonicalized.

`solvePuzzle` supports BFS and beam search. A state key includes the frozen meaning vocabulary and classifications, encounter semantics/rules/refill data, the finite-supply flag, ordered board identities and types, enemy positions and armour (including Revive-granted armour history), Lives, refill cursor and next tile ID. History and selection/error UI fields are omitted because repeated words are legal and they do not affect future moves. Next tile IDs strictly advance for consumed slots even after the refill cursor stops at the end of a finite queue, so recovery does not introduce cycles when enemy health increases.

Finite encounters retain all sixteen board positions. Exhausted consumed slots become inert empty cells and are excluded from word discovery. An exact check against the same frozen puzzle dictionary ends a finite run when no word remains, independently of whether a move would damage the enemy. Victory is checked first. Queue exhaustion alone is not a loss, and a restricted solver vocabulary cannot prove that the full dictionary has no move.

The practical default is bounded beam search over the full local dictionary, with diversity across opening words. Winning lines are real replayable witnesses. Search pruning, move caps, state caps and optional restricted vocabulary are reported. **Unknown is not impossible.** `bestWinDepth` is a witnessed depth; `minimumTurnsToWin` is populated only when the shallower search is complete. Winning line counts, viable openings and letter opportunities are lower bounds, not exhaustive totals. Restricted vocabulary can establish a win but cannot establish impossibility for the full game.

`hintLines` accepts several candidate routes with exact tile IDs; the single-route `hintLine` remains supported. Every hint is replayed through the real engine before it contributes evidence, with invalid and duplicate routes reported. New lexical encounters retain diversity across route prefixes, semantic patterns, special-tile timing and final-life finishes, so many similar endings cannot crowd out a distinct semantic or clutch route. Retention improves the sample; it does not make bounded searches exhaustive or turn a witness into a shortest-route proof.

Normal hits in new puzzles depend only on meaning: counters may use every matching tile, neutral words one, resisted words none. Only archived encounters retain Hit tiles that independently guarantee a matching hit. The engine retains grammar and LONG solely for explicitly archived or legacy-mode encounters. All hits resolve before Revive: each selected Revive tile restores one matching dead slot from 0 to 1 hit, or a living unarmoured slot from 1 to 2. Dead matches have priority, then living unarmoured matches, with left-to-right ties. Armoured slots stay capped at 2, unrelated letters never heal, and each physical tile heals at most once. Victory is checked after recovery, before exhausted lives cause a loss. Move ranking subtracts recoveries from immediate hits; that heuristic changes search preference, never move legality or proof.

Normal, Hard and Hardcore use exactly the same puzzle. Their definition visibility and 3/1/0 undo allowances are outside the solver's combat state. An undo restores the full previous immutable state; it is not a new combat transition or a different generated puzzle. Intrinsic difficulty is a separate analysis result.

## Lexical coverage and publication certificates

`compilePuzzleMeanings` scans the complete definition-backed dictionary independently of all solver budgets. The resulting `encounter.meaningLexicon` includes every spelling of the allowed length that fits the starting board plus full refill multiset: definition, lemma, selected source sense, relation, reason, source and model evidence. Each word carries counter/resisted scores, their signed margin, number of senses assessed and selected reference concept. The header pins source/model/policy/cache digests. The frozen table controls validity, scoring, solver discovery and terminal detection. Missing definitions or assessments stop authoring. `isMeaningCompilationCurrent` recompiles and compares every stored record including scores and metadata; validation rejects omitted words, stale meanings or supply changes.

`auditEncounterLexicon` independently counts the exact opening spellings and the optimistic full-supply vocabulary. It records classification fingerprints and complete enumeration, including every stored neutral record. The full-supply set is a safe spelling superset, **not proof that all included words are reachable on a future board**. Neutral means the assessed evidence did not meet the versioned counter/reinforcement policy. Complete coverage does not establish universal semantic accuracy; the independent benchmark reports held-out accuracy, novel-concept recall, neutral false positives and sense correctness. Archived tables retain their original classification policy.

Offline source rebuilds are explicit and versioned:

```sh
# Requires the official OEWN 2025 archive matching the pinned source checksum.
python3 scripts/build-word-meanings.py /path/to/english-wordnet-2025.xml.gz
node scripts/export-meaning-dictionary.ts
# Offline rebuild from the pinned Wiktionary projection.
python3 scripts/build-function-words.py
node scripts/build-semantic-profiles.ts
```

The full sense graph is an offline compiler resource. The compact dictionary/profile data supports DEV generation; a published puzzle carries its own frozen subset. Review roots and exclusions in `scripts/lib/semanticProfileRoots.ts` before rebuilding; regenerate and review candidates after a profile change. Existing published puzzle tables and saved outcomes are not rewritten by a rebuild. Source attribution and checksums are retained under `src/lexicon/data/`.

`certifyOpeningSafety` separately enumerates every physical opening in its declared spelling scope and replays a winning continuation for each certified successor. It distinguishes certified recovery, proved loss and unknown bounded searches. Checkpoints, dictionary/encounter fingerprints and the actual scope are stored in the report; none of these reports changes gameplay.

Current **CHAOS v12** for September 26–27 has a **MEDIUM estimate**, quality **77.16**, 30 retained strategies and 18 wins continuing on a depleted board. The separate exhaustive minimum audit proves three words, with **AGO → RESEARCH → REASON** as its witness. Its 8,041 physical openings all have familiar winning continuations. [Publication details](meaning-assessment-review.md) distinguish full opening certification, shortest-win proof and bounded route sampling.

Archived **CHAOS v11** certifies **all 3,060 valid opening spellings and 8,041 physical tile selections** against its full frozen dictionary. Every opening has a familiar winning continuation; unsafe and unknown counts are both zero. This covers the first word, including alternative choices of matching normal or special tiles. It does not certify arbitrary later decisions or a minimum winning depth. The complete certificate is retained in the [selected artifact](../artifacts/meaning-v2/selected.json.gz), rather than duplicated in the DEV review bundle.

Archived September 25 v9’s `artifacts/finite-refills-v1/anger19-extra-g-common-opening-safety.json` covers **98 curated opening words and all 204 physical selections**, with familiar winning continuations from all 191 distinct successors. It is a restricted-vocabulary certificate, despite the `all-valid-openings` move filter within that scope. It does **not** certify all dictionary words, arbitrary later decisions or a minimum winning depth. The original LONG6 partial search and LONG7 v8 certificate apply only to their own encounter fingerprints; neither certifies the finite publication.

`analysis.refillPressure` replays retained wins against the exact encounter and records when holes first appear, words played with fewer than sixteen tiles, words played after the reserve empties, tiles available before the finish and remaining copies of each enemy letter. Validation rejects missing/stale pressure evidence and finite limits that never affect an observed winning decision. Merely making holes after the winning word does not qualify. A finite puzzle with Revive must also show that mechanic affecting real routes. Finite-supply scoring rewards up to three observed reduced-board winning routes, without claiming every route needs exhaustion.

## Fairness, rescue and mechanics

Reasonable-play sampling follows useful moves within an editable immediate-score margin, with several distinct words per state. It alternates breadth and depth within the fixed state budget, and follows promising branches omitted by the main search. For sampled states with Lives above one, proven wins, proven losses and unresolved states are counted separately. A complete successor search or insufficient physical letter supply can prove a loss; merely failing to find a win cannot. The conditional dead-state rate is accompanied by assessed coverage and lower/upper bounds that include uncertainty. This is a **bounded sample**, not a guarantee about every reasonable player decision.

At the final life, the analyser discovers actual one-move wins and records the preceding route, remaining letters, tile IDs, word lengths, familiarity and a difficulty estimate. These are observable rescue opportunities, including ordinary finishes; long, less-obvious familiar words can score better as clutch opportunities. Life can extend a final-life state, so a missing immediate rescue is distinct from a proved losing state.

Per-position opportunity metrics distinguish physical supply in an optimistic reachable queue from actually observed matching words and categories. Armour coverage and single-point supply dependencies remain visible.

Counterfactuals replay retained routes and separately solve encounters with semantics neutralised, Life disabled, Hit disabled or armour removed (plus grammar removal for archived encounters). Encounters with Revive also get a Revive-disabled comparison, preserving the other special rules. Comparisons report changed hits/recoveries/outcomes and witnessed solution depth/Lives. A truncated counterfactual search cannot prove a mechanic unnecessary. Replays still show exactly where that mechanic changed a real line. Revive's opening use/preservation choices and winning use turns are recorded; avoiding the harmful tile can itself be a valid strategy.

`config.ts` contains editable validation thresholds and score weights. Validation gates solvability, depth, openings, vocabulary, intended mechanics, specials, branching and observed unfairness. Scores reward semantic contrast, multiple routes, useful bait/specials, armour, refill planning, suspense, familiar rescues and redundancy. Unknown fairness and weak evidence are explicit warnings/penalties. Acceptance means **ready for human DEV review**, not certified fun or ready to publish. Play reviewed candidates before treating the score as a measure of enjoyment.

## Intrinsic puzzle difficulty

`difficultyFromAnalysis(encounter, analysis)` derives a `PuzzleDifficultyAnalysis` independently of both the generation quality score and player mode. `difficultyConfig` in `difficulty.ts` exposes depth weights, adjustments and EASY/MEDIUM/HARD/EXPERT thresholds. Minimum words to win is the primary signal. Additional inputs include Lives slack, observed distinct winning strategies and viable openings, the least familiar required word in the best annotated observed route, armour, special-tile/grammar dependence, trap complexity and proved clutch-only dependence. `ratePuzzleDifficulty` also accepts a separate forced-word commonness adjustment when that evidence is available.

The report stores `minimumWordsToWin`, `bestKnownWordsToWin`, `resolveSlack`, `estimatedResolveSlack`, route/opening counts, commonness, mechanic complexity, score, label and evidence. A bounded search can establish a winning upper bound without proving it minimal: in that case `minimumWordsToWin` and `resolveSlack` remain `null`, estimated slack uses the best witness, and `estimated` is true. Route counts are sampled lower bounds; unknown familiarity is not silently treated as obscure. A finish at zero Lives does not prove clutch-only dependence unless the maximum remaining Lives is itself proved.

Archived **CHAOS v11** has a **MEDIUM estimate**, quality score **82.01**, 30 retained winning strategies and 10 retained wins that use a depleted board. **CLEAR → SORT → HARMONY** is a three-word witness, not a proved minimum. **CHARM → SORT → ANGER → SYSTEM → HAND → CAT** demonstrates a six-word final-life finish. The publication review and selected artifact preserve exact tile identities; word spellings alone do not specify which special copy to use.

The archived **DESPAIR v6** has a proved three-word minimum. `scripts/prove-daily-minimum.ts` replays a three-word witness, then enumerates every full-dictionary opening and physically possible second-word finish through the real engine. A necessary matching-letter condition safely skips impossible finishes. The audit covers 17,178 opening selections and 2,824,308 finishing selections without a shorter win, fingerprinted in `src/generator/data/daily-depth-proof.json`. This evidence applies only to that exact v6 encounter, not the changed v7 lexical rules or later ANGER versions.

The archived finite **ANGER v9** has a three-word winning witness and a six-word final-life line, **TEACHER → DOG → PEACEFUL → KIND → RUN → LANE**. In that longer line, PEACEFUL draws replacement letters without a hit; RUN removes R but Revive restores N, and LANE clears it with no refills and ten tiles left before the play. Its MEDIUM difficulty remains an **estimate**, with an unproved minimum. Rescue certification is separate from shortest-route proof.

`scripts/rate-dailies.ts` analyses every published encounter with bounded searches and replayable witnesses. It accepts the proved minimum only for the matching encounter hash and a consistent winning depth. Historical MELANCHOLY ratings remain explicitly estimated. Full reports go to `src/generator/data/daily-difficulty.json`, available through **Development tools → Full puzzle difficulty analysis**. Generated review records also carry their difficulty analysis. Production imports only `src/daily/difficultyLabels.json` and shows the label before Begin: no minimum word count, solution, anchor or full report is shipped through that metadata path. Re-rating does not alter boards, mode allowances or completed results' recorded labels.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Meaning regressions cover dictionary completeness, definition-backed validity, pinned classification, missing/stale tables, disabled grammar/LONG, terminal exhaustion, solver cache separation and historical replay compatibility. Generator tests cover lexical screening, determinism, physical identity and ordering, authoritative transition parity, solvable/impossible fixtures, bounded-search uncertainty, premature hopelessness, final-life rescue, letter scarcity, counterfactuals, mutation validity and ranking. Revive tests include post-strike recovery, duplicate targeting, caps, safe/harmful tile alternatives, solver state identity, opt-in construction and mutation. Difficulty tests cover depth, Lives slack, route scarcity, obscure forced vocabulary and the distinction between a bounded witness and a proved minimum. Existing combat, daily-save, undo, tutorial and presentation tests remain authoritative.

## Generating a reserve of dailies

Generation has two different cost regimes. Preparing licensed source exports, whole-dictionary vectors and base NLI assessments is reusable setup. A new physical candidate reuses those assets, enumerates its supply-compatible vocabulary, requests only missing contextual inputs, then spends search effort on quality assessment and certification. Inflections with identical qualified senses share model work; candidates with overlapping supplies increasingly hit the same cache.

Measured locally after the performance fixes, constructing a representative full-corpus candidate took about 5–6 seconds instead of 33 seconds. That excludes the complete acceptance workflow. A provisional planning range is minutes to tens of minutes per accepted puzzle, depending on rejection rate and opening-proof difficulty; an end-to-end throughput benchmark is still needed. At ten minutes per accepted puzzle, 365 puzzles would require approximately 61 hours of serial background work.

For an annual reserve, generate a surplus and select across enemy concepts, calibrated difficulty, refill budgets, special-tile interactions and route diversity. Deduplicate both physical boards and similar solution structures; 365 distinct seeds do not imply 365 distinct experiences. Freeze scoring and semantic policy first: changing applicable meanings invalidates affected opening certificates. Store successful puzzles independently of calendar assignment, then schedule the reviewed pool. Full first-move recovery remains a per-puzzle release condition, not a batch average.
