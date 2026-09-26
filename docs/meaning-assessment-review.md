# September 26–27: assessed CHAOS v13

V13 corrects the player-reported **HALCYONS** miss. Its stored noun sense explicitly describes mythical birds that calm winds and waves; it now counters CHAOS through that sense. HALCYON remains a counter through its peaceful adjective. This is a source-level correction, not blanket inheritance of adjective labels by plural nouns. [American Heritage](https://ahdictionary.com/word/search.html?q=halcyon) independently corroborates the calming noun sense.

Exactly one of the 10,379 previously audited word records changed; the other 10,378 digests match. The actual model response remains intact and the amendment is marked `source-reviewed`. The supply now has **300 counters, 82 resisted words and 9,969 neutral words**. All **270 semantic regressions** pass, including the new noun-sense regression. This does not establish perfect unseen semantic judgement.

The physical puzzle is unchanged. All **8,041 physical openings** were freshly replayed and certified again, and the three-word minimum was independently proved again. Fresh attempts on both dates use v13; played, undone and completed v12 attempts retain their exact meanings until reset.

Current proof and walkthrough artifacts are in `artifacts/meaning-v4-halcyons/`. The source amendment is in `artifacts/semantic-assessment/evaluation/halcyons-correction/`. The separate [puzzle-design workbench](../artifacts/puzzle-design-2026-09-26/index.html) records balance experiments and unpublished drafts; their enemy-health changes are not part of v13.

## Original v12 design review (historical)

Both dates use the same frozen challenge. September 25 remains v11; played, undone and completed attempts keep their original rules. Fresh attempts and explicit resets load the publication for their date.

The sixteen starting tiles spell `OABRYDSHCGLENRMA`. Hit is A at slot 1, Life is R at slot 13, and Revive is A at slot 15 (zero-based). The enemy has two health on A and O, one on C, H and S. There are five lives and twelve finite replacements, `ETSRENHACAOO`, with no grammar or length bonuses.

## Semantic evidence

Every one of the **10,351** accepted supply spellings has frozen definitions, source senses and actual contextual review of all its dictionary senses. The final inventory contains 299 counter spellings, 82 resisted spellings and 9,970 neutral spellings. The audited inventory registry also covers 28 evaluation spellings outside this puzzle.

The pinned local reviewer proposes source categories and independently verifies scoring proposals. Explicit editorial source corrections preserve the raw model responses. The final hybrid passes **269/269 semantic regression cases**, including required-source checks. Raw model failures, the 142-entry source review ledger and audit queues remain available. These results establish zero known regression errors, not perfect unseen linguistic judgement. New spellings or changed final meanings cannot publish without a matching inventory audit. See [offline reproduction](offline-semantics.md) and [benchmark history](semantic-benchmark.md).

## Choices and difficulty

The board has **65 familiar counter spellings across 39 lemmas**. Of those, 49 have physical choices producing multiple hits and 45 gain hits specifically from their meaning compared with the identical neutral selection. Examples include CALM, CLEAR, HARMONY, BALANCE, ORDER, REASON, MARSHAL and ARRANGE. Inflected spellings are counted separately from lemma diversity.

The retained review has 30 distinct strategies, 29 familiar opening spellings and 16 counter lemmas used in actual wins. Routes run from three to five words; 18 continue after empty board slots appear. **AGO → RESEARCH → REASON** wins in three words. **CHANGE → SORT → HAD → COOL** and **RECORDS → HAS → CLEAR → GONE → BOY** illustrate longer alternatives. Exact special-tile choices are in the walkthrough artifact; spellings alone do not specify a route.

Quality is **77.16** and the bounded difficulty rating is **MEDIUM**. Replaying every retained witness with each mechanic disabled shows material effects from semantics, Life, Hit, armour and Revive. The rating remains an estimate of difficulty, not a calibrated prediction of player success.

## Independent proofs

All **3,060 opening spellings / 8,041 physical selections**, producing 5,503 distinct successor positions, have independently replayed winning continuations using familiar words. There are **zero unsafe and zero unknown openings**. This guarantees recovery after the first word; later choices can still lose.

A separate exhaustive audit proves a **three-word minimum**. It enumerated every physical opening, ruled out one-word wins, examined every possible second word with enough matching copies to finish the remaining health (95 physical finishing selections), and replayed the three-word witness. The bounded gameplay review retains its original search-limit flags; the separate proof is stored alongside it.

The earlier semantic candidate allowed `CRADLESONG → HARMONY` in two words. Extra H armour made openings unsafe; delaying N still allowed `CORRALS → HARMONY`. Moving both refill O tiles to the end removed every one- and two-word win while preserving the audited vocabulary. The final layout was then certified from scratch.

## Artifacts and reproduction

- `artifacts/meaning-v3/selected.json.gz`: complete encounter, review, validation and opening certificate.
- `artifacts/meaning-v3/walkthroughs.json`: exact replayable retained routes.
- `artifacts/meaning-v3/minimum-proof.json.gz`: encounter-bound exhaustive shortest-win audit.
- `artifacts/meaning-v3/summary.json`: counts, choices, difficulty and limitations.
- `artifacts/semantic-assessment/evaluation/contextual-final`: actual hybrid and raw-model results plus source audits.

Extract the selected artifact to a JSON file, then run `node scripts/prove-assessed-minimum.ts SELECTED.json PROOF.json` to reproduce the depth audit. The [candidate notes](../artifacts/semantic-assessment/compact-candidate/README.md) document fresh semantic compilation, complete opening certification, gameplay review and packaging. Packaging independently re-enumerates and replays every opening before writing a daily.

## Final verification

All 551 Node tests and 24 Python tests pass, as do typecheck, lint and the production build. Mobile Chromium checks at 375 × 667 play both dates to victory, preserve an existing v4 attempt and detect no runtime errors or horizontal overflow. A browser generation batch completes without errors and witnesses six solvable candidates; its stricter DEV gates correctly keep all seven evaluated candidates out of the accepted list. Exact check counts are stored in `artifacts/meaning-v3/verification.json`. These are repository changes; no remote deployment was performed.
