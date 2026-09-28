# Bingo hunt

Open `?preview=concepts&mode=hunt` or choose **Bingo hunt** on the preview page. The ALERT and TRUE examples reuse their plain preview's starting boards, so testers can compare the rules directly. Progress is separate for each version.

A single opposite adjective containing every enemy letter wins. Simpler antonyms spend one of three lives and remove spare physical tiles, without attacking the enemy or consuming the submitted word. The first helper removes half the spares (rounded up); the second removes the rest. On the final life, the remaining letters are exactly the authored bingo, including repeated letters. Any other valid bingo also wins immediately.

Non-antonyms, invalid words and exact repeat guesses are rejected without spending a life or revealing tiles. Wins on guesses one, two and three earn three, two and one stars. A restart remains available for this preview. The existing Daily and plain preview rules are separate.

On the final life, the remaining letters form a single anagram ring. This also applies when resuming an attempt. Restarting restores the player's chosen layout; the automatic switch never changes their saved preference.

One explanation appears before a fresh attempt. There are no instruction prompts between guesses. Help can reopen the explanation. The normal move preview indicates whether the selected word is an antonym and how many spare tiles it would remove. Matching letters on the **enemy word** turn red: a valid bingo lights up every enemy letter. These are matching previews only; helpers still do no enemy damage. Clearing the selection or selecting an invalid word clears the highlights. Playable spare tiles have no removal markers.

`npm run generate:concept-previews` reproduces both frozen assets. Engine tests cover every legal two-helper sequence on these boards, preservation of all answer copies, exact final anagrams, 1/2/3-guess wins, rejection without penalties, stale asset validation and saved replay. The mobile browser checks cover the introduction, gameplay, results and progress.

Use `npm run generate:concept-previews -- --hunt-only` to rebuild only the two hunts. The generator searches every way to remove half the spare physical tiles, then chooses the plan with the strongest minimum number of different, reviewed helper families after **every** accepted opening. It rejects plans with no familiar follow-up. ALERT guarantees at least two of the reviewed helper families after any opening; TRUE guarantees at least one. After SLOW, ALERT retains IDLE, TIRED and INERT. After WRONG, TRUE retains UNREAL and INCORRECT. Frequency and length remain a rough familiarity measure.

`hunt-proofs.json` records the chosen orders, follow-ups and legacy replay checks. `hunt-removal-audit.json` records the original weakness before this update. The answers and starting boards stay the same. These removal-only revisions retain their original progress keys after the generator verifies every legacy move sequence, including alternate physical copies of repeated letters.

Author-only witnesses: ALERT → SLOW → INERT → LETHARGIC; TRUE → WRONG → UNREAL → INACCURATE. The first item is the enemy, not a played word.
