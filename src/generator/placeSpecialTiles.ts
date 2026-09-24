import type { LetterStrikeTile } from '../game/letterStrike.ts'
import type { Random } from './random.ts'

export function placeSpecialTiles(
  board: readonly LetterStrikeTile[], enemy: string, counters: readonly string[], bait: readonly string[], random: Random,
): LetterStrikeTile[] {
  const result = board.map(tile => ({ ...tile }))
  const usage = (letter: string, words: readonly string[]) => words.filter(word => word.includes(letter)).length
  // A duplicated Ward letter permits the same spelling with or without Ward.
  const wards = result.map(tile => ({ tile, score:
    (result.filter(other => other.letter === tile.letter).length > 1 ? 100 : 0)
    + usage(tile.letter, counters) + usage(tile.letter, bait) + random.next(),
  })).sort((a, b) => b.score - a.score)
  const ward = wards[0].tile
  ward.type = 'gem'
  ward.gem = 'ward'
  // Match resisted bait and other anchors so spending Strike has alternatives.
  const strikes = result.filter(tile => tile.id !== ward.id && enemy.includes(tile.letter))
    .map(tile => ({ tile, score: usage(tile.letter, bait) * 4 + usage(tile.letter, counters) + random.next() }))
    .sort((a, b) => b.score - a.score)
  const strike = strikes[0]?.tile
  if (strike) { strike.type = 'gem'; strike.gem = 'strike' }
  return result
}
