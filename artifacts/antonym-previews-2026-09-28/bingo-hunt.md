# Bingo hunt

Open `?preview=concepts&mode=hunt` or choose **Bingo hunt** on the preview page. The ALERT and TRUE examples reuse their plain preview's starting boards, so testers can compare the rules directly. Progress is separate for each version.

Five additional hunts use new boards: **WET, LOUD, DIM, THIN and BIG**. The original seven hunts remain available, alongside three armoured comparisons and a new **FEAR** board requiring three E copies. The hub has six pages, with up to two puzzles per page. Each new puzzle keeps its own progress and best stars. Direct links use `?preview=concepts&puzzle=hunt-wet` (substitute `loud`, `dim`, `thin` or `big`). FEAR is at `?preview=concepts&puzzle=hunt-fear-armoured`.

A single opposite of the same word type containing every required enemy letter wins. Simpler antonyms spend one of three lives and remove spare physical tiles, without attacking the enemy or consuming the submitted word. The first helper removes half the spares (rounded up); the second removes the rest. After two helpers, the remaining letters are exactly the authored bingo, including repeated letters. Any other valid bingo also wins immediately.

In Normal and Easy, non-antonyms, invalid words and exact repeat guesses are rejected without spending a life or revealing tiles. Hard accepts any new dictionary word: each costs a life, but only antonyms remove spare tiles. Wrong guesses remove nothing and do not advance the removal schedule. Only a same-word-type antonym meeting every letter requirement can win. Non-words and repeats are still rejected for free. Wins on guesses one, two and three earn three, two and one stars. A restart remains available for this preview. Daily uses Bingo Hunt from 29 September; it has one saved attempt. These previews keep their restart button.

Once only the bingo letters remain on the final life, they form a single anagram ring. A Hard miss can leave spare tiles on the final life; the board then keeps the player's chosen layout. This also applies when resuming an attempt. Restarting restores the player's chosen layout; the automatic switch never changes their saved preference.

One explanation appears before a fresh attempt. There are no instruction prompts between guesses. Help can reopen the explanation. The normal move preview indicates whether the selected word is an antonym and how many spare tiles it would remove. Matching letters on the **enemy word** turn red: a valid bingo lights up every enemy letter. These are matching previews only; helpers still do no enemy damage. Clearing the selection or selecting an invalid word clears the highlights. Playable spare tiles have no removal markers.

`npm run generate:concept-previews` reproduces all eleven frozen hunt assets alongside the other concepts. Engine tests cover every legal two-helper sequence on these boards, preservation of all answer copies, exact final anagrams, 1/2/3-guess wins, rejection without penalties, stale asset validation and saved replay. The mobile browser checks cover the introduction, gameplay, results and progress.

Use `npm run generate:concept-previews -- --hunt-only` to rebuild only the hunts. Their reusable definitions are in `scripts/antonyms/huntProfiles.ts`. The generator searches every way to remove half the spare physical tiles, then chooses the plan with the strongest minimum number of different, reviewed helper families after **every** accepted opening. It rejects plans with no familiar follow-up. ALERT guarantees at least two of the reviewed helper families after any opening; TRUE guarantees at least one. After SLOW, ALERT retains IDLE, TIRED and INERT. After WRONG, TRUE retains UNREAL and INCORRECT. Frequency and length remain a rough familiarity measure.

