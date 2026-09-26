# Bingo-first generation: three, four or five lives?

**The approach is feasible and worth developing. Three lives is the strongest first design target; four is a useful forgiveness comparison. Five makes ordinary counter-then-neutral cleanup substantially easier.** Life count alone does not produce an interesting puzzle: the enemy, armour, refill reserves and repeated semantic decisions need to be designed together.

This is an authoring study, not a replacement daily or a new certified preview. It leaves the game, existing beta, daily catalog and semantic caches unchanged. The prototype implements the proposed construction direction and compares actual engine outcomes. It does not establish human difficulty or error-free meanings.

**Phone playtesting is now available:** Settings → Beta puzzles opens the ten frozen study boards with selectable lives. The picker uses `?preview=bingos`; a direct example is `?preview=bingo-chaos-1&lives=3`. [Preview URLs and export instructions](../bingo-previews-2026-09-26/README.md). These remain draft meanings; the export is separate from daily publication.

## Comparison with the existing generator

The existing sustained-discovery generator already starts with semantic word pools, selects counter and resisted anchors, fills overlapping letter multisets and plans refills through the engine. The main addition is fixing a guaranteed winning counter and its armour first, then assessing the ordinary game independently of that shortcut.

| Aspect | Existing sustained-discovery method | New bingo-first prototype |
| --- | --- | --- |
| Starting point | Enemy, semantic pools and several opening anchors | Enemy/counter pairs whose letter multisets can deliver every required hit |
| Armour | A separate pressure target informed by enemy length and vocabulary | Extra copies of enemy letters in the bingo determine available armour |
| Starting tiles | Fit several counter/resisted anchors, then fill spare slots | Reserve the bingo, then use the remaining slots for overlapping counter/resisted families |
| One-word win | Normally rejected by the minimum-turn gate and penalised in scoring | Deliberately present; excluded from ordinary-route quality measurements |
| Refills | Forward planning and semantic replenishment, followed by analysis/refinement | Reuses that planning machinery; pilot compares identical supplies across life counts |
| Main strength | More freedom to choose enemies, armour and varied multiword routes | A concrete hidden reward and a useful constraint on the starting letter inventory |
| Main constraint | A rich opening can still deteriorate into cleanup; journey checks matter | The bingo can crowd out other anchors or leave easy near-bingo cleanups; branch checks matter |
| Meaning correctness | Compilation, contextual review and final inventory certification | Requires the same independent review; generating labels does not replace it |
| Current interface | General `npm run generate` workflow with its existing flags and validation | Reproducible `npm run assess:bingo` experiment with five fixed pairs and two seeds each |
| Current output | Ranked draft candidates, with publication subject to the required gates | Board/refill strings, route witnesses and reports; a separate export creates public practice previews |

**Preference:** for the intended hidden-bingo, repeated-counter puzzle, prefer bingo-first construction with three lives, combined with the existing semantic review and full validation infrastructure. Retain ordinary sustained-discovery construction for enemies without a good bingo. The new prototype has not yet demonstrated automatic publishable quality, so this preference is a design direction rather than a claim that it can replace the current pipeline today.

You can run the new method yourself. A local script reproduces the construction and analysis from deterministic seeds. It is currently a standalone assessment command: it does not add a bingo flag to `npm run generate`, accept an arbitrary enemy through CLI flags, or automatically choose the best publishable puzzle. `npm run export:bingo-previews` freezes the assessed boards for the public practice picker; it never changes the daily catalog.

## What was tested

The [reproducible script](../../scripts/assess-bingo-generation.ts) first inventories all six enemies supported by the current semantic provider. It then constructs two fixed seeds for each of five enemy/bingo pairs, deriving armour from the bingo, adding compatible counter/thematic anchors, filling sixteen tiles and planning a finite twenty-four-letter refill queue.

