import type { Encounter, GameState, Gem, SemanticRelation } from '../game/types.ts'

/** The authored puzzle is independent of any player's progress. */
export type DailyPuzzleDefinition = {
  readonly puzzleId: string
  readonly date: string
  readonly gameVersion: string
  readonly puzzleVersion: number
  readonly encounter: Encounter
}

/** Only committed gameplay is saved; selections, errors and animations are UI state. */
export type DailyRun = {
  saveVersion: number
  puzzleId: string
  gameVersion: string
  puzzleVersion: number
  enemyHp: number
  playerResolve: number
  tiles: GameState['tiles']
  refillIndex: number
  nextTileId: number
  playedWords: GameState['playedWords']
  status: GameState['status']
  completedAt: string | null
}

export type ResultTurn = {
  damage: number
  relation: SemanticRelation
  tileIds: number[]
  specialTiles: { tileId: number; gem: Gem }[]
  resolveProtected: boolean
}

/** Small permanent local record, separate from the board/run snapshot. */
export type DailyResult = {
  puzzleId: string
  date: string
  gameVersion: string
  puzzleVersion: number
  enemyWord: string
  won: boolean
  startingResolve: number
  resolveRemaining: number
  attacks: number
  wordsPlayed: string[]
  totalDamage: number
  strongestHit: number
  counters: number
  resisted: number
  neutral: number
  specialTilesTriggered: number
  turns: ResultTurn[]
  completedAt: string
}

/** No local display fields. A future server must replay evidence, not trust this. */
export type DailyScoreSubmission = {
  puzzleId: string
  gameVersion: string
  puzzleVersion: number
  won: boolean
  resolveRemaining: number
  turnsUsed: number
  totalDamage: number
  completedAt: string
}

export type DailySession = {
  game: GameState | null
  result: DailyResult | null
  resumed: boolean
  error: string | null
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
