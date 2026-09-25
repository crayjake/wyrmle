# ANGER publication and candidate review

September 25, 2026 UTC selects finite **ANGER v9**, candidate `generated-anger-lex2-revive-lexical-v2%3AANGER%3A2%3A0-early-r-long7-finite19-extra-g`. September 24 retains DESPAIR v7, and attempts with committed moves and completed results retain their own saved publication, including ANGER v8. The current frozen snapshot is [`2026-09-25-v9.json`](../src/daily/puzzles/2026-09-25-v9.json). Generation itself never publishes a Daily.

The live labels are Lives, Heart, Hit and Revive. Internal JSON retains `regen`, `ward`, `strikes` and `Resolve` for compatibility. A Heart saves that turn's life cost, without adding a life. Revive recovers a matching enemy letter after hits resolve: a dead copy returns, or an unarmoured living copy gains armour.

## Selected finite variant: 19 replacement tiles

The selected version keeps five lives, **A1 N1 G1 E2 R1**, Hit E, Heart E, Revive N, seven-letter LONG and the broad grammar rules. Its replacement queue is the preceding variant's first 18 letters plus one spare **G**. Once those 19 letters are drawn, used board slots stay empty. The grid retains sixteen positions, and play continues with the letters left. Running out of reserve alone does not end the game.

- Final candidate, fresh analysis and strict publication gates: [`finite-refills-v1/selected.json`](../artifacts/finite-refills-v1/selected.json).
- Exact IDs, remaining lives, per-turn reserve and active tile counts: [`selected-walkthroughs.json`](../artifacts/finite-refills-v1/selected-walkthroughs.json).
- Fresh familiar-opening certificate: [`anger19-extra-g-common-opening-safety.json`](../artifacts/finite-refills-v1/anger19-extra-g-common-opening-safety.json).

The final review passes its configured publication gates with quality **60.70**, estimated **MEDIUM** difficulty (**33**) and **32 observed winning strategies**. **Fourteen** retained wins play at least one word after empty slots appear; **seventeen** play after the reserve has emptied. One observed finish begins with only **eight active tiles**. Revive importance is approximately **0.245**, semantic importance **0.10**, and all **23 assessed reasonable states** have winning witnesses. These are bounded observations, not exhaustive strategy counts or a proof that three words is minimal.

The certificate independently covers **98 curated opening words, all 204 physical selections and all 191 distinct successors**, each with a familiar winning continuation: **204 safe, zero unsafe, zero unknown**. It uses the declared local familiarity scope and minimum rating 0.5. It does not cover every dictionary spelling or arbitrary later play.

| Words | Current finite route | Lives left | Reserve before finish | Active tiles before finish |
| --- | --- | --- | --- | --- |
| 3 | CHEERFUL → GLAD → CANE | 3 | 7 | 16 |
| 4 | REACH → DEAL → GENTLE → END | 2 | 4 | 16 |
| 5 | COURAGE → PEACEFUL → END → SERENITY → GLAD | 1 | 0 | 9 |
| 6 | TEACHER → DOG → PEACEFUL → KIND → RUN → LANE | 0 | 0 | 10 |

The longer examples include deliberate supply decisions. In the five-word line, SERENITY deals no hit but draws the final spare G, leaving nine tiles; GLAD then removes G. In the six-word line, PEACEFUL draws useful letters without damage. KIND exhausts the reserve, RUN deliberately uses Revive N and brings N back after removing R, and LANE recovers for a final-life win. The walkthroughs record these zero-hit turns explicitly; these are not claims that every turn deals damage or that the harmful Revive choice is forced.

This search compared **24 new constructions**: two seeds each for ANGER, FEAR, DESPAIR and CHAOS at limits 12, 18 and 24, then reviewed six truncation/redundancy variants of the existing ANGER board. The seed summary is [`seeds-summary.json`](../artifacts/finite-refills-v1/seeds-summary.json). Plain 18- and 24-letter prefixes passed sampled review but failed the complete declared opening check: **30 physical openings had impossible remaining letter supply**. Replacing an N with G moved the shortage and failed 44 openings. Appending G preserved N redundancy; both 19- and 25-tile variants certified all 204 openings. Nineteen was selected because the shorter reserve influences more observed winning decisions. Validation thresholds were not lowered.

Reproduce the selected review with `node scripts/review-finite-daily.ts`. Its main full-dictionary search uses 360 states, beam 28, 128 retained moves per state, 2,400 physical selections per state and 32 retained wins; counterfactuals use 100 states and beam 16. The report stores all supplied exact-ID hints and the 120-state reasonable-play / 30-final-state budgets. Hints are replayed before contributing evidence. Current pressure metadata and the current opening certificate are tied to the finite encounter; archived certificates cannot transfer to it.

## Archived ANGER v8: seven-letter LONG with padded supply

