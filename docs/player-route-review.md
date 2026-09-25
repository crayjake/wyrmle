# DESPAIR player route review

The reported route **TILE → DAD → WHERE → ANGRY → PORNOS** is legal and winning
on both the archived v6 DESPAIR encounter and the v7 lexical update. TILE is
spellable: the original board has **L at tile ID 12**. No prefix in that route
is a dead state.

This audit replayed the actual engine. `discoverValidMoves(state,
{ vocabulary: [word] })` enumerated every physical choice for each submitted
spelling, retaining different board-slot choices. The prefix reaches one state
after TILE, two after DAD, four after WHERE and sixteen after ANGRY. Every final
state has the same available spellings, S and P remaining, one life and the
unused Heart O.

## Alternatives after ANGRY

Full dictionary discovery examined **4,125 physical moves** in each of the
sixteen final states, with no selection or move limits. There are **35 distinct
winning spellings in v6**, and **39 in v7**. These sets are identical across all
sixteen physical variants within each version.

Ordinary alternatives that win immediately in both versions include **PROOFS,
PRONGS, SPONGY, DROOPS and PONCHOS**. Their length bonus permits both remaining
letters to be hit. V7 additionally allows the shorter **POSH, SOPPY and SPRY**
through the broader adjective lookup (PROSY is the fourth additional spelling).
These examples are editorial descriptions of ordinary words, not claims based
on a corpus-frequency measurement.

The unused Heart also permits a simple two-word finish: **SHOP → POD**. SHOP
must use the Heart O so that the player keeps their last life. It removes S;
POD removes P and wins while spending the final life. Enumeration found **192
winning physical routes** for the complete six-word sequence in each version.

One exact replay, valid in both versions:

| Word | Tile IDs, in spelling order | Hits | Lives after |
| --- | --- | ---: | ---: |
| TILE | 13, 14, 12, 15 | 2 | 4 |
| DAD | 4, 0, 6 | 1 | 3 |
| WHERE | 1, 18, 21, 10, 22 | 1 | 2 |
| ANGRY | 17, 9, 27, 23, 19 | 2 | 1 |
| SHOP | 5, 24, **11 (Heart)**, 16 | 1 | 1 |
| POD | 20, 26, 28 | 1 | 0, victory |

For this same four-word prefix, single-word examples include:

| Finish | Tile IDs | Versions |
| --- | --- | --- |
| PROOFS | 16, 7, **11 (Heart)**, 26, 2, 5 | v6 and v7 |
| PRONGS | 16, 7, **11 (Heart)**, 32, 29, 5 | v6 and v7 |
| SPONGY | 5, 16, **11 (Heart)**, 32, 29, 3 | v6 and v7 |
| PORNOS | 16, **11 (Heart)**, 7, 32, 26, 5 | v6 and v7 |
| POSH | 16, **11 (Heart)**, 5, 24 | v7 |
| SPRY | 5, 16, 7, 3 | v7 |

These Heart examples win with one life remaining; SPRY wins with zero. PORNOS
can also use both normal O tiles and win with zero. The submitted spelling alone
does not reveal which O tiles the player actually selected.

## Earlier continuations

A separate bounded search restricted to the provider's familiar vocabulary
found ordinary winning continuations after TILE, DAD and WHERE. These are
replayed witnesses, not exhaustive route counts or minimum-depth proofs.

For example, **TILE → SHADOW → HOPE → FEAR → DOG** wins with one life in both
versions, using these IDs:

- TILE: 13, 14, 12, 15
- SHADOW: 5, 18, 17, 4, **11 (Heart)**, 1
- HOPE: 24, 8, 16, 21
- FEAR: 2, 22, 0, 7
- DOG: 28, 26, 27

After **TILE → DAD → WHERE**, witnessed alternatives include
**ANGRY → SONG (Heart) → HOPE** and **HAPPY → SONG (Heart) → CRY**, winning with
zero lives. Finding these routes proves those prefixes are recoverable; it does
not establish that every other possible player choice is recoverable.

The old curated familiarity table omits several ordinary finishing words above.
An unknown familiarity score must not be described as an obscure-word requirement.
The lexical coverage repair and the vocabulary-familiarity metric are separate.
