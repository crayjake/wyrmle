import { createGame, submitWord } from '../game/game.ts'
import type { GameState } from '../game/types.ts'
import { resetDailyPuzzle, saveDailyRun } from './persistence.ts'
import type { DailyPuzzleDefinition, StorageLike } from './types.ts'

/** Real v1 engine replays, so test results pass the same restore checks as real play. */
export function playDevOutcome(puzzle: DailyPuzzleDefinition, outcome: 'won' | 'lost', storage: StorageLike) {
  if (!import.meta.env.DEV) throw new Error('Development tools are disabled.')
  let game = createGame(puzzle.encounter)
  const words = outcome === 'won' ? ['JOY', 'CHEER', 'HAPPY'] : ['ACE', 'ADO', 'EGO', 'AHS', 'HOM']
  for (const word of words) {
    const ids = wordIds(game, word, outcome === 'lost')
    game = submitWord(game, ids)
    if (game.error) throw new Error(game.error)
  }
  if (game.status !== outcome) throw new Error('The development replay does not match this puzzle.')
  resetDailyPuzzle(puzzle.puzzleId, storage)
  return saveDailyRun(puzzle, game, storage)
}

function wordIds(game: GameState, word: string, normalOnly: boolean): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = game.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id)
      && (!normalOnly || tile.type === 'normal'))
    if (!tile) throw new Error(`Development replay cannot spell ${word}.`)
    ids.push(tile.id)
  }
  return ids
}
