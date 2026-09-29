# Authoring current Wyrmle puzzles

This is the current workflow. Older combat, refill, conceptual-counter and preview generators are historical experiments. Do not use them to replace the live queue.

## Rules to design for

A puzzle has 16 ordinary tiles and three lives. Tiles are reusable; they never refill. The answer is a reviewed antonym with the **same part of speech and the opposite of the displayed sense**. A bingo contains every enemy letter, with all required copies, in one word. Armour is optional: `armour: {2: 3}` means enemy slot 2 needs three copies. Repeated enemy slots each have their own requirement. Do not accumulate hits across guesses.

An accepted non-winning antonym spends one life and removes half the spare tiles, rounded up. The second accepted helper removes the rest. Protected answer copies never disappear. Repeated guesses and nonwords are rejected. Easy/Normal reject non-antonyms for free. Hard spends a life on a dictionary non-antonym but removes nothing; therefore Hard can reach its last life with spare tiles still present.

There is one saved attempt per date. Stars are 3/2/1 for winning in 1/2/3 guesses. Easy shows no hint at the start. Its first non-winning antonym reveals a clue beneath the enemy; the second reveals a clearer clue. Wrong guesses and duplicate words do not unlock clues. The answer can be revealed after a lost attempt. A win completed on its own UTC date counts toward the daily streak; archive wins earn stars only.

## Bingo-first construction

1. Add a reviewed profile to `scripts/puzzles/profiles.ts`. Start with an enemy sense and a natural antonym containing its letters; reserve the bingo's exact multiset first. Avoid obscure dictionary curiosities and **-less / -lessness answers**, including alternative bingos. Armour may require any feasible number of copies; it is not limited to two.
2. Pin the enemy's OEWN sense and the accepted opposite senses in `roots`. The builder expands only these reviewed synsets and their dictionary forms, not arbitrary semantic neighbours. `wordOnly` restricts a root to its exact sense when synset expansion would be too broad. Use `overrides` for misleading derived forms and `supplemental` only with an independently checked, pinned dictionary citation.
3. Fill the remaining positions to 16 using familiar helper words. Set `refills: ''`, `powers: []`, `routes: []`; do not set a conceptual `family` or a different `counterPartOfSpeech`. Add `helpers: ['FIRST', 'SECOND']`, `preferredHelpers`, progressive hints and a written semantic review. The existing profile format keeps three hints for historical compatibility; current Easy play uses the first two, one per helper. Make the first a useful nudge and the second more specific, without revealing the answer. There is no manual hint menu.
4. The removal planner tries every possible first-half spare removal set. **Every accepted opening** must leave a different familiar helper family. This includes rare openings, comparatives and any word originally intended as the second guess. It then replays every legal two-helper branch and the final bingo through the game engine.
5. Review *all* printed counters and alternate bingos, not only the intended answer. A noun cannot pass as an adjective through suffix stripping (LITER is not a comparative of LIT). Inspect likely missing antonyms too. Freeze the reviewed meanings in the published asset; runtime does not ask an LLM.

## Commands

```sh
# Review a candidate without changing files. Choose an unused date.
npm run generate:puzzle -- --profile gentle-armoured --date 2026-10-05 --dry-run

# Publish after reviewing the profile and dry-run output.
npm run generate:puzzle -- --profile YOUR_NEW_PROFILE --date 2026-10-05

# For an explicitly requested archive example, use an unused past date.
npm run generate:puzzle -- --profile YOUR_NEW_PROFILE --date 2026-09-20 --archive
```

The example profile is already published, so its dry-run demonstrates proof generation; publication rejects a duplicate enemy/answer. `--replace` explicitly permits replacing an occupied date in the selected manifest. Only use it when that replacement is requested: a changed asset gets separate progress, and the old save is backed up. Never edit an immutable puzzle file in place.

The command writes a content-addressed `public/puzzles/*.json`, a proof under `artifacts/puzzles/DATE/`, the schedule or archive entry, and its Easy-mode guide. It validates the frozen file through the same decoder the app uses. The proof includes all starting bingos, word-effort scores, 1/2/3-guess witnesses, every helper continuation, and the chosen physical removal order. Generation is deterministic for a profile ID.

The scheduled date opens at `?daily=YYYY-MM-DD` once released; future dates remain unavailable. For pre-release browser checks, set the browser's clock to the intended date. `?calendar` lists released puzzles. New profiles do not need a preview route.

## What validation proves

The validator proves the required copies, dictionary/POS checks, legal moves, protected answer, exhaustive helper continuations, and witnessed one-, two- and three-guess wins. It rejects a starting bingo whose frequency/length effort estimate is less than 0.4 above the harder planned helper. Familiar helpers must score at most 4.8. Additional successful guesses reduce the letter-search space, so later bingo attempts have fewer distractors.

It **does not prove human difficulty or perfect semantics**. Frequency and length are useful filters, not a measure of how quickly someone spots an anagram. More letters can sometimes make an answer easier to see. Dictionary antonym graphs can also connect the wrong senses. Read the definitions, review the full accepted set, and play all three routes before publishing. Never weaken the helper or type checks just to make a candidate pass.

## Verification before pushing

```sh
node --test --test-isolation=none tests/bingo-hunt.test.ts tests/daily-schedule.test.ts tests/puzzle-calendar.test.ts tests/current-authoring.test.ts
npm run lint
VITE_BASE_PATH=/wyrmle/ npm run build
```

Test the real board at a small phone size. Check two rings, armour outlines, enemy previews, helper removal, the final single-ring anagram, Hard wrong guesses and saved completion. Run the full suite for engine, storage or migration changes. Do not change `notes.md`.

`archive-concept-puzzles.ts` is the one-off September 29 transition, not a new puzzle generator. It copies the eligible earlier reusable-tile previews without changing physical IDs, and records their legacy storage keys. -less previews and old combat puzzles are excluded; source saves remain intact. Historical source files and tests are kept for auditing, but the app has no concept picker, replay controls or layout selector.
