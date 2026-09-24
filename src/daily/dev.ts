import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { resetDailyPuzzle, saveDailyRun } from './persistence.ts'
import type { DailyPuzzleDefinition, StorageLike } from './types.ts'

/** Real v1 engine replays, so test results pass the same restore checks as real play. */
export function playDevOutcome(puzzle: DailyPuzzleDefinition, outcome: 'won' | 'lost', storage: StorageLike) {
  if (!import.meta.env.DEV) throw new Error('Development tools are disabled.')
  let game = createLetterStrikeGame(puzzle.encounter)
  if (puzzle.gameVersion === 'letter-strike-4') {
    // Exact identities preserve the Ward E for CHEER and Strike L for MELODY.
    const turns = outcome === 'won' ? [
      [0, 1, 2], [4, 5, 15, 18, 16], [11, 20, 9, 10, 14, 17],
      [8, 21, 22, 27], [24, 30, 33, 26, 25, 19],
    ] : [
      [13, 4, 6], [14, 18, 8], [20, 16, 7], [22, 19, 12], [0, 25, 3],
    ]
    for (const ids of turns) {
      game = submitLetterStrike(game, ids)
      if (game.error) throw new Error(game.error)
    }
  } else {
    const words = outcome === 'won' ? ['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'] : ['SAD', 'CEE', 'EEL', 'AGO', 'ERR']
    for (const word of words) {
      const ids = wordIds(game, word, outcome === 'lost')
      game = submitLetterStrike(game, ids)
      if (game.error) throw new Error(game.error)
    }
  }
  if (game.status !== outcome) throw new Error('The development replay does not match this puzzle.')
  resetDailyPuzzle(puzzle.puzzleId, storage)
  return saveDailyRun(puzzle, game, storage)
}

function wordIds(game: LetterStrikeState, word: string, normalOnly: boolean): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = game.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id)
      && (!normalOnly || tile.type === 'normal'))
    if (!tile) throw new Error(`Development replay cannot spell ${word}.`)
    ids.push(tile.id)
  }
  return ids
}
