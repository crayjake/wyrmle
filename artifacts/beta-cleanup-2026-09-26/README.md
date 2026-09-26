# Beta screens and current rules

The beta game has one header, the life meter, enemy and board. Hints remain one tap away. The menu contains restart, played words, help, remaining refills and the daily return.

After the final hit animation, a result screen shows the current run’s stars and played words. One-word wins get a Bingo screen: the wyrm sweeps over the stars as they light up, then rests above the last star. Reduced-motion mode shows the resting wyrm without the sweep. Other wins offer “Find the bingo” without showing the hidden answer. Next puzzle keeps the selected life count; the last entry returns to the library. Saved best ratings and resumed attempts remain intact.

The tutorial teaches the current meaning rules with ordinary tiles, a finite reserve, and optional armour, resistance and bingo lessons. Current generator v6 and fresh daily publication v14 contain no special tiles. Historical engine behavior remains solely for archived-save replay and explicit archived construction. v13 difficulty and solution certificates are not reused as v14 proofs.

Screenshots: [board](board-phone.png), [bingo](bingo-phone.png), [ordinary win](solved-phone.png).

Browser checks use Chromium with the production `/wyrmle/` base path. Reports cover 320×480 through 430×740 portrait, 568×320 and 844×390 landscape, saved results, hints, three-word and one-word wins, next-puzzle navigation, and the complete tutorial. See [beta checks](browser-check.json) and [tutorial checks](tutorial-check.json). Safari was not available in this environment.

Validation: all 587 Node tests passed (149.6 seconds locally); lint, TypeScript and the production build passed. Chromium checks include normal-motion wyrm movement, reduced-motion behavior, a four-life bingo, loss → hint → retry, and 43 browser scenarios overall. The finite-supply v14 daily has a replayed three-word winning witness in `tests/plain-tiles.test.ts`; this is a solvability witness, not a minimum proof.
