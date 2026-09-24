import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeState } from '../game/letterStrike.ts'
import { resetDailyPuzzle, saveDailyRun } from './persistence.ts'
import type { DailyPuzzleDefinition, StorageLike } from './types.ts'

/** Real v1 engine replays, so test results pass the same restore checks as real play. */
export function playDevOutcome(puzzle: DailyPuzzleDefinition, outcome: 'won' | 'lost', storage: StorageLike) {
  if (!import.meta.env.DEV) throw new Error('Development tools are disabled.')
  let game = createLetterStrikeGame(puzzle.encounter)
  const words = outcome === 'won' ? ['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'] : ['SAD', 'CEE', 'EEL', 'AGO', 'ERR']
  for (const word of words) {
    const ids = wordIds(game, word, outcome === 'lost')
    game = submitLetterStrike(game, ids)
    if (game.error) throw new Error(game.error)
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
