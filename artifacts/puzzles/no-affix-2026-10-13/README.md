# Affix-puzzle correction — 13 October 2026

The old queue included answers made by adding a negative prefix to the enemy. Those are valid antonyms but poor anagram puzzles. The new authoring gate rejects these boards, including shortcuts among alternative bingos. It also checks pinned lemmas, obvious negative-prefix roots, and reviewed MOBILE/MOVABLE and LEGAL/LEGITIMATE root variants. This is an editorial selection rule, not a change to which player guesses are antonyms.

- Retired 25 boards; their entries and reasons are in `retired.json`.
- Generated 16 fresh boards through the current bingo-first publisher, with 2,458 exhaustive helper continuations and 1/2/3-guess witnesses. Profiles and exact dates are in `plan.json`.
- Moved eight already-proved, unreleased boards forward to fill remaining gaps. Their immutable assets and original IDs stay unchanged; `audit.json` records each date move.
- The daily schedule remains continuous from 29 September through 5 December. The eight earlier archive dates are unchanged. Today is HIRE; yesterday is SURE.
- Old puzzle assets, reports and guides remain intact. Existing replacement-date saves are backed up by asset when new progress is saved; old stars do not transfer to a different board.

All new primary and alternative bingos were checked against 248 historical winning spellings. The new profiles underwent separate semantic review, including missing shorter counters and misleading inferred inflections. An uncommon FOREPART draft was dropped instead of padding the queue.

`plan.json` is a publication record, not an instruction to rerun this replacement on a later queue. For future authoring follow [the current guide](../../../docs/puzzle-authoring.md).

Verification: 51 focused generator, gameplay, schedule, calendar and progress tests; lint; production typecheck/build. The regression suite rejects an unarmoured FIT board where UNFIT would become an easy alternate bingo, while retaining UNFIT as a legitimate helper on the armoured board.

Browser checks passed at 390×844, 320×480 and 844×390 with both ring settings. Played HIRE, SURE and armoured EASE to completion; checked the final one-ring anagram, progressive Easy hints, in-viewport buttons and preservation of an old win and an unfinished old attempt. Details are in `browser-checks.json`.
