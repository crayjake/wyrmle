import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import { stateKey } from './stateKey.ts'

type Route = { moves: readonly { word: string; tileIds: readonly number[] }[] }
export type RefillPressureAnalysis = {
  encounterKey: string
  initialRefills: number
  replayedWinningLines: number
  winsOnReducedBoard: number
  winsAfterRefillsExhausted: number
  minimumTilesBeforeWinningMove: number | null
  reserveByEnemyLetter: { letter: string; boardCopies: number; reserveCopies: number; requiredHits: number }[]
  routes: {
    words: string[]
    firstEmptySlotAfterTurn: number | null
    movesOnReducedBoard: number
    movesWithNoRefills: number
    tilesBeforeWinningMove: number
    refillsRemaining: number
  }[]
  scope: 'exact-winning-route-replays'
}

/** Ending a winning turn with empty cells alone does not establish a supply
 * decision. Record words actually played from an already reduced board. */
export function analyseRefillPressure(encounter: LetterStrikeEncounter, lines: readonly Route[]): RefillPressureAnalysis {
  const count = (text: string, letter: string) => [...text].filter(value => value === letter).length
  const board = encounter.startingTiles.map(tile => tile.letter).join('')
  const routes: RefillPressureAnalysis['routes'] = []
  for (const line of lines) {
    let state = createLetterStrikeGame(encounter)
    let firstEmptySlotAfterTurn: number | null = null
    let movesOnReducedBoard = 0
    let movesWithNoRefills = 0
    let tilesBeforeWinningMove = state.tiles.length
    let valid = true
    for (const [index, move] of line.moves.entries()) {
      tilesBeforeWinningMove = state.tiles.filter(tile => tile.letter).length
      movesOnReducedBoard += Number(tilesBeforeWinningMove < encounter.startingTiles.length)
      movesWithNoRefills += Number(state.refillIndex === encounter.refillQueue.length)
      const next = submitLetterStrike(state, move.tileIds)
      if (next.error || next.playedWords.length !== state.playedWords.length + 1
        || next.playedWords.at(-1)?.word !== move.word) { valid = false; break }
      state = next
      if (firstEmptySlotAfterTurn === null && state.tiles.some(tile => !tile.letter)) firstEmptySlotAfterTurn = index + 1
    }
    if (!valid || state.status !== 'won') continue
    routes.push({ words: line.moves.map(move => move.word), firstEmptySlotAfterTurn, movesOnReducedBoard,
      movesWithNoRefills, tilesBeforeWinningMove, refillsRemaining: encounter.refillQueue.length - state.refillIndex })
  }
  return { encounterKey: stateKey(createLetterStrikeGame(encounter)), initialRefills: encounter.refillQueue.length, replayedWinningLines: routes.length,
    winsOnReducedBoard: routes.filter(route => route.movesOnReducedBoard > 0).length,
    winsAfterRefillsExhausted: routes.filter(route => route.movesWithNoRefills > 0).length,
    minimumTilesBeforeWinningMove: routes.length ? Math.min(...routes.map(route => route.tilesBeforeWinningMove)) : null,
    reserveByEnemyLetter: [...new Set(encounter.enemyLetters.map(letter => letter.letter))].map(letter => ({
      letter, boardCopies: count(board, letter), reserveCopies: count(encounter.refillQueue, letter),
      requiredHits: encounter.enemyLetters.filter(enemy => enemy.letter === letter).reduce((sum, enemy) => sum + enemy.hitsRemaining, 0),
    })), routes, scope: 'exact-winning-route-replays' }
}
