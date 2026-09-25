# Draft compact candidate

This physical candidate has twelve finite refills, one Hit tile, one Life tile, and one enemy Revive tile. It is an offline authoring input, not a published daily puzzle. Its stale draft meaning table is deliberately omitted.

The compressed baseline witness library covered 8,041 physical legal openings under an earlier vector/NLI classification. It is only a source of candidate routes: its certificate is not valid for current meanings. `scripts/prepare-assessed-openings.ts` compiles current, complete contextual meanings, re-enumerates every opening, replays these routes through the current engine, and searches remaining cases. Missing contextual reviews or an incomplete final proof prevent publication.

Once contextual review is complete, run:

```sh
node scripts/prepare-assessed-openings.ts artifacts/semantic-assessment/compact-candidate/candidate.json artifacts/semantic-assessment/compact-candidate/baseline-opening-witnesses.json.gz /tmp/wyrmle-final-openings --states 500 --seconds 600
```

The output candidate and opening-safety certificate must pass `scripts/review-assessed-daily.ts` and `scripts/package-assessed-daily.ts` before version 12 can be wired into either daily date. The proof tool writes independently verified checkpoints every minute. Pass its `opening-safety.json` as the witness input when continuing a bounded search; no old classification or certificate fingerprint is trusted.

After packaging has created the actual `2026-09-25-v12.json` and `artifacts/meaning-v3` files, apply `publication-v12.patch` from the repository root. It wires the same encounter to **2026-09-25 and 2026-09-26**, independent of when generation finishes. It preserves archived encounters, updates the DEV review attachment, and adds complete publication and persistence coverage. The patch does not contain a placeholder puzzle or fabricated walkthrough.

```sh
git apply --check artifacts/semantic-assessment/compact-candidate/publication-v12.patch
git apply artifacts/semantic-assessment/compact-candidate/publication-v12.patch
```

Run the full tests and build after applying it. Persistence tests take their latest winning route and hit counts from the actual packaged walkthrough; old played/completed runs remain pinned until reset.
