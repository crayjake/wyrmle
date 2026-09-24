import type { PuzzleAnalysis } from './analyse.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'

export type PuzzleDifficultyLabel = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'
export type PuzzleDifficultyInputs = {
  minimumWordsToWin: number | null
  bestKnownWordsToWin: number | null
  startingResolve: number
  winningLineCount: number
  viableOpeningCount: number
  requiredWordCommonness: number | null
  forcedWordCommonness?: number | null
  armourComplexity: number
  specialTileDependence: number
  grammarDependence: number
  trapComplexity: number
  clutchOnly: boolean
}
export type PuzzleDifficultyAnalysis = PuzzleDifficultyInputs & {
  resolveSlack: number | null
  estimatedResolveSlack: number | null
  mechanicComplexity: number
  score: number
  label: PuzzleDifficultyLabel
  estimated: boolean
  evidence: string
}

/** Depth is the primary signal; bounded witnesses never become a proved minimum. */
export const difficultyConfig = {
  depthBase: [0, 8, 20, 38, 58, 78, 88],
  thresholds: { medium: 30, hard: 53, expert: 75 },
  lowDiversityPenalty: 8,
  narrowOpeningPenalty: 5,
  vocabularyPenalty: 22,
  forcedVocabularyPenalty: 24,
  mechanicWeight: 8,
  noSlackPenalty: 5,
} as const

const unit = (n: number) => Math.max(0, Math.min(1, n))
export function ratePuzzleDifficulty(input: PuzzleDifficultyInputs): PuzzleDifficultyAnalysis {
  const depth = input.minimumWordsToWin ?? input.bestKnownWordsToWin
  if (depth === null || !Number.isSafeInteger(depth) || depth < 1) {
    throw new Error('Difficulty requires a verified winning depth.')
  }
  const config = difficultyConfig
  const mechanicComplexity = unit(input.armourComplexity) * 0.2
    + unit(input.specialTileDependence) * 0.35 + unit(input.grammarDependence) * 0.2
    + unit(input.trapComplexity) * 0.25
  const slack = input.startingResolve - depth
  let score: number = config.depthBase[Math.min(depth, config.depthBase.length - 1)]
  score += input.winningLineCount <= 1 ? config.lowDiversityPenalty
    : input.winningLineCount >= 8 ? -4 : 0
  score += input.viableOpeningCount <= 1 ? config.narrowOpeningPenalty
    : input.viableOpeningCount >= 5 ? -3 : 0
  if (input.requiredWordCommonness !== null) {
    score += unit((0.8 - input.requiredWordCommonness) / 0.8) * config.vocabularyPenalty
  }
  if (input.forcedWordCommonness != null) {
    score += unit((0.8 - input.forcedWordCommonness) / 0.8) * config.forcedVocabularyPenalty
  }
  score += mechanicComplexity * config.mechanicWeight
    + (slack <= 0 ? config.noSlackPenalty : 0) + (input.clutchOnly ? 4 : 0)
  score = Math.round(Math.max(0, Math.min(100, score)))
  const label: PuzzleDifficultyLabel = score >= config.thresholds.expert ? 'EXPERT'
    : score >= config.thresholds.hard ? 'HARD' : score >= config.thresholds.medium ? 'MEDIUM' : 'EASY'
  return { ...input, resolveSlack: input.minimumWordsToWin === null ? null : slack,
    estimatedResolveSlack: slack, mechanicComplexity, score, label,
    estimated: input.minimumWordsToWin === null,
    evidence: input.minimumWordsToWin === null
      ? 'Bounded search: depth is a winning upper bound; route counts are observed lower bounds.'
      : 'Minimum depth proved; route counts and familiarity may still be sampled.',
  }
}

export function difficultyFromAnalysis(encounter: LetterStrikeEncounter, analysis: PuzzleAnalysis): PuzzleDifficultyAnalysis {
  // Tile-ID permutations and alternative last words must not inflate route diversity.
  return ratePuzzleDifficulty({
    minimumWordsToWin: analysis.minimumTurnsProven ? analysis.minimumTurnsToWin : null,
    bestKnownWordsToWin: analysis.bestWinDepth,
    startingResolve: encounter.startingResolve,
    winningLineCount: analysis.numberOfDistinctWinningStrategies,
    viableOpeningCount: analysis.viableOpeningMoves,
    requiredWordCommonness: analysis.requiredObscureWordScore === null ? null : 1 - analysis.requiredObscureWordScore,
    armourComplexity: encounter.enemyLetters.filter(letter => letter.initialHits > 1).length / encounter.enemyLetters.length,
    specialTileDependence: Math.max(analysis.wardImportance ?? 0, analysis.strikeImportance ?? 0, analysis.regenImportance ?? 0),
    grammarDependence: analysis.grammarImportance ?? 0,
    trapComplexity: analysis.greedyTrapStrength,
    // A route ending at zero does not prove every possible win is a clutch.
    clutchOnly: analysis.maximumResolveProven && analysis.maximumResolveRemaining === 0,
  })
}
