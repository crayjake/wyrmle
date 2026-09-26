# Compact candidate and final assessment

This directory preserves the original twelve-refill authoring candidate and its earlier baseline witness library. The September 26–27 v12 publication uses the same board and total letter supply, with both O refills moved to the final two positions (`ETSRENHACAOO`). That blocks the two-word shortcut found after the semantic corrections. The final encounter, classification table and fresh opening proof are stored together in `artifacts/meaning-v3/selected.json.gz`.

The baseline witnesses are only route suggestions. They cannot certify changed meanings or refill order. `prepare-assessed-openings.ts` recompiles the actual current semantic provider, enumerates every physical opening, replays usable hints and searches unresolved positions. Missing reviews, unknown openings and proved unsafe openings all prevent publication. The tool writes independently verified checkpoints every minute; pass its last `opening-safety.json` as the witness input to resume.

For a fresh candidate:

```sh
node scripts/prepare-assessed-openings.ts CANDIDATE.json OLD_PROOF.json OUTPUT_DIRECTORY --states 500 --seconds 600
node scripts/review-assessed-daily.ts OUTPUT_DIRECTORY/candidate.json OUTPUT_DIRECTORY/opening-safety.json REVIEWED.json
node scripts/prove-assessed-minimum.ts REVIEWED.json MINIMUM_PROOF.json
node scripts/package-assessed-daily.ts REVIEWED.json
```

Publication is wired directly in the dated catalog for **2026-09-26 and 2026-09-27**. September 25 remains v11. The adjacent `publication-v12.patch` is an archived, superseded preparation artifact from the previous work; do not apply it to the current tree. Played, undone and completed saves retain their original frozen encounter; fresh attempts and explicit resets use the dated publication.
