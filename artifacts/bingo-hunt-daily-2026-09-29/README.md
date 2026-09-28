# Bingo Hunt becomes Daily

The change starts on **29 September 2026**. Today (28 September) and all earlier calendar puzzles retain their original assets, rules and saved progress. Daily now selects the exact date; it never presents the last queued puzzle as a new day when the queue ends.

Six hunts are queued through **4 October**: OLD, WET, LOUD, DIM, THIN and BIG. OLD is a new board and answer, separate from the previews. The following five use the newly reviewed preview boards. Their answers and letter pools do not repeat any previously published daily. THIN has appeared as an enemy before, with a different answer and board.

`previous-schedule.json` preserves the previous combat queue for reproduction and historical regression checks. Its future entries are no longer scheduled. Published assets and freshness history remain in place. This is a six-day hunt queue, not a conversion of the entire retired queue.

Daily rules match the hunt previews: three guesses, accepted antonyms only, no refills, no tile consumption, and spare tiles removed after helpers. The last guess presents the exact bingo anagram in one ring. An invalid or repeated word costs nothing. The result is saved after each accepted guess, with three/two/one stars for one/two/three guesses. **Daily cannot restart; previews can.** Easy mode retains its optional hints.

All existing players move once to two rings and circular tiles. After that migration, another layout chosen in Settings persists. Matching playable letters stay in the inner ring; the final-life anagram uses one ring automatically.

## Reproduce and verify

```sh
npm run publish:hunt-dailies
node --test --test-isolation=none tests/daily-schedule.test.ts tests/challenge-progress.test.ts tests/preferences.test.ts
```

The publisher uses the same bingo-first profiles and removal planner as the previews. For each board it checks every accepted helper opening and every second-helper continuation, protects a different familiar helper family, replays one/two/three-guess wins, compares bingo effort with the intended helpers, checks published bingo-family/board freshness, and emits immutable assets, reports and hints.

These are mechanical and dictionary-based checks, not a guarantee of human difficulty. The reports contain spoilers and the full accepted helper branches. Tomorrow's OLD is pinned to personal age: adjective counters include YOUNG, TEEN, TEENAGE, TENDER, EARLY and UNDERAGE. Nouns TEENAGER and TEENER are explicitly rejected as adjective comparisons; suffix stripping must not manufacture them.
