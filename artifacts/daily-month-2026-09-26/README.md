# Daily queue: 26 September–25 October 2026

Thirty different enemy words, thirty distinct planned bingo answers. The active schedule is `src/daily/schedule.json`; each date fetches only its own content-addressed JSON under `public/puzzles/`.

All boards use the bingo-first constructor from `scripts/bingo/generate.ts`: choose an opposite word that covers the enemy, derive armour from repeated matching letters, preserve the bingo while filling spare board slots with counter/resisted families, then plan refills and score later positions. The monthly authoring command starts with three-turn refill plans and also tries two-turn plans when the best board lacks a separate two-word win. It does not use the retired daily generator or copy beta boards.

Run it yourself:

```sh
npm run generate:daily -- --start 2026-09-26 --days 30 --seeds 6 --publish
```

Generation alone writes reports without changing the site. `--publish` writes the scheduled assets and manifest only after validation. `--resume` reuses local authoring payloads after checking their source-profile fingerprint, content hash, and replay proofs. Those regenerable `*.puzzle.json` authoring payloads are ignored by Git; published files are committed. `--enemies ROT,STINGY` limits an investigation without publishing an incomplete month. Candidate enemies and bingo words are defined in `scripts/bingo/dailyProfiles.ts`.

The published selection uses one puzzle per enemy and spaces semantic themes through the month. ERROR/CORROBORATE was excluded on editorial grounds even though it passed mechanical checks: corroborating a statement need not correct an error.

Every published puzzle has:

- A real one-word win at one life, plus replay checks at two through five lives.
- A separate two-word win with different lemmas, excluding starting bingo lemmas.
- At least four starting counter families and four winning routes using multiple different counter families.
- At least two starting resisted families, two later positions with mixed counter/resisted choices, and two final positions retaining that mix.
- More than three enemy hits, so three neutral single hits cannot win.
- Sixteen ordinary tiles, finite refills, and no special tiles or word-length/grammar bonuses.

The per-puzzle reports contain the selected seed, exact physical tile selections for winning routes, source-pinned semantic roots, and the two-word witness. `tests/daily-schedule.test.ts` reads the exact published files and replays the proofs through the game engine.

Semantics are source-pinned game judgements, expanded over dictionary senses, inflections and bounded derivations. Defined words outside those concept families are neutral. The validator checks data completeness and that the game applies those meanings consistently; it does **not** prove that every contextual semantic judgement is correct. The reports retain that limitation rather than claiming model certification.

Daily attempts start with three lives. A three-word win unlocks two lives; a two-word win unlocks the one-life bingo challenge. A bingo reached earlier goes straight to the one-life replay. Losses never reduce lives. Best stars survive unlimited retries, and statistics count each date only once.

The beta interface is retired. Ten former/new preview puzzles are backdated to 16–25 September in `src/daily/archive.json`. The calendar selects dates and shows their best stars; the default screen remains today's game. Original beta saves remain intact and are copied once into the corresponding daily records. Easy mode shows the definition and enables three hints plus a reveal; Normal shows the definition without hints; Hard hides both. Guides are in `src/daily/guides.json` and the retained authoring guides.
