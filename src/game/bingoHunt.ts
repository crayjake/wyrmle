import type { LetterStrikeEncounter, LetterStrikeState } from './letterStrike.ts'

export type BingoHuntRules = { answer: string; removalOrder: readonly number[] }

const letters = (text: string) => [...text].sort().join('')

/** The removed physical copies must leave exactly the authored answer. */
export function validateBingoHunt(encounter: LetterStrikeEncounter) {
  const rule = encounter.bingoHunt
  if (!rule) return
  const ids = new Set(rule.removalOrder)
  const kept = encounter.startingTiles.filter(tile => !ids.has(tile.id))
  const meaning = encounter.meaningLexicon?.words[rule.answer]
  const available = [...rule.answer]
  const coversEnemy = encounter.enemyLetters.every(letter => {
    const index = available.indexOf(letter.letter)
    if (index < 0 || letter.initialHits !== 1) return false
    available.splice(index, 1)
    return true
  })
  if (encounter.counterRules?.kind !== 'antonym' || encounter.startingResolve !== 3
    || !encounter.finiteRefills || encounter.refillQueue !== ''
    || encounter.startingTiles.some(tile => tile.type !== 'normal' || tile.gem)
    || !/^[A-Z]{3,14}$/.test(rule.answer) || meaning?.relation !== 'opposite'
    || !meaning.partsOfSpeech.includes(encounter.counterRules.partOfSpeech) || !coversEnemy
    || ids.size !== rule.removalOrder.length || ids.size < 2
    || [...ids].some(id => !encounter.startingTiles.some(tile => tile.id === id))
    || letters(kept.map(tile => tile.letter).join('')) !== letters(rule.answer)) {
    throw new Error('Bingo hunt needs three lives, ordinary reusable tiles, no refills and an exact removable spare set.')
  }
}

export function huntRemovalIds(state: LetterStrikeState): number[] {
  const order = state.encounter.bingoHunt!.removalOrder
  const total = Math.min(order.length, Math.ceil(order.length * (state.playedWords.length + 1) / 2))
  return order.slice(0, total).filter(id => state.tiles.some(tile => tile.id === id && tile.letter !== ''))
}

/** Keep grid identities stable for selection, animations and saved move replay. */
export function removeHuntSpares(state: LetterStrikeState, ids: readonly number[]) {
  const removed = new Set(ids)
  return { tiles: state.tiles.map(tile => removed.has(tile.id) ? { ...tile, letter: '' } : tile) }
}
