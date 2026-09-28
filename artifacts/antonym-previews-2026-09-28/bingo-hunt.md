# Bingo hunt

Open `?preview=concepts&mode=hunt` or choose **Bingo hunt** on the preview page. The ALERT and TRUE examples reuse their plain preview's starting boards, so testers can compare the rules directly. Progress is separate for each version.

A single opposite adjective containing every enemy letter wins. Simpler antonyms spend one of three lives and remove spare physical tiles, without attacking the enemy or consuming the submitted word. The first helper removes half the spares (rounded up); the second removes the rest. On the final life, the remaining letters are exactly the authored bingo, including repeated letters. Any other valid bingo also wins immediately.

Non-antonyms, invalid words and exact repeat guesses are rejected without spending a life or revealing tiles. Wins on guesses one, two and three earn three, two and one stars. A restart remains available for this preview. The existing Daily and plain preview rules are separate.

One explanation appears before a fresh attempt. There are no instruction prompts between guesses. Help can reopen the explanation. The normal move preview indicates whether the selected word is an antonym and how many spare tiles it would remove.

`npm run generate:concept-previews` reproduces both frozen assets. Engine tests cover every legal two-helper sequence on these boards, preservation of all answer copies, exact final anagrams, 1/2/3-guess wins, rejection without penalties, stale asset validation and saved replay. The mobile browser checks cover the introduction, gameplay, results and progress.

Author-only witnesses: ALERT → SLOW → INERT → LETHARGIC; TRUE → WRONG → UNREAL → INACCURATE. The first item is the enemy, not a played word.
