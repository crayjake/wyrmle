# Five more bingo-first puzzles, now in the calendar

IRE, SCARE, MESS, SPITE and TAINT were generated with the user's bingo-first method, using fresh seeds 24–29 and five different semantic themes. Their boards were not copied from the monthly queue. They now occupy 21–25 September 2026; the five maintained former beta puzzles occupy 16–20 September. Daily remains the default screen. Open `?calendar` to select another date.

Reproduce these assets:

```sh
npm run generate:bingo -- --set more --seeds 6 --export
npm run archive:bingo
```

The archive command preserves existing date assignments. New additions are placed before the earliest published date. The retained `previews/bingo` asset paths and beta manifest support historical save migration; there is no public beta screen. Old preview URLs redirect to archived dates, and the old beta library URL opens the calendar.

Each report records its source profile, board, finite refills, seed, ordinary two-word win and multiple winning routes using different counter families. Validation replays the transported data in the real game engine, including a one-life bingo. All tiles are ordinary. Source-pinned semantics are checked for consistency, not claimed to be an exhaustive proof of every contextual meaning.

Progress migration copies best word counts, physical move selections, unfinished attempts and hint steps. It never deletes the source save or overwrites an existing daily record. Existing four/five-life attempts can finish with their original lives; subsequent attempts follow the normal three/two/one-life progression. Historical results retain their actual word counts.

Every scheduled and archived puzzle has three progressive hints and a valid reveal in Easy mode. Normal and Hard do not offer hints. The calendar shows one, two or three stars for the best result on each date; retries never inflate the totals.
