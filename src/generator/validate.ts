import type { PuzzleAnalysis, MechanicName } from './analyse.ts'
import { defaultValidationConfig } from './config.ts'
import type { ValidationConfig } from './config.ts'
import type { CandidatePuzzle } from './types.ts'
import { isLexicalAuditCurrent } from './lexicalAudit.ts'
import { isOpeningSafetyCertificateCurrent } from './openingSafety.ts'
import { createLetterStrikeGame } from '../game/letterStrike.ts'
import { stateKey } from './stateKey.ts'
import { isMeaningCompilationCurrent } from './meaningCompiler.ts'

export type ValidationIssue = { code: string; message: string }
export type ValidationResult = {
  accepted: boolean
  /** DEV acceptance is a review queue, never automatic permission to publish. */
  scope: 'development-review'
  reasons: ValidationIssue[]
  warnings: ValidationIssue[]
}

/** Transparent gates; unknown measurements create warnings, never invented zeros. */
export function validatePuzzle(candidate: CandidatePuzzle, analysis: PuzzleAnalysis, overrides: Partial<ValidationConfig> = {}): ValidationResult {
  const config = { ...defaultValidationConfig, ...overrides }
  const reasons: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const reject = (code: string, message: string) => reasons.push({ code, message })
  const warn = (code: string, message: string) => warnings.push({ code, message })
  if (candidate.provenance.generatorVersion === 'letter-strike-generator-3' && !candidate.encounter.meaningLexicon) {
    reject('missing-puzzle-meanings', 'Meaning-era candidates must package their definition-backed dictionary; removing it cannot restore legacy word validity.')
  }
  if (candidate.encounter.meaningLexicon && !isMeaningCompilationCurrent(candidate.encounter)) {
    reject('stale-or-incomplete-meanings', 'Every allowed spelling needs current definition and semantic evidence compiled from the complete dictionary before solving.')
  }
  if (candidate.encounter.finiteRefills) {
    if (!analysis.refillPressure || analysis.refillPressure.encounterKey !== stateKey(createLetterStrikeGame(candidate.encounter))) {
      reject('missing-refill-pressure', 'Finite-refill puzzles need current, replayed supply-pressure evidence.')
    } else if (analysis.refillPressure.winsOnReducedBoard < 1) {
      reject('decorative-refill-limit', 'No winning route plays from a board with empty slots. Merely running out on the final winning turn is not a supply decision.')
    }
    if (analysis.regenImportance !== undefined && analysis.regenImportance !== null
      && analysis.regenImportance < config.minimumIntendedMechanicImportance) {
      reject('decorative-finite-revive', 'The Revive tile in this finite-supply puzzle has negligible measured effect.')
    }
  }
  if (config.requireOpeningSafety) {
    const safety = analysis.openingSafety
    if (!safety || !isOpeningSafetyCertificateCurrent(candidate.encounter, safety)) {
      reject('opening-safety-unconfirmed', 'Every required opening needs a current exact winning continuation; missing, unsafe or unknown outcomes cannot pass the opening-safety gate.')
    } else {
      if (config.openingSafetyScope === 'all-valid-openings' && safety.scope !== 'all-valid-openings') {
        reject('opening-safety-scope', 'This publication requires all valid openings; a damaging-only certificate excludes zero-damage choices.')
      }
      if (!safety.enumeration.vocabularyComplete) {
        if (!config.allowRestrictedOpeningSafety) reject('restricted-opening-safety', 'A restricted spelling audit cannot certify every dictionary opening. Explicitly permit the declared restricted scope to review that narrower guarantee.')
        else warn('restricted-opening-safety', 'Opening safety is certified only for the explicitly listed spelling subset, including all physical selections of those words.')
      }
      if (config.requireFamiliarWinningWitness && (!safety.familiarity.required || safety.familiarity.minimum < config.minimumWinningWordCommonness)) {
        reject('opening-safety-familiarity', 'The opening certificate does not require every continuation word to meet this publication’s familiarity threshold.')
      }
    }
  }
  if (candidate.encounter.lexicalRules) {
    if (!analysis.lexicalAudit) {
      reject('missing-lexical-audit', 'Versioned lexical rules require a complete dictionary spelling audit before solving and validation.')
    } else if (!isLexicalAuditCurrent(candidate.encounter, analysis.lexicalAudit)) {
      reject('stale-lexical-audit', 'The lexical audit does not match the encounter, dictionary or lexical version, or its spelling enumeration is incomplete.')
    } else {
      const { opening, supply } = analysis.lexicalAudit
      if (supply.unknownPartOfSpeechWords > 0) warn('unknown-parts-of-speech',
        `${opening.unknownPartOfSpeechWords} opening spellings and ${supply.unknownPartOfSpeechWords} spellings in the full refill-supply superset have unknown POS; they receive no unsupported grammar category.`)
      if (supply.semanticFallbackWords > 0) warn('unlisted-semantics',
        `${opening.semanticFallbackWords} opening spellings and ${supply.semanticFallbackWords} spellings in the full refill-supply superset are unlisted semantically. Neutral gameplay fallback is not proof of unrelated meaning; the superset does not establish future reachability.`)
    }
  }
  if (analysis.solvable !== true) reject(analysis.solvable === false ? 'unsolvable' : 'solution-unconfirmed',
    analysis.solvable === false ? 'The puzzle has a proven losing initial state.' : 'No winning line was found within the search budget.')
  if (analysis.bestWinDepth !== null && analysis.bestWinDepth < config.minimumWinningTurns) {
    reject('too-short', `A witnessed win takes ${analysis.bestWinDepth} turn(s); minimum target is ${config.minimumWinningTurns}.`)
  }
  if (analysis.bestWinDepth !== null && analysis.bestWinDepth > config.maximumWinningTurns) {
    reject('too-long', `The shortest witnessed win takes ${analysis.bestWinDepth} turns; maximum target is ${config.maximumWinningTurns}.`)
  }
  if (analysis.reasonableOpeningMoves < config.minimumReasonableOpenings) {
    reject('few-reasonable-openings', `Only ${analysis.reasonableOpeningMoves} distinct reasonable opening words were observed.`)
  }
  // Reject from the lower bound: ignorance cannot make a puzzle appear unfair.
  // The conditional rate remains visible, but is not extrapolated over unknowns.
  if (analysis.fairness.prematureDeadStateRateLowerBound !== null
    && analysis.fairness.prematureDeadStateRateLowerBound > config.maximumPrematureDeadStateRate) {
    reject('premature-hopelessness', `${Math.round(analysis.fairness.prematureDeadStateRateLowerBound * 100)}% of sampled reasonable states are proven dead before final Resolve.`)
  }
  if (analysis.fairness.assessedFraction < config.minimumFairnessCoverage) {
    const message = `Only ${Math.round(analysis.fairness.assessedFraction * 100)}% of sampled reasonable states have a proven win/loss classification.`
    if (config.requireFairnessCoverage) reject('insufficient-fairness-evidence', message)
    else warn('insufficient-fairness-evidence', message)
  }
  if (analysis.fairness.unknownStates > 0) warn('bounded-fairness', `${analysis.fairness.unknownStates} reasonable states remain unknown; the reported dead-state rate is conditional on assessed states.`)
  if (analysis.solvable === true && analysis.requiredObscureWordScore === null && config.requireFamiliarWinningWitness) {
    reject('missing-familiar-winning-witness', 'No winning line has complete local familiarity annotations; familiar required vocabulary is not established.')
  }
  if (analysis.requiredObscureWordScore !== null && 1 - analysis.requiredObscureWordScore < config.minimumWinningWordCommonness) {
    reject('obscure-witness-dependency', 'Every fully annotated winning line found contains a word below the familiarity threshold.')
  }
  if (analysis.winningVocabularyCoverage < 1) warn('unknown-vocabulary', 'Some winning words lack local commonness annotations; no obscurity claim is made for them.')
  if (analysis.criticalSinglePointLetters.length > config.maximumCriticalSinglePointLetters) {
    reject('single-point-letter-dependencies', `Enemy positions ${analysis.criticalSinglePointLetters.join(', ')} have no spare physical letter supply even under optimistic refill reachability.`)
  }
  if (analysis.branchingFactor > config.maximumBranchingFactor) reject('chaotic-branching', `Mean observed branching is ${Math.round(analysis.branchingFactor)} distinct words.`)
  const intended: MechanicName[] = []
  if (config.requireSemanticImportance || candidate.goal.archetypes.includes('semantic-contrast')) intended.push('semantic')
  if (candidate.goal.archetypes.includes('ward-timing')) intended.push('ward')
  if (candidate.goal.archetypes.includes('strike-override')) intended.push('strike')
  if (candidate.goal.archetypes.includes('armour-break')) intended.push('armour')
  if (candidate.goal.archetypes.includes('grammar-twist')) intended.push('grammar')
  for (const mechanic of intended) {
    const comparison = analysis.counterfactuals.find(item => item.mechanic === mechanic)
    if (!comparison?.present) reject(`missing-${mechanic}`, `The intended ${mechanic} mechanic is absent.`)
    else if (comparison.importance === null) warn(`unmeasured-${mechanic}`, `The intended ${mechanic} mechanic has insufficient evidence.`)
    else if (comparison.importance < config.minimumIntendedMechanicImportance) reject(`decorative-${mechanic}`, `The intended ${mechanic} mechanic barely changes observed winning lines or solutions.`)
  }
  for (const mechanic of ['ward', 'strike'] as const) {
    const comparison = analysis.counterfactuals.find(item => item.mechanic === mechanic)
    if (!comparison?.present) continue
    if (comparison.importance !== null && comparison.importance < config.minimumIntendedMechanicImportance) {
      reject(`irrelevant-${mechanic}`, `The placed ${mechanic} tile has negligible observed effect.`)
    }
    if (analysis.specialTileChoices[mechanic] < 2) warn(`few-${mechanic}-choices`, `Fewer than two opening words use ${mechanic}; inspect whether saving it creates a later choice.`)
    const decision = analysis.specialTileDecisions[mechanic]
    if (decision.automaticInReasonableOpenings === true) {
      reject(`automatic-${mechanic}`, `Every reasonable opening consumes ${mechanic}, with complete legal opening discovery; no preservation choice exists under the configured reasonable-play definition.`)
    } else if (decision.reasonableOpeningWordsUsing > 0 && decision.reasonableOpeningWordsPreserving === 0) {
      warn(`no-observed-${mechanic}-preservation`, `Every sampled reasonable opening consumes ${mechanic}; incomplete discovery cannot prove it is automatic.`)
    }
  }
  if (analysis.armouredLetterCoverage < 1) warn('armour-coverage', 'Some armoured positions have fewer than two observed matching word routes.')
  if (candidate.goal.archetypes.includes('clutch-finish') && analysis.clutchOpportunityCount === 0) reject('missing-clutch', 'No witnessed final-Resolve winning move supports the clutch archetype.')
  if (candidate.goal.archetypes.includes('multiple-routes') && analysis.numberOfDistinctWinningStrategies < 2) reject('missing-route-variety', 'Fewer than two winning strategy signatures were observed.')
  if (candidate.goal.archetypes.includes('greedy-trap')) {
    if (analysis.greedyTrapStrength <= 0) reject('missing-greedy-tradeoff', 'No observed winning route trades immediate usefulness for a different opening; the intended greedy trap is unsupported.')
    else if (analysis.isStrongestImmediateOptimal !== false) warn('greedy-trap-unproved', 'A different strategic opening was observed, but bounded search has not proved that the strongest immediate move loses.')
  }
  if (analysis.numberOfDistinctWinningStrategies < 2) warn('single-observed-strategy', 'Only one winning strategy was found; more may exist outside the search budget.')
  if (!analysis.minimumTurnsProven) warn('minimum-depth-unproven', 'The best witnessed solution depth is not a proved minimum.')
  if (analysis.searchLimitReached) warn('bounded-search', 'Search limits were reached; solution counts and opportunity counts are lower bounds.')
  return { accepted: reasons.length === 0, scope: 'development-review', reasons, warnings }
}
