import type { GameRules, Tile, TileEffect } from './types.ts'

type TileSelection<TileType> = { tiles: readonly TileType[]; selectedTileIds: readonly number[] }
type NormalTile = { id: number; letter: string; type: 'normal' }

// Adapted from bookworm-game's selected-ID lookup: order spells the word,
// and duplicate letters keep their individual effects. Adjacency is irrelevant.
export function getSelectedTiles<TileType extends { id: number }>(state: TileSelection<TileType>, selectedTileIds = state.selectedTileIds): TileType[] {
  const tiles: TileType[] = []
  for (const id of selectedTileIds) {
    const tile = state.tiles.find((candidate) => candidate.id === id)
    if (tile) tiles.push(tile)
  }
  return tiles
}

// Adapted from its Sapphire rule, using the same per-tile gem infrastructure.
export function applyTileEffects(
  tiles: readonly Tile[],
  damage: number,
  resolveCost: number,
  rules: GameRules['tileEffects'],
): { damage: number; resolveCost: number; effects: TileEffect[] } {
  const effects: TileEffect[] = []
  for (const tile of tiles) {
    if (tile.type !== 'gem' || !tile.gem) continue
    const rule = rules[tile.gem]
    effects.push({
      tileId: tile.id,
      gem: tile.gem,
      bonusDamage: rule.bonusDamage,
      preventsResolveLoss: rule.preventResolveLoss,
    })
    damage += rule.bonusDamage
    if (rule.preventResolveLoss) resolveCost = 0
  }
  return { damage, resolveCost, effects }
}

// Reuses bookworm-game's board-order replacement and monotonic tile IDs.
// Unselected tiles stay in their original positions with their original IDs.
export function refillBoard<TileType extends { id: number }>(state: TileSelection<TileType> & {
  refillIndex: number
  nextTileId: number
  encounter: { refillQueue: string; finiteRefills?: true }
}, selectedTileIds = state.selectedTileIds) {
  const consumed = new Set(selectedTileIds)
  let refillIndex = state.refillIndex
  let nextTileId = state.nextTileId
  const tiles = state.tiles.map((tile): TileType | NormalTile => {
    if (!consumed.has(tile.id)) return tile
    const letter = state.encounter.refillQueue[refillIndex]
    if (!letter) {
      if (!state.encounter.finiteRefills) throw new Error('Encounter refill queue exhausted.')
      return { id: nextTileId++, letter: '', type: 'normal' }
    }
    refillIndex += 1
    return { id: nextTileId++, letter: letter.toUpperCase(), type: 'normal' }
  })
  return { tiles, refillIndex, nextTileId }
}
