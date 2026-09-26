import type { LetterStrikeTile } from '../game/letterStrike.ts'
import type { Random } from './random.ts'

export function validateRegenTileCount(value?: number): number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > 3)) throw new Error('Choose between 0 and 3 enemy Revive tiles.')
  return value
}

export function placeSpecialTiles(
  board: readonly LetterStrikeTile[], enemy: string, counters: readonly string[], bait: readonly string[], random: Random,
  options: { includeRegenTile?: boolean; regenTileCount?: number } = {},
): LetterStrikeTile[] {
  const regenCount = validateRegenTileCount(options.regenTileCount) ?? Number(options.includeRegenTile === true)
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
  for (let index = 0; index < regenCount; index++) {
    // Put danger on an attractive matching letter, preferably with a safe
    // duplicate: physical tile choice matters even for the same spelling.
    const regens = result.filter(tile => tile.type === 'normal' && enemy.includes(tile.letter))
      .map(tile => ({ tile, score:
        (result.some(other => other.id !== tile.id && other.type === 'normal' && other.letter === tile.letter) ? 100 : 0)
        + usage(tile.letter, counters) * 4 + usage(tile.letter, bait) + random.next(),
      })).sort((a, b) => b.score - a.score)
    const regen = regens[0]?.tile
    if (regen) { regen.type = 'gem'; regen.gem = 'regen' }
    else throw new Error('The board has too few matching normal tiles for the requested Revive count.')
  }
  return result
}
