# Saved beta progress and stars

The beta picker automatically tracks the five new puzzles, earlier variants and original CHAOS:

| Display | Meaning |
| --- | --- |
| Not started | No attempt begun with the selected life budget |
| In progress | An unfinished attempt is ready to resume |
| Try again | The last attempt was lost and there is no earlier win |
| ★☆☆ · 3+ words | Completed; the exact best word count is shown |
| ★★☆ · 2 words | Completed in two words; a bingo remains to find |
| ★★★ · Bingo | Completed in one word |

The best win survives restarts, losses and switching the life selector. The same frozen board shares its best word count across life budgets, while 3-, 4- and 5-life attempts are saved separately. An improved result updates the picker in other open tabs too.

Opening a puzzle alone does not start it. Beginning, submitting an accepted word, or advancing the hints saves the relevant progress. Reopening or refreshing restores the board, enemy armour, remaining lives, word history and hint position. A partially selected, unsubmitted word is cleared. Revealing the answer by itself grants no completion or stars. **Restart** clears the current attempt and clues, retaining the best result.

This is browser-local storage, without accounts or synchronization between devices. Previous beta attempts were not recorded, so tracking begins with this update. Daily runs, preferences and statistics remain separate.

`src/experimental/bingo/progress.ts` stores small move logs under `wyrmle:beta:bingo:v1:` keys; it does not serialize large meaning tables or trust a saved board/health snapshot. Moves replay through the real engine. Corrupt or inconsistent attempts start fresh. Catalog asset hashes keep revised puzzles from inheriting an old board's results. The immutable original preview has its own versioned key. If browser storage fails, the game reports **Progress not saved** and remains playable, including restart.

Verification:

```sh
node --test --test-isolation=none tests/bingo-progress.test.ts tests/bingo-catalog.test.ts tests/bingo-new-set.test.ts tests/bingo-preview.test.ts
npm run typecheck
npm run lint
VITE_BASE_PATH=/wyrmle/ npm run build
```

All 16 focused tests pass. The five progress tests cover actual replay, score improvement, losses/restarts, life budgets, hint reveals, asset revisions, corrupt storage, small save size and daily isolation. Production-browser flows and portrait/landscape layout checks are recorded in `browser-check.json`; the browser used is Chromium, not iOS Safari.
