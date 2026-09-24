# Generator, solver and review workflow

This is a local **development review pipeline** for the current letter-strike game. Generated encounters use the existing `createLetterStrikeGame`, `previewLetterStrike` and `submitLetterStrike` functions. Nothing is published automatically. The highest-ranked reviewed MELANCHOLY candidate was explicitly selected for September 24, 2026; its independent runtime snapshot is puzzle version 5 using the existing v4 combat rules. Started/completed older attempts remain pinned to their original version, while new and untouched attempts get the selected board.

## Run and play

```sh
npm run dev
```

Open `http://localhost:5173/?generator=1`, or **Settings → Development → GENERATOR / SOLVER**. The initial review set contains five generated MELANCHOLY candidates. Each card shows the board, tile IDs and specials, armour, refill blocks, semantic anchors, acceptance reasons, metric uncertainty and score contributions. Winning and rescue lines are behind expandable details. **Play** loads the encounter into the existing DEV battle, using the real game components and transitions. **Return to generator** preserves the review session. Playtests do not write daily history.

Enter an enemy, seed and candidate count to make another batch. Automatic mode screens the provider's enemy concepts first. Generation runs in a cancellable worker so the page remains usable. Solver answers and the generator worker/data are excluded from production builds.

## Batch commands

```sh
# 200 initial MELANCHOLY candidates; JSON and report written locally.
npm run generate -- --count 200 --enemy MELANCHOLY --seed review --out artifacts/melancholy

# 1,000 seeds with automatic suitability-based enemy selection.
npm run generate -- --count 1000 --seed discovery --out artifacts/generated

# Evaluate nearby mutations as well as each initial construction.
npm run generate -- --count 40 --enemy MELANCHOLY --seed refine --refine 1 --mutations 2

# Explicitly replace the five DEV examples with this batch's best accepted boards.
npm run generate -- --count 40 --enemy MELANCHOLY --seed review --dev-top

# Reanalyse a saved shortlist after tuning metrics, without changing its boards.
npm run review-generated -- --input artifacts/melancholy/top.json --dev-top
```