The new boards start with a reviewed bingo of the enemy's word type, add letters for familiar antonyms, then search removal orders. All playable dictionary words receive a frozen meaning classification. The author review checks the other playable senses for omissions, including MINI's [general small-size meaning](https://en.wiktionary.org/w/index.php?oldid=92689945&title=mini), which the base dictionary lacks. The generator also enumerates starting bingos and rejects any whose frequency/length effort is below the planned helper route plus a small margin. This is a word-familiarity check, not a measured human difficulty score; the narrowing board supplies the extra help on later guesses.

`hunt-proofs.json` records the chosen orders, follow-ups and legacy replay checks. `hunt-removal-audit.json` records the original weakness before this update. The answers and starting boards stay the same. These removal-only revisions retain their original progress keys after the generator verifies every legacy move sequence, including alternate physical copies of repeated letters.

Author-only witnesses: ALERT → SLOW → INERT → LETHARGIC; TRUE → WRONG → UNREAL → INACCURATE. The first item is the enemy, not a played word.

Additional author-only witnesses:

| Enemy | First helper | Second helper | Bingo |
| --- | --- | --- | --- |
| WET | DRY | ARID | WATERLESS |
| LOUD | QUIET | SILENT | SOUNDLESS |
| DIM | BRIGHT | LIT | ILLUMINATED |
| THIN | THICK | DENSE | THICKENED |
| BIG | LITTLE | TINY | NEGLIGIBLE |


## Optional armour comparisons

Armour is allowed, not required, and can require **three or more physical copies of a letter in the same bingo**. In Normal and Easy, the number of outlines shows the requirement: two outlines need two copies, three need three. There is no numeric badge. A partial match previews blue; meeting the full count turns it red. Helpers do not wear down armour. An enemy word containing the same letter in multiple slots needs a separate copy for each slot, plus its extra armour copies. The engine tests a noun antonym with both three- and four-copy armour, including exact tile accounting across repeated enemy slots.

Hard hides armour outlines, copy counts, enemy definitions and all semantic/matching previews. Any dictionary word can be submitted, including non-antonyms. Its meaning is reported in played-word history after submission. Wrong guesses leave every tile in place, so the final life can still have spare tiles. Each move stores the difficulty rule it used; reloading or switching modes cannot refund lives or change previous removals.

Three comparisons keep the existing answer and letter pool, but add armour and independently regenerate and certify their removal plans. Their preview IDs and saved progress are separate; adding armour does not replace the original puzzles.

| Preview link | Armoured slots | Tested two-helper paths | Minimum familiar follow-up families |
| --- | --- | ---: | ---: |
| `?preview=concepts&puzzle=hunt-wet-armoured` | E ×2 | 153 | 1 |
| `?preview=concepts&puzzle=hunt-dim-armoured` | I ×2 | 44 | 2 |
| `?preview=concepts&puzzle=hunt-big-armoured` | I ×2, G ×2 | 60 | 3 |
| `?preview=concepts&puzzle=hunt-fear-armoured` | E ×3 | 40 | 2 |

FEAR is a new noun board, with EASE, CALM, NERVE and RELIEF as familiar noun antonyms. All nine accepted non-bingo openings retain at least two different familiar helper families. The generator tests all 40 two-helper paths. Author-only witness: EASE → NERVE → FEARLESSNESS. All three E copies must be in the same winning word. The builder now preserves explicitly reviewed opposites that share an enemy prefix, instead of mistakenly excluding FEARLESSNESS alongside FEAR and FEARS. All earlier puzzle assets remain unchanged by this addition.

Set the optional `armour` map from zero-based enemy positions to total copy counts, for example `armour: {1: 2, 2: 2}` for BIG, or `{6: 3}` to require three copies in slot 6. Omit it (or use `{}`) for no armour. Run `npm run generate:concept-previews -- --hunt-only` to reproduce the comparisons. The builder rejects invalid positions and counts; Hunt validation rejects armour unless the bingo has every required physical copy. The daily publisher uses the same builder and validator, so future daily profiles can opt in too.

These comparisons do not introduce new answers: their unarmoured versions already have the same starting bingo. They test matching, readability and whether the extra repeated-letter information helps players. Armour is a puzzle-design option, not an automatic improvement in difficulty. Every accepted opening and second-helper continuation is replayed, alongside direct bingos, final-anagram wins and save/resume checks.

The word-type audit also corrected **LITER**: the source had inferred an adjective comparative from LIT, despite LITER being a unit-of-volume noun. Plain DIM, armoured DIM and the queued 2 October DIM now reject it in Normal/Easy; in Hard it is a wrong guess and costs a life. This semantic correction gives plain DIM a new immutable preview revision; previous progress data remains stored under the earlier revision. All other existing preview revisions, today's OLD, and the rest of the daily queue are unchanged. The three armoured boards now have **257** tested two-helper paths in total.
