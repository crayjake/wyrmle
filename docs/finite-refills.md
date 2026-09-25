# Finite refills and Revive

Finite encounters opt in with `finiteRefills: true`. Their queue is the whole reserve, not a repeating bag or an estimate. Letters still arrive deterministically in consumed board-slot order; the player sees grouped counts, not future order. When fewer replacement letters remain than the word uses, those letters fill the earliest consumed slots and the rest become empty cells. The sixteen-cell grid keeps its positions.

An empty reserve does not end the game. The remaining board can still win. A finite game ends when the enemy is defeated, lives reach zero, or no dictionary word of the minimum length can be made. Victory takes precedence on the last life. Empty cells supply no letter and cannot be selected. Revive still happens after damage, so a letter brought back by a red tile must be defeated using the actual board and reserve.

The right-hand display groups reserve copies of surviving enemy letters, including zero counts. Other letters share a blank mini tile and multiplier. A revived letter reappears as its own group. There is no duplicate total counter. The static wyrm's remaining filled segments represent lives; the exact value remains available to assistive technology.

## Generating and reviewing

```sh
npm run generate -- --enemy ANGER --regen --refills 18 --count 24 --seed finite-review --out artifacts/finite-review
npm run generate -- --regen --refills 18 --count 24 --seed auto-finite --out artifacts/auto-finite
```

The second command uses enemy suitability screening. `--refills` accepts zero through 96; omit it for the previous padded-supply behavior. Finite-only mutations can adjust the reserve length as well as its letters, tile placement and other existing construction choices. Changing lives does not silently add replacement letters. Construction replays its proposed route again after shortening the reserve, so invalidated plans never become winning evidence.

The solver follows the same runtime transitions, including empty slots, exact physical IDs, Revive and no-word loss. Its graph ordering uses monotonically increasing tile IDs because the refill index stops advancing once the reserve is empty. Old encounters retain their original rules and lookup keys.

`analysis.refillPressure` contains engine-replayed winning routes, first empty-slot turns, moves played on reduced boards, moves with no refills, and the remaining letter counts. A finite candidate must have a witnessed win that actually makes another word after holes have appeared. Emptying the bag after the winning word alone earns no supply-pressure credit. A placed Revive tile must also show a measured effect. These checks supplement the existing grammar, meaning, variety, vocabulary and fairness gates.

Opening certification is separate from sampled fairness. Every physical selection of a declared opening spelling is checked, and each safe result needs an actual familiar winning continuation. Unknown results do not pass. The curated spelling scope is explicitly restricted and must never be described as covering every dictionary word or every later choice.

## Compatibility

The flag is opt-in. Historical queues still require enough refill letters for all turns and retain their exact deterministic snapshots. Daily saves and undo replay the matching published encounter; a newly selected finite daily receives its own publication version. Previously committed moves and completed results remain pinned until an explicit beta puzzle reset.