`--count` counts requested initial seeds. `attempted` also counts evaluated mutations and automatic enemy fallbacks. Generation is CPU work: large batches can take minutes or hours. Progress and `report.json` are updated after each seed. Accepted candidates are separate JSON files; `top.json` contains the best twenty. The five DEV examples keep the highest-scoring variant from each construction family, so a parent and a nearly identical mutation do not occupy two review slots. Reports include enemy/candidate rejections, archetypes, explored states, elapsed time, hopelessness/clutch distributions, scores and accepted candidate seeds. `--states`, `--beam` and `--counterfactual-states` expose search budgets. Identical seeds, lexical data, options and code produce identical candidates and rankings; timing fields are intentionally nondeterministic.

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
```

Both generation entry points return a `GenerationResult` containing the enemy suitability report, all ranked evaluated candidates, accepted candidates, rejection counts and provenance. All candidates use `CandidatePuzzle`. `accepted` can be empty; unsuitable enemies and unconvincing boards are never forced through. Load saved JSON for a mutated candidate, whose parent and mutation list are recorded.

## How construction works

1. **Enemy suitability.** Familiarity, definition quality, part-of-speech clarity, valid counter/resisted/related counts, counter letter coverage, ordinary English letter proportions, length and semantic confidence contribute explicit weighted scores. Hard gates reject missing senses, sparse semantic neighbourhoods and inappropriate lengths. `enemySuitability.ts` holds thresholds and weights. `selectEnemy` makes a seeded suitability-weighted choice; automatic generation can try another suitable concept when boards are rejected.
2. **Local word pools.** `LexicalProvider` is replaceable. The initial implementation is a small, inspectable curated semantic resource over the existing bundled dictionary. It supplies six enemy concepts and familiar construction vocabulary, not comprehensive English semantics. Familiarity numbers are curated estimates, **not measured corpus frequencies**; unknown words remain unknown. Counter concepts may include a clear antidote such as COMEDY against sadness. Related words remain neutral. The final encounter serializes complete relation lists and POS annotations; runtime never calls a provider, API or LLM.
3. **Roles and board.** Seeded archetypes select counters, resisted bait, grammar opportunities and ordinary alternatives. Their letter **multiset union** shares physical tiles between words. Additional letters complete nearby real words; English-weighted filler is a fallback. The sixteen letters are shuffled. Ward prefers a duplicated shared letter, offering preserve/spend choices. Strike prefers an enemy match within resisted bait. Armour favours letters with several vocabulary routes.
4. **Refills.** Forward planning evaluates actual selected IDs through the engine, preserves unused tiles, identifies missing letters for a later word, and places those letters in the next consumed-slot refill block. It targets several useful turns instead of maximising immediate strikes. Clutch goals target the last available Resolve. The remaining queue cycles lexical support blocks and meets the engine's worst-case capacity requirement. A construction trace is only a hypothesis until its IDs replay successfully; it is not the final answer or an optimality claim.
5. **Refinement.** A small deterministic beam retains high-scoring validated parents and evaluates nearby mutations. Primitives edit starting/refill letters, swap slots, move Ward/Strike, alter armour or its duplicate copy, replace an anchor, and optionally adjust Resolve. Every mutation is analysed afresh. No mutation inherits a parent's winning proof. `refinementRounds`, `mutationsPerRound` and `refinementBeamWidth` bound the work.

## Solver guarantees and limits

`findValidMoves(state)` enumerates dictionary words with actual physical tile assignments. Each move comes from `submitLetterStrike`: semantic class, POS, grammar/LONG allowances, Ward/Strike use, ordered enemy hits, Resolve cost and successor state all come from gameplay. Different consumed board slots and special-tile ordering remain distinct. Equivalent permutations of identical copies within the same consumed set are canonicalized.

`solvePuzzle` supports BFS and beam search. A state key includes encounter semantics/rules/refill data, ordered board identities and types, enemy positions and armour, Resolve, refill cursor and next tile ID. History and selection/error UI fields are omitted because repeated words are legal and they do not affect future moves.

The practical default is bounded beam search over the full local dictionary, with diversity across opening words. Winning lines are real replayable witnesses. Search pruning, move caps, state caps and optional restricted vocabulary are reported. **Unknown is not impossible.** `bestWinDepth` is a witnessed depth; `minimumTurnsToWin` is populated only when the shallower search is complete. Winning line counts, viable openings and letter opportunities are lower bounds, not exhaustive totals. Restricted vocabulary can establish a win but cannot establish impossibility for the full game.

Current rules include neutral-only LONG +1 for words of six or more letters, adjective +1, independent Strike, deterministic wounded-first duplicate targeting, and victory before Resolve loss. No numeric-damage assumptions enter the generator. Difficulty is presentation only and is not an input to generation or solving.

## Fairness, rescue and mechanics

Reasonable-play sampling follows useful moves within an editable immediate-score margin, with several distinct words per state. It alternates breadth and depth within the fixed state budget, and follows promising branches omitted by the main search. For sampled states with Resolve above one, proven wins, proven losses and unresolved states are counted separately. A complete successor search or insufficient physical letter supply can prove a loss; merely failing to find a win cannot. The conditional dead-state rate is accompanied by assessed coverage and lower/upper bounds that include uncertainty. This is a **bounded sample**, not a guarantee about every reasonable player decision.

At final Resolve, the analyser discovers actual one-move wins and records the preceding route, remaining letters, tile IDs, word lengths, familiarity and a difficulty estimate. These are observable rescue opportunities, including ordinary finishes; long, less-obvious familiar words can score better as clutch opportunities. Ward can extend a final-Resolve state, so a missing immediate rescue is distinct from a proved losing state.

Per-position opportunity metrics distinguish physical supply in an optimistic reachable queue from actually observed matching words and categories. Armour coverage and single-point supply dependencies remain visible.

Counterfactuals replay retained routes and separately solve encounters with semantics neutralised, Ward disabled, Strike disabled, grammar removed or armour removed. They report changed strikes/outcomes and witnessed solution depth/Resolve. A truncated counterfactual search cannot prove a mechanic unnecessary. Replays still show exactly where that mechanic changed a real line.

`config.ts` contains editable validation thresholds and score weights. Validation gates solvability, depth, openings, vocabulary, intended mechanics, specials, branching and observed unfairness. Scores reward semantic contrast, multiple routes, useful bait/specials, grammar/armour, refill planning, suspense, familiar rescues and redundancy. Unknown fairness and weak evidence are explicit warnings/penalties. Acceptance means **ready for human DEV review**, not certified fun or ready to publish. Compare the five examples by playing them before treating the score as a measure of enjoyment.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Generator tests cover lexical screening, determinism, physical identity and ordering, authoritative transition parity, solvable/impossible fixtures, bounded-search uncertainty, premature hopelessness, final-Resolve rescue, letter scarcity, counterfactuals, mutation validity and ranking. Existing combat, daily-save, tutorial and presentation tests remain authoritative.
