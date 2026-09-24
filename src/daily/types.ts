import type { LetterStrikeEncounter, LetterStrikeEvaluation, LetterStrikeGem, LetterStrikeLetterOutcome, LetterStrikeState } from '../game/letterStrike.ts'

/** Information shown to the player; never an input to combat resolution. */
export type DifficultyMode = 'normal' | 'hard'

/** The authored puzzle is independent of any player's progress. */
export type DailyPuzzleDefinition = {
  readonly puzzleId: string
  readonly date: string
  readonly gameVersion: string
  readonly puzzleVersion: number
  readonly encounter: LetterStrikeEncounter
}

/** Only committed gameplay is saved; selections, errors and animations are UI state. */
export type DailyRun = {
  saveVersion: number
  mode: DifficultyMode
  puzzleId: string
  gameVersion: string
  puzzleVersion: number
  enemyLetters: LetterStrikeState['enemyLetters']
  playerResolve: number
  tiles: LetterStrikeState['tiles']
  refillIndex: number
  nextTileId: number
  playedWords: LetterStrikeState['playedWords']
  status: LetterStrikeState['status']
  completedAt: string | null
}

export type ResultTurn = {
  strikes: number
  lettersDestroyed: number
  armourBroken: number
  semanticLabel: LetterStrikeEvaluation['semanticLabel']
  letterOutcomes: LetterStrikeLetterOutcome[]
  tileIds: number[]
  specialTiles: { tileId: number; gem: LetterStrikeGem }[]
  strikeActivations: number
  resolveProtected: boolean
}

/** Small permanent local record, separate from the board/run snapshot. */
export type DailyResult = {
  mode: DifficultyMode
  puzzleId: string
  date: string
  gameVersion: string
  puzzleVersion: number
  enemyWord: string
  enemyLetterCount: number
  won: boolean
  startingResolve: number
  resolveRemaining: number
  attacks: number
  wordsPlayed: string[]
  totalStrikes: number
  lettersDestroyed: number
  armourBroken: number
  strongestHit: number
  largestRemoval: number
  counters: number
  resisted: number
  neutral: number
  strikeActivations: number
  wardSaves: number
  turns: ResultTurn[]
  completedAt: string
}

/** No local display fields. A future server must replay evidence, not trust this. */
export type DailyScoreSubmission = {
  mode: DifficultyMode
  puzzleId: string
  gameVersion: string
  puzzleVersion: number
  won: boolean
  resolveRemaining: number
  turnsUsed: number
  totalStrikes: number
  lettersDestroyed: number
  armourBroken: number
  tileIdsByTurn: number[][]
  semanticSequence: ResultTurn['semanticLabel'][]
  letterOutcomesByTurn: LetterStrikeLetterOutcome[][]
  wardSaves: number
  strikeActivations: number
  completedAt: string
}

export type DailySession = {
  mode: DifficultyMode
  /** Begin has been saved, even when no words have been submitted yet. */
  started: boolean
  game: LetterStrikeState | null
  result: DailyResult | null
  resumed: boolean
  error: string | null
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