Every board and refill order is held identical at three, four and five lives. Refills are planned for three turns; this isolates the effect of lives, rather than comparing separately optimised generators. All tiles are normal, without Hit bonuses, Life extensions, Revives, length bonuses or grammar bonuses.

Per board, the analysis samples four familiar counter openings, four additional high-damage counter families, two familiar neutral openings and two resisted openings. Every initial one-word winning spelling is excluded throughout the alternative-route search, including later turns. A guaranteed bingo therefore cannot hide a lack of ordinary solutions. Successful lines are replayed through the real engine at every applicable life count.

Search uses one canonical physical selection per word, familiar vocabulary, up to eight productive children per state and a twelve-state beam. A missed route is **unknown**, unless the separate remaining-letter check proves that the supply cannot cover the remaining enemy HP. This is not an exhaustive safety certificate.

## The life comparison

Results across ten boards and 120 sampled openings:

| Starting lives | Openings with a replayed alternative win | Openings allowing one counter then ≥2 neutrals | Proven supply failures | Still unresolved within budget |
| --- | ---: | ---: | ---: | ---: |
| 3 | 94 / 120 | 17 / 80 counter openings | 7 | 19 |
| 4 | 110 / 120 | 29 / 80 counter openings | 7 | 3 |
| 5 | 111 / 120 | 40 / 80 counter openings | 7 | 2 |

The cleanup column uses two simple neutral policies, familiar-first and shortest-first. It counts openings, not duplicated routes, and excludes a single neutral finishing word. Absence of a witnessed cleanup does not prove that none exists. These are **mechanical results under existing draft semantic labels**, which include unreviewed and questionable classifications; they are not acceptance rates for publishable puzzles.

Four lives rescued considerably more sampled openings. The fifth rescued only one additional opening in this pilot, while enabling eleven additional counter-then-two-or-more-neutral cleanups. This supports trying three first and using four as the playtest comparison. It does not establish three as universally best, especially for longer enemies or less experienced players.

The two CHAOS / CHOREOGRAPHS boards illustrate the intended trade-off particularly clearly:

| Lives | Alternative winning openings | Counter-then-≥2-neutral opening wins |
| --- | ---: | ---: |
| 3 | 16 / 24 | 0 / 16 counters sampled |
| 4 | 22 / 24 | 7 / 16 |
| 5 | 22 / 24 | 8 / 16 |

A source-supported bingo is **CHOREOGRAPHS**, using the sense of planning and overseeing the details of something. It contains every CHAOS letter, including two Hs and two Os. Armour on H and O gives seven enemy HP and leaves four free board slots. Both constructed boards have CHORDS → HARMONY wins. On the first, COMPOSED → HALCYON → HER also wins. These are draft route witnesses, not endorsements of all other meanings on those boards.

On that first board, CHORDS → AGE → BOY → HOT wins with four lives, while three lives runs out before HOT. Armour and the life budget together make finding the second counter valuable.

## Three lives still needs an anti-cleanup check

The existing ORCHESTRATES preview stops CALMS → HEN → OAR → SEA at three lives; the exact same line wins at four and five. But the wider study also found **CLASS → HER → HOT**, which wins the existing preview in three: CLASS does four damage, then two neutral words finish it. Reducing lives was never a complete solution to neutral cleanup.

The relevant cheap check is:

> After a first word does h damage against H enemy HP, an all-neutral finish needs at least H − h more turns. With L starting lives, it fits the turn budget when H − h ≤ L − 1, subject to letters being available.

A six-HP enemy with three lives can therefore still be vulnerable to a four-hit opener followed by two neutrals. A seven-HP enemy needs a five-hit opener to do the same. Screen strong familiar non-bingo openings explicitly; checking only ordinary/frequent openings misses these shortcuts. One neutral finishing word can remain useful without letting it dominate the whole puzzle.

## How restrictive is finding the bingo?

The counts below are **existing model-labelled proposals**, before independent sense review. They describe the current pools, not all possible English words. A family uses the stored lemma; plural and tense variants do not count as wholly different discoveries.

