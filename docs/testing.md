# Tests and CI

`npm test` runs every `tests/*.test.ts` file in one Node process. This shares the large immutable dictionaries and semantic model caches across files. Tests remain sequential inside that process. The generator construction and ranking checks have separate files so CI can schedule them independently; their seeds and assertions are preserved.

GitHub Actions runs the same discovered files in three jobs using [Node's built-in test sharding](https://nodejs.org/docs/latest-v24.x/api/test.html#runoptions). Each shard retains one shared process. New `*.test.ts` files enter the suite automatically. No test is skipped based on changed paths, and semantic audits and all physical daily-opening replays remain required.

```sh
# Full suite, matching the CI Node major version.
npm test

# Reproduce any one CI shard locally (replace 1 with 2 or 3).
npm run test:ci -- --test-shard=1/3 tests/*.test.ts

# Focused checks while editing.
node --test --test-isolation=none tests/sha256.test.ts tests/generator-ranking.test.ts

# Normal release checks.
npm run lint
npm run build
```

The Pages workflow runs lint and the production build alongside the test matrix. Its deployment job depends on **both** jobs, including every matrix shard. A failing or cancelled test cannot publish the built artifact. The existing branch restriction, pinned actions and minimal job permissions remain in place.

Profiling found significant time in synchronous SHA-256 and cloning compiled meanings during mutation. Node now uses its native SHA-256 implementation through [`process.getBuiltinModule`](https://nodejs.org/docs/latest-v24.x/api/process.html#processgetbuiltinmoduleid), with no Node import in browser bundles. Browser code retains the portable implementation. Both implementations are compared against standard vectors and Node crypto, including long messages, padding boundaries, Unicode and unpaired surrogates; another check evaluates the module without Node globals. Existing digest-bound semantic tests continue to verify unchanged fingerprints.

Mutations clone their mutable construction and rules, then compile their final meanings as before. They omit copying the old word table that recompilation immediately replaces. No classifications, semantic thresholds, search budgets or publication gates were changed for this performance work.

On Node 24.21.0, the complete local suite fell from **167.8 seconds to 103.6 seconds** (38% less time). All original 562 tests remain, plus the browser-environment hash check. Running the new CI commands concurrently completed 210, 188 and 165 tests in **69.5, 57.2 and 40.7 seconds**, respectively. Their combined test names match the full 563-test suite exactly, with zero failures or skips. The last measured GitHub run before these changes spent 235 seconds in tests and 25 seconds building.

Exact results are recorded in [the timing report](../artifacts/test-performance-2026-09-26/summary.json). The revised workflow has not run on GitHub yet. Local timings are not a promise of GitHub runner latency; job startup, runner availability and deployment time are additional.
