# September 24, 2026 — archived MELANCHOLY walkthroughs

Full spoilers for the archived generated September 24 daily (puzzle version 5), retained by started or completed MELANCHOLY attempts. New or untouched attempts on both September 24 and 25 UTC share the exact DESPAIR puzzle (version 6); its walkthroughs are in the [enemy variety review](enemy-variety-review.md). **Settings → Beta tools → Reset puzzle** clears an older attempt and opens DESPAIR for its date. All three routes below were replayed through the real game engine using the frozen version 5 encounter. These are demonstrated wins, not claims of shortest play.

## Starting position and tile numbering

Start at **5 Resolve**. The enemy E has two hits of armour; every other enemy letter takes one hit. The two enemy Ls are separate targets.

Number board positions left to right, top to bottom. Position numbers stay fixed as the letters refill. Select positions in the listed order to spell each word; adjacency is not required. Exact choices matter when there are duplicate letters.

```text
Position:               Starting tile:
 1   2   3   4           U   L   R   V
 5   6   7   8           G  L◇   S   O
 9  10  11  12           M   O   D   H
13  14  15  16           I  A◆   Y   E
```

◇ Ward: the word costs no Resolve. ◆ Strike: that tile guarantees its matching hit, leaving the ordinary hit allowance available for other tiles. **E²** in the tables means E still needs two hits. Hit columns show damage in order; hitting E² once only breaks its armour.

## 1. SMALL: specials, counters and the last-Resolve finish

Use both special tiles in SMALL. Its adjective bonus gives two ordinary hits, while Strike adds A independently. Ward makes this opening free. Counters then clear L/H and O/Y; COURAGE uses the long-word bonus to remove C and crack the armoured E.

| Turn | Word | Positions to select | Enemy letters hit | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| 1 | **SMALL** (Ward + Strike) | 7 → 9 → 14 → 2 → 6 | M, A, L | 5 | E²NCHOLY |
| 2 | **LAUGH** | 14 → 7 → 1 → 5 → 12 | L, H | 4 | E²NCOY |
| 3 | **JOY** | 7 → 8 → 15 | O, Y | 3 | E²NC |
| 4 | **COURAGE** | 15 → 10 → 12 → 3 → 8 → 2 → 16 | C, E | 2 | EN |
| 5 | **LEAF** | 15 → 10 → 7 → 16 | E | 1 | N |
| 6 | **END** | 8 → 16 → 11 | N | 0 | Defeated |

The last move is a clutch: END removes the final N while Resolve falls from 1 to 0. Clearing the enemy on that turn wins. Other verified finishes from the same position include HEN, HONEY, LINE, LION, RUN, ONLY and CHILDREN. There is no need to find the longest word; a valid word that lands the final hit is enough.

## 2. Five turns: a three-hit HUMANE finish

This route wins with **1 Resolve remaining**. LAUGHED uses the ordinary L and the Strike A; save the Ward L for SILLY. The adjective bonus gives SILLY two hits while Ward makes that turn free. JOVIAL and COURAGE then leave M, E and N for one final word.

| Turn | Word | Positions to select | Enemy letters hit | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| 1 | **LAUGHED** (Strike) | 2 → 14 → 1 → 5 → 12 → 16 → 11 | L, A, H | 4 | ME²NCOLY |
| 2 | **SILLY** (Ward) | 7 → 13 → 12 → 6 → 15 | L, Y | 4 | ME²NCO |
| 3 | **JOVIAL** | 6 → 8 → 4 → 12 → 15 → 16 | O | 3 | ME²NC |
| 4 | **COURAGE** | 4 → 14 → 16 → 3 → 13 → 1 → 15 | C, E | 2 | MEN |
| 5 | **HUMANE** | 2 → 7 → 9 → 5 → 15 → 12 | M, N, E | 1 | Defeated |

HUMANE is a six-letter neutral adjective in this encounter: its ordinary hit, adjective bonus and long-word bonus give three hits. H, U and A have no surviving matching targets, so the hits land on M, N and E and clear the enemy. This is a verified five-turn route; it is not a proof that five is the minimum.

## 3. Save Ward: escape at 1 Resolve

This route saves the Ward L until turn five. Use the ordinary L at slot 2 in the first LAUGH. After CHOOSE you have 1 Resolve, the enemy has N remaining, and there is no N on your board. The second LAUGH must use the Ward L at slot 6: it buys a free refill and lets RUN finish.

| Turn | Word | Positions to select | Enemy letters hit | Resolve after | Enemy remaining |
|---|---|---|---|---:|---|
| 1 | **DREAMY** (Strike) | 11 → 3 → 16 → 14 → 9 → 15 | E, A, M, Y | 4 | ELNCHOL |
| 2 | **LAUGH** | 2 → 11 → 1 → 3 → 12 | L, H | 3 | ENCOL |
| 3 | **JOVIAL** | 2 → 16 → 4 → 13 → 12 → 15 | O, L | 2 | ENC |
| 4 | **CHOOSE** | 4 → 9 → 8 → 10 → 7 → 15 | C, E | 1 | N |
| 5 | **LAUGH** (Ward) | 6 → 2 → 3 → 5 → 14 | None | 1 | N |
| 6 | **RUN** | 9 → 4 → 2 | N | 0 | Defeated |

The second LAUGH does zero damage, keeps Resolve at 1, and brings N tiles onto the board. RUN then removes N and wins at 0 Resolve. Replaying that same LAUGH with an ordinary L instead produces a loss immediately: the enemy survives while Resolve falls to zero.

## Why these examples matter

- **Ward timing:** it can make an opening free or preserve your final turn while you refill.
- **Independent Strike:** DREAMY lands four hits by combining the Strike tile with its grammar and length bonuses.
- **Armour:** E must be hit twice; the first E hit does not remove it.
- **Refill planning:** a zero-damage word can still be useful when it supplies the next winning word and you can afford its Resolve cost.
- **Clutch resolution:** removing the final enemy letter wins even if that move spends your last Resolve.
