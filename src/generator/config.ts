/** All quality thresholds are local, deterministic, and deliberately editable. */
export const defaultAnalysisConfig = {
  reasonableMovesPerState: 3,
  reasonableScoreMargin: 130,
  maxReasonableStates: 64,
  maxReasonableMoves: 64,
  maxReasonableSelections: 400,
  maxFinalStates: 12,
  maxFinalMoves: 250,
  includeCounterfactuals: true,
  counterfactualMaxStates: 40,
  counterfactualBeamWidth: 8,
} as const

export type ValidationConfig = {
  requireOpeningSafety?: boolean
  openingSafetyScope?: 'all-damaging-openings' | 'all-valid-openings'
  allowRestrictedOpeningSafety?: boolean
  minimumWinningTurns: number
  maximumWinningTurns: number
  minimumReasonableOpenings: number
  maximumPrematureDeadStateRate: number
  minimumFairnessCoverage: number
  minimumWinningWordCommonness: number
  maximumCriticalSinglePointLetters: number
  maximumBranchingFactor: number
  minimumIntendedMechanicImportance: number
  requireSemanticImportance: boolean
  requireFairnessCoverage: boolean
  requireFamiliarWinningWitness: boolean
}

export const defaultValidationConfig: ValidationConfig = {
  requireOpeningSafety: false,
  openingSafetyScope: 'all-damaging-openings',
  allowRestrictedOpeningSafety: false,
  minimumWinningTurns: 3,
  maximumWinningTurns: 7,
  minimumReasonableOpenings: 2,
  maximumPrematureDeadStateRate: 0.4,
  minimumFairnessCoverage: 0.2,
  minimumWinningWordCommonness: 0.5,
  maximumCriticalSinglePointLetters: 1,
  maximumBranchingFactor: 500,
  minimumIntendedMechanicImportance: 0.015,
  requireSemanticImportance: true,
  // Bounded exploratory candidates may be accepted for DEV review with a warning.
  // Raise this for publication; unknown states are never counted as safe states.
  requireFairnessCoverage: false,
  requireFamiliarWinningWitness: true,
}

export const defaultScoreWeights = {
  solution: 12,
  semanticChoices: 12,
  multipleStrategies: 8,
  resistedBait: 5,
  wardDecisions: 5,
  strikeDecisions: 5,
  grammarRelevance: 4,
  armourRelevance: 4,
  refillPlanning: 5,
  finiteSupplyChoices: 8,
  lateSuspense: 8,
  clutch: 5,
  commonVocabulary: 8,
  branching: 4,
  letterRedundancy: 5,
  tradeoff: 5,
  prematureHopelessness: -25,
  unknownFairness: -5,
  singlePointDependency: -10,
  obscureWinningWords: -12,
  semanticIrrelevance: -8,
  decorativeSpecials: -4,
  forcedSequence: -5,
  trivialWin: -20,
  chaoticBranching: -5,
} as const

export type ScoreWeights = { [Key in keyof typeof defaultScoreWeights]: number }
