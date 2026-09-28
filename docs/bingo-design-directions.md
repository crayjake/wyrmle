# Bingo-first design directions

Recorded 28 September 2026. Design discussion only: no live rules, semantic data, boards or generator behaviour change with this note.

## Priorities agreed with the user

- Keep the enemy word and a meaningful connection between it and the words played.
- Preserve the main payoff: discovering one clever word that clears the entire enemy, including armour, in one move.
- Keep several useful shorter words and satisfying two- and three-word routes. A puzzle should support play before the bingo is found.
- Reduce uncertainty about whether the game will accept a semantic connection. The user enjoys surprising conceptual counters, but a friend found the current judgments hard to predict.
- Do not replace the game with a required word chain, checklist, or a single fixed-answer crossword clue.
- Continue aiming for accessible three-word wins, harder two-word wins, and the hardest one-word win. This remains a design and validation goal, not a guarantee about every player's experience.

## Direction the user asked to keep: a precise weakness

Attach a short, concrete weakness prompt to the enemy, while retaining the tile and damage puzzle. Shorter answers to the same prompt can make progress; a word meeting the prompt and covering all required enemy letters can be a bingo.

Illustrative pairings from the discussion:

| Enemy | Weakness prompt | Possible bingo word |
| --- | --- | --- |
| LOCK | Something that gets past it | LOCKPICK |
| DARK | Something that ends it | DAYBREAK |
| ARID | Supplied with what it lacks | IRRIGATED |

These words contain their respective enemy letters. LOCKPICK also repeats C and K; IRRIGATED repeats I and R. These examples do not certify a new board, armour arrangement, or multiple shorter routes. LOCK and DARK were hypothetical designs; IRRIGATED is already used in the ARID tutorial.

An unresolved issue is how tightly the prompt defines accepted answers. A broad prompt can reproduce the uncertainty of the current conceptual counters. Fair acceptance and useful alternative routes need explicit review.

## New proposal: show an opposite word and find its synonyms

Show a target word opposite to the enemy in a chosen sense. Counter words must share that target sense. For example, SAD could show HAPPY, with GLAD, CHEERFUL, JOYFUL and PLEASED as candidate counters in the emotional sense.

This preserves the bingo structure: semantic acceptance determines which words can counter, and the physical letters, enemy armour and current board determine which can clear the whole enemy. The example is a vocabulary illustration, not a generated puzzle or a promise that this particular family supports good one-, two- and three-word routes.

Potential benefits:

- Players have a visible, familiar criterion for finding counters.
- Multiple answers remain possible; the bingo is a word with unusually useful letters among those answers.
- A generator can begin with a small, reviewed family of words sharing one sense, then search for enemy coverage and shorter routes.

Tradeoffs and open questions:

- Showing the opposite supplies the conceptual connection. Discovery shifts toward recalling synonyms and finding the word that fits the letters. Playtesting should establish whether enough of the satisfying reveal remains.
- Synonyms still depend on sense, grammar and usage. HAPPY meaning cheerful must not silently expand into lucky, appropriate, or every synonym of every related word.
- Use a reviewed, sense-specific pool and account consistently for ordinary inflections. A thesaurus graph or automatic synonym expansion alone does not settle acceptance.
- A tighter pool will rule out some enemy/bingo combinations and may leave too few shorter routes. The size of that reduction has not been measured.
- Displaying a short context sentence could clarify an ambiguous target word without adding another puzzle to solve.
- Neutral damage, similar-word behaviour and any changes to them are undecided; this proposal does not remove them from the live game.

## Follow-up proposal: synonyms of the enemy deal damage

The user then suggested removing the opposite target entirely: play synonyms of the enemy itself. This supplies one visible semantic target while preserving the letter-coverage bingo. No separate clue is needed to explain which meaning to seek.

A [reproducible lexical census](../artifacts/synonym-bingos-2026-09-28/README.md) checked exact source synonym sets, using distinct source lemmas and excluding answers containing the whole enemy spelling. Among 30,514 eligible 3–8-letter enemy lemmas, 19,207 have an overlapping synonym; 1,395 have one covering the full enemy letter multiset. Requiring both words to meet the existing Zipf 3 familiarity threshold leaves 250 enemy spellings, or 23 when also requiring two armour points. Examples include SANE → REASONABLE and LIT → ILLUMINATED.