| Enemy | Spellings covering all enemy letters, ≤16 tiles | Spellings allowing ≥2 armour positions | Distinct lemmas among those |
| --- | ---: | ---: | ---: |
| ANGER | 61 | 19 | 15 |
| CHAOS | 17 | 3 | 2 |
| CRUELTY | 3 | 1 | 1 |
| DESPAIR | 2 | 0 | 0 |
| FEAR | 32 | 5 | 4 |
| MELANCHOLY | 0 | 0 | 0 |

Treat five as a target number of **alternative candidate bingos**, then construct a board around each. Requiring five strong independent families would currently exclude most of these enemies. Combining all five bingos into one starting multiset would impose a much stronger and usually unnecessary constraint.

The construction pilot used:

| Enemy | Bingo | Armour | Total enemy HP | Free starting slots |
| --- | --- | --- | ---: | ---: |
| CHAOS | CHOREOGRAPHS | H, O | 7 | 4 |
| ANGER | ENDEARING | N, E | 7 | 7 |
| ANGER | ENCOURAGEMENT | N, E | 7 | 3 |
| CRUELTY | RESPECTFULLY | E, L | 9 | 4 |
| FEAR | SAFEGUARDED | E, A | 6 | 5 |

Not every mechanically suitable pair makes a satisfying puzzle. ENDEARING is shorter and easier to spot than a twelve-letter bingo; RESPECTFULLY leaves a strong RESPECTFUL near-bingo that can enable cleanup. These are things to score or reject, not proof the method fails.

Count repeated **enemy** letters, not every repetition in the counter. ORCHESTRATES repeats R, E, T and S, but only S belongs to CHAOS: it supports one armour position. Also use letter multiplicities, not set membership, when the enemy itself repeats a letter. Each enemy position currently allows at most two HP.

## What the generator needs to optimise

1. **Propose and independently check enemy/bingo pairs.** Attach the exact intended sense, reject strained associations, rank fair but less obvious discoveries, and deduplicate inflections. Zero proposals means expand the candidate enemy list or relax the optional armour preference; more player lives cannot create a missing bingo.
2. **Build overlapping word families around the bingo.** Prefer a small shared letter palette, several distinct counters and familiar resisted anchors. Neutral words arise abundantly from the same letters; they need measurement more than deliberate encouragement. Penalise uncontrolled growth of the total meaning inventory.
3. **Plan ordinary winning endings, then support several openings.** The bingo is an optional reward. Demand multiple two/three-word alternatives using different counter families, including another useful counter after the opening. Preserve the desired resisted-finisher / clever-counter contrast when several enemy HP remain.
4. **Check refills across branches.** A single global queue must serve different consumed word lengths, physical tile selections and refill offsets. It cannot be designed independently for each branch. Seven sampled openings here consumed a required letter permanently; even five lives could not save them. For example, LOOSE consumed too much O supply on one H/O-armoured CHAOS board. Reserve matching letters and validate their arrival in time, not merely their presence somewhere in the queue.
5. **Score the later positions and the shortcuts.** Check turns two and three, and a fourth when an intentional Life extension allows it. Count distinct counter families and actual extra damage from meaning, not many inflections or one-hit words labelled COUNTER. Test high-damage openings followed by simple neutral policies. Separately sample a plausible resisted mistake and require an approachable recovery where that is part of the design.
6. **Test salience as well as availability.** Having several resisted words somewhere among hundreds of anagrams does not mean they jump out. Corpus familiarity is only a proxy; the current scale also ties many very common words. Board arrangement, recognisable letter chunks, word length and playtesting need to establish whether the obvious words really are the bait. The pilot does not claim this is solved.
7. **Certify the final inventory and physical routes.** Freeze meanings, re-run the engine checks after any semantic correction, then perform the publication-grade checks on finalists. Use cheap filters and bounded search while proposing; spend exhaustive effort on shortlisted boards.

