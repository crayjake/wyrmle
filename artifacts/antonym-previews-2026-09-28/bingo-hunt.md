# Bingo hunt

Open `?preview=concepts&mode=hunt` or choose **Bingo hunt** on the preview page. The ALERT and TRUE examples reuse their plain preview's starting boards, so testers can compare the rules directly. Progress is separate for each version.

Five additional hunts use new boards: **WET, LOUD, DIM, THIN and BIG**. The hub has four pages, with two puzzles per page. Each new puzzle keeps its own progress and best stars. Direct links use `?preview=concepts&puzzle=hunt-wet` (substitute `loud`, `dim`, `thin` or `big`).

A single opposite adjective containing every enemy letter wins. Simpler antonyms spend one of three lives and remove spare physical tiles, without attacking the enemy or consuming the submitted word. The first helper removes half the spares (rounded up); the second removes the rest. On the final life, the remaining letters are exactly the authored bingo, including repeated letters. Any other valid bingo also wins immediately.

Non-antonyms, invalid words and exact repeat guesses are rejected without spending a life or revealing tiles. Wins on guesses one, two and three earn three, two and one stars. A restart remains available for this preview. The existing Daily and plain preview rules are separate.

On the final life, the remaining letters form a single anagram ring. This also applies when resuming an attempt. Restarting restores the player's chosen layout; the automatic switch never changes their saved preference.

One explanation appears before a fresh attempt. There are no instruction prompts between guesses. Help can reopen the explanation. The normal move preview indicates whether the selected word is an antonym and how many spare tiles it would remove. Matching letters on the **enemy word** turn red: a valid bingo lights up every enemy letter. These are matching previews only; helpers still do no enemy damage. Clearing the selection or selecting an invalid word clears the highlights. Playable spare tiles have no removal markers.

`npm run generate:concept-previews` reproduces all seven frozen hunt assets alongside the other concepts. Engine tests cover every legal two-helper sequence on these boards, preservation of all answer copies, exact final anagrams, 1/2/3-guess wins, rejection without penalties, stale asset validation and saved replay. The mobile browser checks cover the introduction, gameplay, results and progress.

Use `npm run generate:concept-previews -- --hunt-only` to rebuild only the hunts. Their reusable definitions are in `scripts/antonyms/huntProfiles.ts`. The generator searches every way to remove half the spare physical tiles, then chooses the plan with the strongest minimum number of different, reviewed helper families after **every** accepted opening. It rejects plans with no familiar follow-up. ALERT guarantees at least two of the reviewed helper families after any opening; TRUE guarantees at least one. After SLOW, ALERT retains IDLE, TIRED and INERT. After WRONG, TRUE retains UNREAL and INCORRECT. Frequency and length remain a rough familiarity measure.

The new boards start with a reviewed adjective bingo, add letters for familiar antonyms, then search removal orders. All playable dictionary words receive a frozen meaning classification. The author review checks the other playable adjective senses for omissions, including MINI's [general small-size meaning](https://en.wiktionary.org/w/index.php?oldid=92689945&title=mini), which the base dictionary lacks. The generator also enumerates starting bingos and rejects any whose frequency/length effort is below the planned helper route plus a small margin. This is a word-familiarity check, not a measured human difficulty score; the narrowing board supplies the extra help on later guesses.

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
