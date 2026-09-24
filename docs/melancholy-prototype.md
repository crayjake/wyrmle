# MELANCHOLY prototype

This is a hand-authored encounter. The board, semantic profile, grammar annotations and refill queue are deterministic; the full bundled dictionary still decides whether a word is valid. The examples below were replayed against the current engine, including its curated adjective annotations.

## Starting board

```text
J  O  Y  T
C  H  E  R
G  L  O  M
S  A  D  E
```

The L at row 3, column 2 is **STRIKE** (tile ID 9). The E at row 4, column 4 is **WARD** (tile ID 15). The other E is ordinary. Tiles can be selected from anywhere on the board.

Resolve starts at 5. Each valid word normally spends 1 Resolve; a word using the Ward E spends none. MELANCHOLY's M and Y each need two hits. Its other letters need one; the two L positions remain separate targets.

## Rules and starting outcomes

Neutral words of 3–5 letters allow one normal matching strike. A neutral word of 6 or more letters gains **LONG +1**, allowing two. An unambiguous adjective gains MELANCHOLY's **ADJECTIVE +1** allowance as well, so a long neutral adjective allows up to three normal matching strikes.

STRIKE is independent: its tile can hit its matching living letter without spending the normal allowance. Each selected tile still hits at most once. Hits follow selected-word order and require living matches. A counter permits every eligible selected tile to hit; LONG adds nothing to a counter. LONG also adds nothing to a resisted word, though grammar and STRIKE can still help it.

These examples use the Ward E where a single E is needed. THREAD or CLOSET can instead use the ordinary E to keep Ward for a later turn, paying 1 Resolve now. CHEER needs both starting E tiles and therefore uses Ward.

| Word | Semantic result | Letters hit, in order | Strikes | Resolve spent | Active additions |
|---|---|---|---:|---:|---|
| JOY | Counter | O, Y | 2 | 1 | — |
| CHEER | Counter | C, H, E | 3 | 0 | Ward |
| GLAD | Counter | L, A | 2 | 1 | Strike |
| GAY | Counter | A, Y | 2 | 1 | — |
| SAD | Resisted | A | 1 | 1 | Adjective +1 |
| GLOOM | Resisted | L | 1 | 1 | Strike |
| GLOOMY | Resisted | L, O | 2 | 1 | Adjective +1, Strike |
| CLOSET | Neutral | C, L, O | 3 | 0 | Long +1, Strike, Ward |
| THREAD | Neutral | H, E | 2 | 0 | Long +1, Ward |

CLOSET gets **three**, because its Strike L does not consume either of its two normal allowances. GLOOMY receives no LONG bonus: its two hits come from the adjective weakness and Strike. GAY is explicitly a counter in its “happy” sense.

Grammar remains a curated prototype feature. SANDY is explicitly an adjective, correcting its previously missing annotation. The encounter also annotates useful later words such as COMELY, HOMELY, STEADY, STORMY, DREAMY, HEARTY and LOAMY. Unknown or ambiguous parts of speech receive no grammar bonus; this is not a claim that the dictionary provides complete grammatical classification. These annotations are scoped to the new encounter so archived puzzles retain their rules.

## Refill sequence

The 105-letter queue is authored in these blocks. Spaces mark design blocks only; they are not part of the queue.

```text
RYE RELAT MENDN JOYSAD PPY MERRY DELIGHT LEMONS CLOSET THREAD
HAPPY NEAR ELATED SAD GLOOM MERRY LEMONS THREAD CLOSET NEAR JOY
```

The exact stored string is:

```text
RYERELATMENDNJOYSADPPYMERRYDELIGHTLEMONSCLOSETTHREADHAPPYNEARELATEDSADGLOOMMERRYLEMONSTHREADCLOSETNEARJOY
```

Consumed board positions receive these letters in board order, regardless of the order in which the word was selected. Unselected tiles keep their positions and special identities. Refills are ordinary tiles.

Early R/E/Y keep MERRY and CHEER available after several different openings. The following L/A/T and M/E/N/D/N support ELATED and long neutrals while supplying N, which is absent from the starting board but present in the enemy. JOYSAD reintroduces counter and resisted vocabulary. The later PPY block makes HAPPY possible without crowding the opening board with P tiles. The tail alternates counter vocabulary with letters useful for long neutrals and resisted bait.

The queue does not guarantee every category on every later board. Consuming a shared letter or removing its last enemy target changes the value of available words. Several tested examples retain distinct choices beyond the first move:

| Position | Available choices |
|---|---|
| After JOY, turn 2 | CHEER or MERRY can use Ward; CLOSET is a long neutral using Strike; SAD remains resisted with its adjective allowance. |
| After JOY → CHEER, turn 3 | GLAD gives 2 strikes; MELODY gives 3 with LONG and Strike; SAD gives 1. |
| After SAD → CHEER → MERRY, turn 4 | LONELY can give 4 through LONG, adjective and Strike; JOY and ELATED remain counters; GLOOM remains resisted bait. |
| After CLOSET → MERRY → GLAD → MEANED, turn 5 | The introduced P pair enables HAPPY to remove the remaining H and Y. HONEYS is also a useful long-neutral option. |

Ward timing is a separate choice: ordinary-E THREAD preserves Ward for COMELY on the next turn; Ward-E THREAD saves Resolve immediately and leaves an ordinary E for COMELY. Both lines are tested.

## Replayed winning examples

These are verified routes, not optimality claims. Exact physical tile IDs are fixed in `tests/prototype-routes.test.ts`; duplicate-letter choices can affect both special use and subsequent refills.

| Opening | Continuation | Resolve remaining |
|---|---|---:|
| JOY | COMELY → GLAD → MEANED → HONEYS | 1 |
| CHEER | STORMY → LONELY → MONADS | 2 |
| GLAD | STORMY → HEARTY → COMELY → SANDY | 1 |
| GAY | COMELY → MOLESTED → HEARTY → SANDY | 1 |
| SAD | COMELY → MERRY → LOANED → HONEYS | 1 |
| GLOOM | CHEER → DREAMY → JOY → LEADEN → MERRY | 0 |
| CLOSET | MERRY → HOMELY → GAY → NOD | 1 |
| THREAD | COMELY → DREAMY → LOANER → JOY | 1 |

The regression tests verify every preview against the committed result, replay each route from the same starting state to check deterministic boards and IDs, and verify that each route removes all ten enemy positions with twelve total hits. They also cover keeping Ward for later, middle-turn alternatives and the later HAPPY opportunity.
