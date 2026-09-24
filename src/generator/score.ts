import type { PuzzleAnalysis } from './analyse.ts'
import { defaultScoreWeights } from './config.ts'
import type { ScoreWeights } from './config.ts'
import type { CandidatePuzzle } from './types.ts'

export type ScoreComponent = { name: keyof ScoreWeights; value: number; weight: number; contribution: number; explanation: string }
export type QualityScore = { total: number; rawTotal: number; components: ScoreComponent[] }
const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Scores describe the observed candidate; validation is an independent gate. */
export function scorePuzzle(candidate: CandidatePuzzle, analysis: PuzzleAnalysis, overrides: Partial<ScoreWeights> = {}): QualityScore {
  const weights = { ...defaultScoreWeights, ...overrides }
  const components: ScoreComponent[] = []
  const add = (name: keyof ScoreWeights, value: number, explanation: string) => {
    const bounded = clamp(value)
    components.push({ name, value: bounded, weight: weights[name], contribution: bounded * weights[name], explanation })
  }
  add('solution', analysis.solvable === true && (analysis.bestWinDepth ?? 0) >= 3 ? 1 : analysis.solvable === true ? 0.4 : 0, 'A replayed winning witness with room for several turns.')
  add('semanticChoices', (analysis.semanticMechanicImportance ?? 0) * 2, 'Measured semantic counterfactual and exact route replays.')
  add('multipleStrategies', Math.log2(Math.max(1, analysis.numberOfDistinctWinningStrategies)) / 3, 'Distinct observed opening/category/special-timing signatures, capped at eight.')
  add('resistedBait', analysis.resistedBaitQuality, 'Playable resisted words compete with counters in the opening.')
  add('wardDecisions', (analysis.wardImportance ?? 0) * 2 * Math.min(1, analysis.specialTileChoices.ward / 2), 'Ward changes outcomes or Resolve and has several observed uses.')
  add('strikeDecisions', (analysis.strikeImportance ?? 0) * 2 * Math.min(1, analysis.specialTileChoices.strike / 2), 'Strike affects matching hits or outcomes and has several observed uses.')
  add('grammarRelevance', (analysis.grammarImportance ?? 0) * 2, 'Measured effect of disabling encounter grammar.')
  add('armourRelevance', (analysis.armourImportance ?? 0) * 2 * analysis.armouredLetterCoverage, 'Armour changes play and has several matching word opportunities.')
  add('refillPlanning', analysis.refillPlanningImportance, 'Fraction of observed winning moves using newly refilled physical tiles.')
  add('lateSuspense', (analysis.penultimateRescueRate ?? 0) * Math.min(1, analysis.fairness.finalResolveStates / 3), 'Assessed sampled final-Resolve positions with at least one direct winning move.')
  add('clutch', Math.min(1, analysis.clutchOpportunityCount / 3) * (analysis.clutchWordCommonness ?? 0), 'Witnessed final-Resolve rescues with annotated fair vocabulary.')
  add('commonVocabulary', analysis.winningWordCommonness ?? 0, 'Mean familiarity of annotated winning words; unknown coverage is reported separately.')
  add('branching', analysis.reasonableOpeningMoves >= 2 ? Math.min(1, analysis.reasonableOpeningMoves / 5) : 0, 'Several distinct plausible opening words.')
  add('letterRedundancy', analysis.enemyLetterRedundancy, 'Observed alternative matching words for enemy positions.')
  add('tradeoff', Math.max(analysis.greedyTrapStrength, analysis.resistedBaitQuality * (analysis.strikeImportance ?? 0), analysis.numberOfDistinctWinningStrategies > 1 ? 0.4 : 0), 'Observed sequence tradeoffs, useful bait, or different winning routes.')
  add('prematureHopelessness', analysis.fairness.prematureDeadStateRateLowerBound ?? 0, 'Only proven premature dead states incur this penalty; unknowns are separate.')
  add('unknownFairness', 1 - analysis.fairness.assessedFraction, 'Limited fairness evidence incurs a modest uncertainty penalty.')
  add('singlePointDependency', analysis.criticalSinglePointLetters.length / Math.max(1, candidate.encounter.enemyLetters.length), 'Physical supply has no spare copies even in the optimistic reachable queue.')
  add('obscureWinningWords', analysis.requiredObscureWordScore ?? 0, 'Least familiar word in the best fully annotated winning witness; not a global necessity claim.')
  add('semanticIrrelevance', analysis.semanticMechanicImportance === null ? 0 : 1 - Math.min(1, analysis.semanticMechanicImportance * 8), 'Semantic effects that scarcely affect measured routes are penalized.')
  const specials = analysis.counterfactuals.filter(item => item.present && (item.mechanic === 'ward' || item.mechanic === 'strike'))
  add('decorativeSpecials', specials.length ? specials.filter(item => item.importance !== null && item.importance < 0.015).length / specials.length : 0, 'Placed special tiles with negligible measured impact.')
  add('forcedSequence', analysis.numberOfDistinctWinningStrategies <= 1 ? 1 : 0, 'Only one observed winning strategy; the search may be incomplete.')
  add('trivialWin', analysis.bestWinDepth !== null && analysis.bestWinDepth <= 1 ? 1 : 0, 'A witnessed one-move finish.')
  add('chaoticBranching', Math.max(0, analysis.branchingFactor - 150) / 350, 'Large distinct-word branching makes intended choices less legible.')
  const rawTotal = components.reduce((sum, component) => sum + component.contribution, 0)
  return { total: Math.round(Math.max(0, Math.min(100, rawTotal)) * 100) / 100, rawTotal, components }
}