These are lexical candidates, not generated puzzles or an exhaustive count of English synonym relationships. Source groups are often too small to supply several good shorter routes; ordinary near-synonyms may require a broader, reviewed pool. Rare senses, spelling variants and related derivations also require editorial review. A prototype should explicitly exclude playing the enemy itself or merely inflecting it, since bingo boards necessarily contain its unarmoured letters.

The user wants enough fresh enemies for a year. A follow-up allowing inflections of other lemmas and less-common bingo answers found 453 candidate enemy spellings with familiar enemies and 7–15-letter answers; 264 can support at least one armour point and 75 at least two. The original 23 already included three- and four-armour candidates. These are still lexical candidates before editorial and route validation: a year with two armour points on every puzzle is not supported by the scans, and a year with variable armour remains unproven. The census report records the exact filters and a reproducible sensitivity comparison.

The user subsequently clarified that **armour is optional as long as the bingo synonym is not trivial**. Further design work should use that requirement rather than demand two armour points. Good illustrative pairs include REST → RESPITE, FICTION → FABRICATION, SURPLUS → SUPERFLUOUS, DEBATE → DELIBERATE, CURSE → SCOURGE and ETERNAL → INTERMINABLE. All cover the enemy letter multiset. They need their ordinary shared sense pinned (for example CURSE as a cause of misery, and ETERNAL as a tiresomely long wait); none is a generated or route-validated puzzle. SURPLUS also has the source-backed shorter synonyms EXTRA, SPARE, EXCESS and REDUNDANT, making it an interesting vocabulary pool to investigate.

This is now a candidate for the simplest prototype. Whether it retains enough surprise and enough useful two-/three-word routes has not been tested. The user has not requested a live rule change.

## New proposal: put the enemy in a sentence / use a cryptic clue

A sentence could pin down the intended sense and point to a family of counter words. Several answers to that shared definition could be valid, while the tiles determine the most effective one. This can preserve both the bingo and shorter routes.

A conventional cryptic clue usually pairs a definition with wordplay that constructs a particular answer. For example, the setter Encota explains how a definition and reversal both identify EDAM in his [introduction to cryptic clue structure](https://www.specialisedcrosswords.co.uk/wp-content/uploads/2017/04/TOPTIP4-Intro-to-Clue-Structure-1.pdf). A clue can admit ambiguity, but deliberately supporting a broad family of answers is a different design objective from that precise construction.

If the clue identifies only the bingo and other words have no useful role, the result risks becoming the single-answer crossword experience the user wants to avoid. Merely putting the enemy in a sentence does not guarantee useful alternative answers or fair gameplay.

Recommendation at that stage of the discussion: explore an explicit opposite target first, with a short sentence only when needed to establish its sense. The subsequent direct-synonym proposal above is simpler still and remains under consideration. Keep the concrete-weakness version as another candidate. Full cryptic wordplay is optional exploration, not an agreed replacement for the game.

## What a prototype must establish

1. Review the intended sense and accepted word family before building the board; record reasonable edge cases and inflections.
2. Find actual bingo candidates satisfying enemy-letter multiplicities, including armour.
3. Generate boards and refills with several familiar starting counters and verified distinct two- and three-word solutions under the real engine.
4. Check that shorter routes remain discoverable and that the bingo has a satisfying extra challenge. Word familiarity alone cannot prove this.
5. Test whether players can predict semantic acceptance and explain the bingo connection after a reveal.

The direct-synonym proposal now has [four playable research previews](../artifacts/synonym-previews-2026-09-28/README.md), a shareable selection page at `?preview=concepts`, isolated saved progress, and a reproducible builder (`npm run generate:concept-previews`). FICTION and ETERNAL use plain synonym damage; CALM and GLOOM use POWER tiles to supply missing enemy letters. All four have real-engine one-/two-/three-word route proofs. The two POWER boards have no unpowered starting bingo.

The user clarified that special powers should expand the enemy/answer pairs that can make a puzzle. An extra-life tile would not solve missing bingo letters; the POWER rule does. These four authored examples are not an arbitrary-enemy generator, a certified difficulty progression, or evidence that a full year is ready. Daily retains its existing counter rules.
