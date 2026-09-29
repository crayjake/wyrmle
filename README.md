# Wyrmle

A daily antonym and anagram puzzle. Find an opposite word containing every letter of the enemy, including any extra copies shown by armour outlines. Find it straight away for three stars, or spend a life on a simpler antonym to remove spare tiles. Two helpers leave just the answer's letters.

The board uses reusable circular tiles: matching letters in the inner ring, other letters outside. There are three lives, no refills and one saved attempt per puzzle. Older puzzles live in the calendar. Every on-time daily win counts toward a streak, regardless of stars; archive wins earn stars without repairing missed days.

| Difficulty | Definition, armour and preview | Non-antonym dictionary guesses | Hints |
| --- | --- | --- | --- |
| Easy | Shown | Rejected, free | Automatic after each helper |
| Normal | Shown | Rejected, free | None |
| Hard | Hidden | Cost a life, remove no tiles | None |

Nonwords and repeated guesses are always free. In Hard, wrong guesses can leave spare letters on the last life. The tutorial is separate practice and never consumes a daily attempt.

## Development

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

Node 24 is used in CI. Tests run in three shards, alongside the production build; deployment waits for both. See [test commands and timing](docs/testing.md).

## Generating puzzles

Read **[the current authoring guide](docs/puzzle-authoring.md)**. It explains the rules, reviewed same-type antonyms, optional armour, bingo-first letter construction, exhaustive removal planning and publication commands.

```sh
npm run generate:puzzle -- --profile YOUR_PROFILE --date YYYY-MM-DD --dry-run
npm run generate:puzzle -- --profile YOUR_PROFILE --date YYYY-MM-DD
```

Profiles live in `scripts/puzzles/profiles.ts`. The generator writes an immutable puzzle, proof, schedule entry and Easy-mode hints. It checks all helper continuations and 1/2/3-guess wins. Human semantic review and playtesting remain necessary; difficulty estimates do not guarantee a particular solving order. New answers avoid the “-less” family.

## Play and deploy

[Play Wyrmle](https://crayjake.github.io/wyrmle/) · [Calendar](https://crayjake.github.io/wyrmle/?calendar)

Push tested changes to `main` to deploy through GitHub Actions. The app is static: gameplay uses frozen dictionary meanings, with no runtime LLM or backend. Saves stay on each browser/device. Dates change at midnight UTC. Sharing uses the native share sheet when available; see [sharing and icons](docs/sharing-and-icons.md).

For a local Pages build:

```sh
VITE_BASE_PATH=/wyrmle/ npm run build
VITE_BASE_PATH=/wyrmle/ npm run preview -- --host 127.0.0.1
```

Open the printed local URL with `/wyrmle/`. Puzzle selection uses `?calendar` and `?daily=YYYY-MM-DD`; future dates are locked. Eligible old reusable-tile previews were backdated with their saves transferred. Retired preview URLs redirect to the matching date or calendar. Original saves and historical assets remain available for recovery, but obsolete modes are not playable from the app.

Earlier generator-v3, combat, conceptual-counter and refill documents under `docs/` and `artifacts/` are historical research, not the current publication workflow.
