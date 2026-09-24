# WYRMLE

A single playable word-versus-concept encounter. Click to begin the existing enemy/tile decode sequence, then select any tiles in word order (adjacency is not required). Clear resets the selection; Attack submits the actual tile IDs. Invalid words do not consume tiles or Resolve. The existing interface and CSS are retained.

## Run and verify

```sh
npm install
npm run dev
npm test
npm run build
npm run lint
```

Tests use Node's built-in TypeScript support; use Node 22.18+ or a newer supported release. Word validation uses the same bundled `an-array-of-english-words` dictionary as the old project. Gameplay makes no API requests and requires no LLM.

## Pure engine

`src/game/` has no React or browser dependencies. Call `createGame(encounter)`, `toggleTile(state, tileId)`, `clearSelection(state)`, `previewAttack(state, selectedTileIds)`, and `submitWord(state, selectedTileIds)`. Functions return new state; selection order defines the word. Preview and submission use the same damage calculation. The tile-ID interface also supports future non-UI callers.

Reused and refactored from `../bookworm-game/src/game/`: numeric tile IDs, tile-attached gem effects, ordered selection/word construction, bundled dictionary lookup, immutable transitions, board-position refill with fresh IDs, successful attack history, preview structure, and win-before-loss resolution. The old test patterns for selection, deterministic replay, immutability, preview agreement, and distinct same-letter gems were adapted too. No old UI components, CSS, or assets were copied.

Creature encounters, tile locking, generic creature hooks, Sapphire damage, length/double-letter bonuses, and the separate `turnsRemaining` model were removed. Enemy concepts and configurable scoring data replace those assumptions. Repeated words remain legal when the board contains the necessary actual tiles.

## Rules and data

- `src/game/encounters.ts`: MELANCHOLY's definition, noun POS, 33 HP, handcrafted semantic groups, starting Resolve, 4×4 board, and deterministic refill queue. `rules` holds tunable scoring amounts and the grammar toggle.
- `src/game/rules.ts`: default semantic, grammar, and special-tile numbers. Each encounter can override these through its `rules` object.
- `src/game/semantic.ts`: exact, case-insensitive group matching and the semantic modifier. Unknown words are unrelated; no inferred semantic similarity.
- `src/game/grammar.ts`: optional +2 adjective→noun, adverb→verb, and adverb→adjective bonuses. Unknown or ambiguous POS data earns no grammar bonus.
- `src/game/dictionary.ts`: local word validity and a deliberately small, inspectable POS lexicon. Missing POS does not invalidate a dictionary word.
- `src/game/tiles.ts`: actual tile identities, Ward/Power effects, and deterministic consumption/refill. Effects are configured by the encounter's rules.
- `src/game/damage.ts`: word-length base damage → semantic adjustment (minimum 1) → optional grammar → tile bonuses. Preview includes the component amounts, effects, Resolve cost, and display bonuses.
- `src/game/game.ts`: validation, selections, attack submission, and terminal states.

`playerResolve` is the only remaining-turns/player-health resource. A valid attack normally costs exactly 1; including a Ward tile makes its cost 0. Multiple Wards do not heal. Each Power tile adds 3 damage. Enemy defeat is checked before Resolve exhaustion, so a lethal final attack wins. The visible turn number is derived from attack history, not stored as another resource.

The refill queue is consumed in board-position order, regardless of selection order, and never wraps or randomizes. New tiles have fresh IDs and no special effect. Encounter creation validates enough refill capacity for the starting Resolve plus possible Ward turns.

## Prototype examples

| Word | Damage | Resolve cost |
| --- | --- | --- |
| JOY with Ward Y | 3 + 5 counter = **8** | **0** |
| CHEER with Power E | 5 + 5 counter + 3 Power = **13** | **1** |
| SAD | max(1, 3 − 3 similar) + 2 adjective = **3** | **1** |
| GLOOM | 5 − 3 similar = **2** | **1** |

Grammar is enabled for the experiment. Setting `rules.grammar.enabled` to `false` makes SAD deal 1; its semantic resistance is applied before the grammatical bonus. JOY is stronger than the longer GLOOM. The queue supports the complete route **JOY → CHEER → HAPPY** (8 + 13 + 12 damage), ending in victory with 3 Resolve.

## Add another encounter

Add another plain `Encounter` object in `src/game/encounters.ts` with an enemy word, definition, POS, maximum HP, and explicit `similar`, `opposite`, and `related` word lists. Supply starting Resolve, 16 tiles with unique numeric IDs, an ample uppercase refill string, and scoring rules (copy the prototype rules as a starting point). Set a tile's `type: 'gem'` and `gem: 'ward'` or `'power'` to give that tile an effect. Add only confidently known POS entries to the small lexicon as needed. Pass the new encounter to `createGame` in `src/App.tsx`; the existing components read its data automatically.