This should be a separate bingo design profile. The normal validator currently rejects a witnessed win shorter than three turns and the scorer penalises one-word wins. Simply lowering that minimum would allow the bingo to mask weak ordinary play. The new profile needs separate checks for the one-word discovery and the non-bingo puzzle.

## Semantic feasibility and review cost

Generating category-labelled words is a useful way to propose a coherent theme. It is not semantic proof: the generator can supply the wrong category or rely on a strained sense, and the board permits extra anagrams it never proposed. Plurals, tenses and other senses must be checked too.

There are concrete concerns in the current draft pool: FERMENTING is marked as a counter to ANGER despite the stored sense being agitation/excitement, with an explanation that jumps to DELIGHT. PATRONISED is proposed against DESPAIR using the regular-customer sense and an explanation based on ENCOURAGE. Neither is acceptable evidence for the proposed counter without further review. The exact stored records are preserved in `report.json`; this study does not silently correct or certify them.

The ten constructed supplies produced **11,616–55,124 definition-backed spellings** in the compiler's conservative full-supply inventories. Those are not all necessarily reachable on one board, but the publication pipeline must account for them under its current policy. For comparison, the existing preview has 5,489 entries. Broad refill alphabets can make semantic review much more expensive than constructing the bingo.

Keep source-backed, independently reviewed relations cached per enemy/sense, constrain the supply palette, enumerate unexpected words, and reject unresolved or inconsistent final classifications. Correcting a relation can invalidate a winning witness or introduce a cleanup shortcut, so semantic review and gameplay validation must feed back into each other. No zero-error guarantee is established here.

## Search cost and special tiles

The recorded run on Node 26 took about **35 seconds** after module loading for the inventory, ten draft constructions, all combined life-budget analyses and the existing-preview controls. About 8.8 seconds were candidate construction and 23.3 seconds the ten candidate analyses. This is a small deterministic pilot with cached semantics, not a production throughput benchmark or an independent speed measurement for each life count.

The early bingo/multiset filters are cheap and largely independent of lives. Deeper validation grows quickly: a hypothetical twenty retained choices per turn gives 8,000 three-word sequences, 160,000 four-word sequences and 3.2 million five-word sequences before caching, pruning or early wins. Physical duplicate-tile selections can add more branches. Three is easier to audit deeply, although it can be harder to find fair candidates that survive its tighter deadline.

**LIFE and REVIVE do different jobs.** LIFE saves the cost of a player turn; one Life tile can permit four words from three starting lives. REVIVE restores enemy HP and does not extend player life. Engine controls confirm:

- Putting Life on L in the existing preview lets CALMS → HEN → OAR → SEA win from three lives. An extra turn also reintroduces cleanup, so it needs the same audit as four starting lives.
- Putting Revive on a mandatory S makes ORCHESTRATES leave one enemy HP alive. A guaranteed bingo must avoid an unavoidable matching Revive tile, or the post-hit healing defeats it.

Start with **three ordinary lives and no specials** to establish the core puzzle. Compare four lives in playtests. Introduce an occasional, deliberately audited Life opportunity once it creates a worthwhile choice. Revives can create a different letter-management problem, but adding them is not a substitute for checking the semantic routes.

## Reproduce and inspect

```sh
npm run assess:bingo
node --test --test-isolation=none tests/bingo-preview.test.ts
```

- [inventory.json](inventory.json): every proposed letter-covering bingo, definitions, familiarity and armour.
- [candidates.json](candidates.json): fixed seeds, board/refill strings, exact route tile IDs, root classifications, supply deficits, sampled later boards and cleanup witnesses.
- [report.json](report.json): methodology, aggregate comparison, timing, semantic concerns and existing-preview / special-tile controls.

The script asserts bingo wins, armour derivation, route legality and win replays under the relevant life budgets. The existing five beta regression tests pass. The study script also passes a standalone TypeScript check and lint. No full application or CI change is needed for this assessment.