This preceding variant starts with five lives and enemy **A1 N1 G1 E2 R1**, with **Hit E, Heart E and Revive N**. It uses the frozen broad lexical lookup and `any-recognized` grammar policy. Neutral LONG starts at **seven letters**. The [lexical review](lexical-onboarding-review.md) explains metadata coverage, unknowns and why old single-type rules could miss an adjective bonus. Its snapshot remains at [`2026-09-25-v8.json`](../src/daily/puzzles/2026-09-25-v8.json).

Two deliberate edits distinguish it from the original seed `revive-lexical-v2:ANGER:2:0`: the first refill R moves from index **29 to 12** (zero-based), and neutral LONG changes from **6 to 7**. Earlier R gives more opening choices a recoverable continuation. Raising LONG preserves the value of counter meaning for six-letter words such as GENTLE: a neutral six-letter adjective can no longer duplicate all of that counter's matching hits just by combining LONG and grammar.

- Exact board, queue and mutation provenance: [`early-r-long7-candidate.json`](../artifacts/revive-lexical-v2/anger/early-r-long7-candidate.json).
- Final validation, scoring and bounded analysis: [`early-r-long7-reviewed.json`](../artifacts/revive-lexical-v2/anger/early-r-long7-reviewed.json).
- Three-, four-, five- and six-word replays with exact tile IDs: [`selected-walkthroughs.json`](../artifacts/revive-lexical-v2/anger/selected-walkthroughs.json).
- Familiar opening recoveries with exact physical selections and continuation IDs: [`early-r-long7-common-opening-safety.json`](../artifacts/revive-lexical-v2/anger/early-r-long7-common-opening-safety.json).
- Replayed semantic witnesses, including **REACH → DEAL → GENTLE → END**: [`early-r-long7-semantic-witnesses.json`](../artifacts/revive-lexical-v2/anger/early-r-long7-semantic-witnesses.json). That line wins with two lives; its identical IDs do not finish when semantic effects are neutralized.

| Words | Archived v8 route | Lives left |
| --- | --- | --- |
| 3 | CHEERFUL → GLAD → CANE | 3 |
| 4 | REACH → DEAL → GENTLE → END | 2 |
| 5 | CHEERFUL → END → DOG → CAT → NAIL | 1 |
| 6 | LEARN → PEACEFUL → PATIENCE → KINDNESS → GOLD → SERENE | 0 |

The final report passes its configured publication gates with quality **50.74** and estimated **MEDIUM** difficulty (**33**). It retains **24 observed winning strategies**, **two clutch opportunities** and wins from **23/23 assessed reasonable states**. Semantic counterfactual importance is **0.10** and Revive importance approximately **0.221**. These are bounded observations and score inputs, not exhaustive counts or mathematical guarantees about difficulty. Three words is a witnessed upper bound, not a proof that every one- or two-word route is impossible. Exact physical tile choices matter; word strings alone are not a full replay.

Reproduce this review with `node scripts/review-revive-daily.ts`. It replays all four supplied routes through the actual engine, retains varied winning strategies and requires the matching scoped opening certificate. Invalid hints cannot establish a win, and additional witnesses do not establish a minimum-depth proof.

The v8 rescue certificate covers **98 distinct curated opening words and all 204 physical selections**, yielding **191 distinct successor states**. Every one has a replayed familiar winning continuation; none is unsafe or unresolved within this scope. Familiarity here is the local editorial vocabulary with a minimum rating of 0.5 for continuation words. It is not a corpus-frequency claim or a guarantee about every dictionary word or arbitrary later choice, and it does not certify v9's finite supply.

The report's `all-valid-openings` filter operates **inside a restricted spelling vocabulary**. Physical selection enumeration is complete for that declared set, while `vocabularyComplete` remains false. The older `early-r-full-opening-safety.json` is only a partial full-dictionary search for the earlier **LONG6** variant; it does not certify this **LONG7** publication. Historical scores, mechanic counterfactuals and routes below likewise belong to their exact earlier candidate.

## Historical initial recommendation

The remainder records the initial ANGER/CHAOS comparison before the earlier-R and LONG7 edits. Its original six-letter LONG route using GENTLE is not the current six-word clutch above.

**ANGER, seed `revive-lexical-v2:ANGER:2:0`, is the stronger reviewed rival.** It has ordinary three-, four-, and five-word wins, a six-word final-life rescue, and an actual choice between avoiding REVIVE and recovering from it. Every listed route below was replayed through the real game engine with physical tile IDs.

- Candidate and deeper analysis: [`generated-anger-lex2-revive-lexical-v2%3AANGER%3A2%3A0-deep.json`](../artifacts/revive-lexical-v2/anger/generated-anger-lex2-revive-lexical-v2%253AANGER%253A2%253A0-deep.json)
- Exact route IDs, per-turn hits, enemy recovery, remaining lives and resulting boards: [`winner-walkthroughs.json`](../artifacts/revive-lexical-v2/anger/winner-walkthroughs.json)

