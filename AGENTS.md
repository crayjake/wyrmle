# Wyrmle

Read [the current puzzle-authoring guide](docs/puzzle-authoring.md) before generating or publishing puzzles. `npm run generate:puzzle` is the current bingo-first workflow; the old combat and preview generators are historical.

The live game has reusable ordinary tiles, three lives, strict same-type antonyms, spare-tile removal and one attempt per puzzle. Do not reintroduce refills, neutral damage, grid/square layout options, preview modes or replay progression. Settings allow one or two rings of circular tiles, with two rings as the default; the final anagram always uses one ring. Calendar puzzles use the same rules. Easy-mode hints appear automatically only after a helper removes tiles: no starting clue or manual hint menu. Preserve device progress and content-addressed puzzle assets. Avoid -less answers.

Bingos must involve rearranging letters, not adding/removing a prefix or suffix to the enemy or recycling the same root. Check every alternative bingo too. Reject a weak board rather than hiding a real antonym or padding the queue.

Keep phone layouts within the viewport, and check both portrait and landscape. Follow existing flat colours and thin outlines. Small prose uses the proportional sans-serif variable. Large result headlines and popup titles use Georgia; other headings, labels, tiles and numbers retain their existing fonts.

Do not edit `notes.md`.
