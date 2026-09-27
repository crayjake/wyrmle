# Bingo-first batch, stopped at the requested checkpoint

Generation stopped after 414 candidates had been tested. Of the mechanically
accepted candidates, 41 enemy/answer pairs were shortlisted for a closer meaning
review. After correcting meanings and replaying their existing boards, 39 still
passed. A duplicate starting pool removed one more: **38 published puzzles**.

**33 new dailies run from 26 October to 27 November 2026.** All previously queued
and archived dates keep their assets and progress. The batch has 38 different
enemies and enemy lemmas, distinct starting letter pools, and no shared available
bingo family with another batch puzzle or anything in the publication history.
That checks every possible starting bingo, not only the advertised answer.

Five were sampled using a recorded random seed and **moved** into earlier calendar
dates. They will not appear again in the future queue:

| Date | Enemy |
| --- | --- |
| 11 September | STOP |
| 12 September | SOIL |
| 13 September | DAYS |
| 14 September | HIDE |
| 15 September | DIM |

## Quality checks

These use the requested bingo-first method: choose a source-backed counter that
covers the enemy and its armour, build the starting letters around it, then search
for counter/similar/neutral choices across later turns. No further board searches
ran after the stop request; semantic corrections were applied to existing boards
and those boards were revalidated.

Every publication has a real-engine bingo, a separate two-word win, and several
three-word counter routes with no repeated word families in their witnesses.
Across the selected puzzles there are 4–12 starting counter families, 5–18 proven
counter routes, and at least two qualifying second- and third-turn positions.
Enemy health exceeds three, so three neutral hits cannot win. These are bounded
route checks, not a promise that every possible opening stays solvable.

Meaning review removed weak concept pairs and corrected source homographs such as
LAIN/LAY being incorrectly attached to lying, BARED to barring, and DINING to noise.
LAMP, FLASH, DAWN, HIDDEN and food senses of DINING/SNACK were added explicitly.
Generic FITS/TAKE no longer inherit hunger/permission counters. Roots retain exact
source sense IDs and definitions; derivations are individually pinned. Meanings
outside these reviewed concept pools remain defined neutrals. This is a source
profile, not an exhaustive guarantee about every contextual reading of English.

Frozen payloads, proofs, guides and the publication ledger are committed. The new
lossless dictionary transport stores neutral definitions by reference to the app's
versioned dictionary and retains all puzzle-specific labels. The 38 files total
13.97 MB (3.34 MB gzipped); playing fetches only the selected date's puzzle.

## Run another batch

Node 24+; no service credentials are required. The tools default to the day after
the current queue. An explicit directory makes a long search easy to resume:

```sh
npm run discover:batch -- --directory artifacts/daily-year-2026-11-28
npm run generate:batch -- --directory artifacts/daily-year-2026-11-28 --seeds 2 --resume
```

`--limit N` limits new candidate attempts; `--themes light,speed` narrows the pools.
Independent processes can use `--shard 0/4` through `--shard 3/4`. Do not run two
workers for the same shard or edit pools while a search is running.

Review candidate reports and their word meanings, then create
`editorial-shortlist.json` in that directory: an array of reviewed report IDs.
The tools deliberately do not treat a good mechanical score as a semantic review.
Recheck after any source-pool corrections, then publish the reviewed selection:

```sh
npm run recheck:batch -- --directory artifacts/daily-year-2026-11-28
npm run generate:batch -- --directory artifacts/daily-year-2026-11-28 --start 2026-11-28 --publish-only --days 40
```

`--days` is a maximum batch size, including the five archive samples. Publishing
requires more than five fresh candidates and appends immediately after the queue.
It rechecks every payload and witness before writing public catalogs, preserves
old dates, and records the random sample seed. Local rejected reports and duplicate
payloads are ignored by Git; selected proofs and public assets are retained.

## Method comparison

The older search started from boards and scored what they happened to offer.
Bingo-first starts from an opposing concept and a letter-covering answer, then
constructs and checks the rest of the puzzle. It reliably provides a one-word goal
and makes three-life puzzles practical. Its weak point is that a good anchor alone
does not ensure fair meanings or interesting later moves: those need separate
review and route checks. For this game, bingo-first plus those checks is the better
fit. Both the search and publication workflow are reusable commands, not a one-off
manual layout.

Validation: all 621 tests passed (170 seconds locally), plus lint and a production
build. Browser checks opened all 38 new dates, verified one puzzle download per
visit and no phone-page overflow, and played each bingo. The September calendar
check played STOP through three-, two- and one-life wins, then reloaded the calendar
to verify its saved three stars. Animation checks cover ordinary and reduced motion
at phone and landscape sizes. A physical iPhone was not available for testing.