| Words | Route | Lives left | REVIVE decision |
| --- | --- | --- | --- |
| 3 | CHEERFUL → GLAD → CANE | 3 | Preserve the original REVIVE N; use a newly refilled plain N to finish. |
| 4 | HEARTY → PAGE → END → CANE | 2 | END removes N, then REVIVE brings it back; CANE clears it again. |
| 5 | CHEERFUL → END → DOG → CAT → NAIL | 1 | Recover from using REVIVE N in END, then finish with short familiar words. |
| 6 | LEARN → PEACEFUL → PATIENCE → KINDNESS → GENTLE → SERENE | 0 | LEARN upgrades N to armour. Every turn deals damage; SERENE wins on the final life. |

The five-word line deliberately illustrates recovery from a harmful choice; END makes no net enemy progress because N returns. The six-word line is a real damage-dealing clutch, not a sequence padded with zero-hit turns. The heart tile is spent on turn two in that clutch, so its extra turn matters.

Other observed three-word finishes after CHEERFUL → GLAD include DANCE, END, NOTE, OCEAN, PAIN, PANIC, PATIENCE and PIANO. These alternatives are stored as engine witnesses in the deeper analysis; available physical selections depend on the preceding choices.

The opening enemy has six hit points: **A1 N1 G1 E2 R1**. The special tiles are HIT E, heart E and REVIVE N. The deeper quality score is **47.65**, and the estimated difficulty is **MEDIUM**. Three words is the shortest observed win, not a proved global minimum.

REVIVE's measured counterfactual importance is **0.262**. Removing the mechanic allows an observed two-word win instead of the observed three-word best with it. All six counterfactual route replays changed both outcomes and recovery events. Winning witnesses include both using and preserving REVIVE, and its use occurs at several different turns.

### Comparison

| Candidate | Deeper quality | Validator at that review | Evidence |
| --- | ---: | --- | --- |
| ANGER `:2:0` | 47.65 | Accepted for development review | Common 3/4/5-word routes; genuine 6-word clutch; 39 sampled reasonable states have winning witnesses. |
| ANGER `:4:0` | 47.25 | Accepted for development review | FORGIVE → DEAL → RUN and DREAMY → FORGIVE → RUN; GREEN → MERCY → PEACEFUL → GENTLE → PATIENCE in five words; weaker measured REVIVE relevance (0.076), no clutch found. |
| CHAOS `:5:0` | 28.03 | Rejected on deeper review | Initially accepted at a smaller budget, but deeper review finds negligible semantic and HIT influence; 36 of 39 sampled reasonable states remain unclassified. |

The CHAOS candidate should not be promoted from its earlier shallow acceptance. Search budgets can change retained witnesses and counterfactual estimates, so deeper review is material here.

### Fairness limits

ANGER `:2:0` has **39/39 sampled reasonable states with winning witnesses**, no sampled proven losses and no sampled unknown states. This is encouraging evidence, not certification of every opening or continuation. The analysis uses score-filtered, bounded sampling; its physical opening discovery is incomplete. It does not justify saying that every reasonable-looking word is safe, that all wins use familiar vocabulary, or that hidden refills can never strand a player.

In particular, winning witnesses for the sampled states do not automatically establish a common-word escape for *every* physical opening. A separate publication gate must check the desired opening set and retain an explicit familiar continuation per tested opening. The exact three-word and longer routes above are familiar witnesses for their own states only.

The pre-solver lexical audit enumerates all **4,973** dictionary spellings fitting the opening board, independent of the solver's state and move budgets. It reports known, ambiguous and unknown classifications honestly: **2,442** of those spellings have unknown POS and **4,962** have no listed semantic relation. The full opening-plus-refill letter supply is only a spelling superset, not proof that every listed word occurs on a reachable board. This candidate therefore demonstrates the new audit and classifier pipeline; it does not claim a complete English semantic ontology.

### Reproduction and stored reports

The broader initial sweep evaluated **108 seeds**: 48 DESPAIR, 48 FEAR, six ANGER and six CHAOS, followed by deeper shortlisted reviews. The ANGER/CHAOS comparison below used six seeds per enemy, current lexical mode, REVIVE enabled, no refinement, solver 80 states / beam 12, counterfactual solver 20 states / beam 8.

```sh
node scripts/generate.ts --count 6 --enemy ANGER --seed revive-lexical-v2:ANGER --out artifacts/revive-lexical-v2/anger --refine 0 --states 80 --beam 12 --counterfactual-states 20 --regen
node scripts/generate.ts --count 6 --enemy CHAOS --seed revive-lexical-v2:CHAOS --out artifacts/revive-lexical-v2/chaos --refine 0 --states 80 --beam 12 --counterfactual-states 20 --regen
```

All twelve generated boards had a winning witness. Two ANGER boards and one CHAOS board passed the initial validator. The three initial acceptances were reanalysed with solver 300 states / beam 36 / up to 60 retained wins; counterfactual 60 states / beam 12; up to 100 sampled reasonable states; and the construction route supplied only as a replayed hint. See each enemy's `report.json`, `top.json`, and `review-deep.json` under `artifacts/revive-lexical-v2/`.
