import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import { defaultAnalysisConfig } from './config.ts'
import { discoverValidMoves, moveSummary, scoreImmediateMove } from './findMoves.ts'
import type { SolverMoveSummary } from './findMoves.ts'
import type { MoveDiscovery } from './findMoves.ts'
import { getWordCommonness } from './lexicalProvider.ts'
import { auditEncounterLexicon } from './lexicalAudit.ts'
import type { LexicalAudit } from './lexicalAudit.ts'
import type { OpeningSafetyReport } from './openingSafety.ts'
import { selectDiverseWinningLines, solvePuzzle, winningStrategySignature } from './solve.ts'
import type { SolverOptions, SolverResult, WinningLine } from './solve.ts'
import type { CandidatePuzzle } from './types.ts'
import { encounterRuleKey, stateKey } from './stateKey.ts'
import { analyseRefillPressure } from './refillPressure.ts'
import type { RefillPressureAnalysis } from './refillPressure.ts'

export type MechanicName = 'semantic' | 'ward' | 'strike' | 'grammar' | 'armour' | 'regen'
export type ReviewLine = { moves: SolverMoveSummary[]; turns: number; resolveRemaining: number }
export type ClutchLine = {
  stateKey: string
  remainingLetters: string
  prefix: SolverMoveSummary[]
  winningMoves: SolverMoveSummary[]
  commonness: number | null
  wordLength: number
  difficulty: number | null
  discoveryComplete: boolean
}
export type MechanicComparison = {
  mechanic: MechanicName
  present: boolean
  importance: number | null
  evidence: 'absent' | 'route-replay-and-bounded-search' | 'route-replay' | 'unknown'
  withoutStatus: 'won' | 'impossible' | 'unknown' | 'not-run'
  withoutBestWinDepth: number | null
  withoutResolveRemaining: number | null
  withoutSearchComplete: boolean
  replayedWinningLines: number
  changedWinningOutcomes: number
  changedStrikeCount: number
  changedRecoveryCount?: number
}
export type LetterOpportunity = {
  position: number
  letter: string
  requiredHits: number
  currentBoardCopies: number
  reachableRefillCopies: number
  /** Optimistic physical supply; includes queue letters that may never be drawn. */
  physicalSupplyUpperBound: number
  observedMatchingMoves: number
  observedCategories: string[]
  observedStrikeExceptions: number
}
export type SpecialTileDecision = {
  openingWordsUsing: number
  openingWordsPreserving: number
  reasonableOpeningWordsUsing: number
  reasonableOpeningWordsPreserving: number
  winningUseTurns: number[]
  mandatoryInObservedWins: boolean | null
  /** True only when every legal opening was discovered; false has a preservation witness. */
  automaticInReasonableOpenings: boolean | null
  openingDiscoveryComplete: boolean
}
export type PuzzleAnalysis = {
  /** Full-dictionary spelling audit, completed before bounded search for new lexical rules. */
  lexicalAudit?: LexicalAudit
  /** Optional separate opening certificate; exploratory analysis alone does not imply safety. */
  openingSafety?: OpeningSafetyReport
  refillPressure?: RefillPressureAnalysis
  solvable: boolean | null
  minimumTurnsToWin: number | null
  minimumTurnsProven: boolean
  bestWinDepth: number | null
  maximumResolveRemaining: number | null
  maximumResolveProven: boolean
  winningLinesFound: number
  winningLines: ReviewLine[]
  viableOpeningMoves: number
  reasonableOpeningMoves: number
  branchingFactor: number
  branchingFactorIsLowerBound: boolean
  deadEndRate: number | null
  prematureDeadStateRate: number | null
  penultimateRescueRate: number | null
  remainingLetterCoverage: number
  reachableWinDepth: number | null
  clutchOpportunityCount: number
  clutchLines: ClutchLine[]
  clutchWordCommonness: number | null
  clutchWordLength: number | null
  clutchWordDifficulty: number | null
  clutchWinningMoves: number
  fairness: {
    reasonableStates: number
    provenDeadStates: number
    provenWinningStates: number
    unknownStates: number
    assessedFraction: number
    prematureDeadStateRateLowerBound: number | null
    prematureDeadStateRateUpperBound: number | null
    finalResolveStates: number
    rescuedFinalStates: number
    finalStatesWithoutRescue: number
    finalStatesUnknown: number
    scope: 'bounded-reasonable-state-sample'
    samplingSchedule: 'alternating-breadth-and-depth'
    sampledDepthCounts: Record<string, number>
  }
  statesExplored: number
  searchLimitReached: boolean
  searchComplete: boolean
  vocabularyComplete: boolean
  counterMoveUsage: number
  neutralMoveUsage: number
  resistedMoveUsage: number
  semanticMechanicImportance: number | null
  resistedBaitQuality: number
  wardImportance: number | null
  strikeImportance: number | null
  regenImportance?: number | null
  armourImportance: number | null
  grammarImportance: number | null
  counterfactuals: MechanicComparison[]
  strongestImmediateMove: string | null
  optimalStrategicMove: string | null
  isStrongestImmediateOptimal: boolean | null
  greedyTrapStrength: number
  numberOfDistinctWinningStrategies: number
  winningWordCommonness: number | null
  winningVocabularyCoverage: number
  requiredObscureWordScore: number | null
  requiredVocabularyEvidence: 'best-observed-winning-line'
  letterOpportunityCounts: LetterOpportunity[]
  enemyLetterRedundancy: number
  criticalSinglePointLetters: number[]
  armouredLetterCoverage: number
  refillPlanningImportance: number
  specialTileChoices: { ward: number; strike: number; regen?: number }
  specialTileDecisions: Record<'ward' | 'strike', SpecialTileDecision> & { regen?: SpecialTileDecision }
  notes: string[]
}

export type AnalysisOptions = {
  solver?: Partial<SolverOptions>
  solution?: SolverResult
  counterfactualSolver?: Partial<SolverOptions>
  wordCommonness?: (word: string) => number | null
  reasonableMovesPerState?: number
  reasonableScoreMargin?: number
  maxReasonableStates?: number
  maxReasonableMoves?: number
  maxReasonableSelections?: number
  maxFinalStates?: number
  maxFinalMoves?: number
  includeCounterfactuals?: boolean
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const average = (values: number[]): number | null => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
const known = (values: (number | null)[]): number[] => values.filter((value): value is number => value !== null)
const identity = (move: SolverMoveSummary) => `${move.word}:${move.tileIds.join(',')}`
const count = (text: string, letter: string) => [...text].filter(item => item === letter).length

/** Resolve plus remaining physical Ward tiles bounds all future submissions. */
export function reachableRefillUpperBound(state: LetterStrikeState): string {
  const wards = state.tiles.filter(tile => tile.type === 'gem' && tile.gem
    && state.encounter.tileEffects[tile.gem]?.preventResolveLoss).length
  return state.encounter.refillQueue.slice(state.refillIndex, state.refillIndex + (state.playerResolve + wards) * 16).toUpperCase()
}

/** A sound losing certificate; enough physical supply does NOT prove a win.
 * REGEN can only add obligations, so ignoring its future healing keeps this
 * necessary-condition bound optimistic; dead slots are never permanently pruned.
 */
export function hasImpossibleLetterSupply(state: LetterStrikeState): boolean {
  if (state.status === 'won') return false
  if (state.status === 'lost') return true
  const supply = state.tiles.map(tile => tile.letter).join('') + reachableRefillUpperBound(state)
  const needed = new Map<string, number>()
  for (const letter of state.enemyLetters) needed.set(letter.letter, (needed.get(letter.letter) ?? 0) + letter.hitsRemaining)
  return [...needed].some(([letter, hits]) => count(supply, letter) < hits)
}

export function counterfactualEncounter(encounter: LetterStrikeEncounter, mechanic: MechanicName): LetterStrikeEncounter {
  if (mechanic === 'semantic') return { ...encounter, enemy: { ...encounter.enemy, semanticRelations: { opposite: [], similar: [], related: [] } } }
  if (mechanic === 'grammar') return { ...encounter, grammarModifiers: {} }
  if (mechanic === 'armour') return { ...encounter, enemyLetters: encounter.enemyLetters.map(letter => ({ ...letter, initialHits: 1, hitsRemaining: 1 })) }
  return { ...encounter, tileEffects: Object.fromEntries(Object.entries(encounter.tileEffects).map(([name, effect]) => [name, {
    ...effect,
    ...(mechanic === 'ward' ? { preventResolveLoss: false }
      : mechanic === 'regen' ? effect.regenerate ? { regenerate: false } : {} : { strike: false }),
  }])) as LetterStrikeEncounter['tileEffects'] }
}

function mechanicPresent(encounter: LetterStrikeEncounter, mechanic: MechanicName): boolean {
  if (mechanic === 'semantic') return encounter.enemy.semanticRelations.opposite.length + encounter.enemy.semanticRelations.similar.length > 0
  if (mechanic === 'grammar') return Object.values(encounter.grammarModifiers ?? {}).some(value => value !== 0)
  if (mechanic === 'armour') return encounter.enemyLetters.some(letter => letter.initialHits > 1)
  return encounter.startingTiles.some(tile => tile.type === 'gem' && tile.gem
    && (mechanic === 'ward' ? encounter.tileEffects[tile.gem]?.preventResolveLoss
      : mechanic === 'regen' ? encounter.tileEffects[tile.gem]?.regenerate : encounter.tileEffects[tile.gem]?.strike))
}

function compareMechanic(encounter: LetterStrikeEncounter, baseline: SolverResult, mechanic: MechanicName, options: AnalysisOptions): MechanicComparison {
  const present = mechanicPresent(encounter, mechanic)
  const comparison: MechanicComparison = {
    mechanic, present, importance: present ? null : 0, evidence: present ? 'unknown' : 'absent',
    withoutStatus: 'not-run', withoutBestWinDepth: null, withoutResolveRemaining: null,
    withoutSearchComplete: false, replayedWinningLines: 0, changedWinningOutcomes: 0, changedStrikeCount: 0,
    ...(mechanic === 'regen' ? { changedRecoveryCount: 0 } : {}),
  }
  if (!present) return comparison
  const altered = counterfactualEncounter(encounter, mechanic)
  const impact: number[] = []
  const replayLines = encounter.lexicalRules ? selectDiverseWinningLines(baseline.winningLines, 6) : baseline.winningLines.slice(0, 6)
  for (const line of replayLines) {
    let state = createLetterStrikeGame(altered)
    let turns = 0
    for (const move of line.moves) {
      if (state.status !== 'playing') break
      state = submitLetterStrike(state, move.tileIds)
      turns++
    }
    const baselineStrikes = line.moves.reduce((sum, move) => sum + move.strikes, 0)
    const alteredStrikes = state.playedWords.reduce((sum, move) => sum + move.strikes, 0)
    const recoveryDifference = Math.abs(line.moves.reduce((sum, move) => sum + (move.recoveries?.length ?? 0), 0)
      - state.playedWords.reduce((sum, move) => sum + (move.preview.recoveries?.length ?? 0), 0))
    const outcomeChanged = state.status !== 'won' || turns !== line.turns || state.playerResolve !== line.resolveRemaining
    comparison.replayedWinningLines++
    comparison.changedWinningOutcomes += Number(outcomeChanged)
    comparison.changedStrikeCount += Math.abs(baselineStrikes - alteredStrikes)
    if (comparison.changedRecoveryCount !== undefined) comparison.changedRecoveryCount += recoveryDifference
    impact.push(Math.max(
      state.status !== 'won' ? 0.7 : 0,
      Math.abs(turns - line.turns) / Math.max(1, line.turns),
      Math.abs(state.playerResolve - line.resolveRemaining) / (encounter.startingResolve + 1),
      0.1 * Math.abs(baselineStrikes - alteredStrikes) / Math.max(1, baselineStrikes),
      0.1 * recoveryDifference / Math.max(1, baselineStrikes),
    ))
  }
  comparison.evidence = impact.length ? 'route-replay' : 'unknown'
  if (options.includeCounterfactuals ?? defaultAnalysisConfig.includeCounterfactuals) {
    const without = solvePuzzle(altered, {
      ...options.solver,
      wordCommonness: options.solver?.wordCommonness ?? (word => (options.wordCommonness ?? getWordCommonness)(word) ?? 0),
      maxStates: defaultAnalysisConfig.counterfactualMaxStates,
      beamWidth: defaultAnalysisConfig.counterfactualBeamWidth,
      ...options.counterfactualSolver,
    })
    comparison.withoutStatus = without.status
    comparison.withoutBestWinDepth = without.bestWinDepth
    comparison.withoutResolveRemaining = without.maximumResolveRemaining
    comparison.withoutSearchComplete = without.exhaustive
    if (impact.length) comparison.evidence = 'route-replay-and-bounded-search'
    if (baseline.solvable === true && without.solvable === false) impact.push(1)
    if (baseline.bestWinDepth !== null && without.bestWinDepth !== null) {
      impact.push(clamp(Math.abs(without.bestWinDepth - baseline.bestWinDepth) / Math.max(1, baseline.bestWinDepth)))
    }
  }
  comparison.importance = average(impact)
  return comparison
}

function reasonableMoves(moves: SolverMoveSummary[], options: AnalysisOptions): SolverMoveSummary[] {
  const useful = moves.filter(move => move.strikes > 0 || move.wardUsed)
  if (!useful.length) return []
  const familiarity = (word: string) => (options.wordCommonness ?? getWordCommonness)(word) ?? 0
  const scores = useful.map(move => scoreImmediateMove(move, familiarity))
  const best = Math.max(...scores)
  const margin = options.reasonableScoreMargin ?? defaultAnalysisConfig.reasonableScoreMargin
  return useful.filter((_, index) => scores[index] >= best - margin)
    .sort((a, b) => scoreImmediateMove(b, familiarity) - scoreImmediateMove(a, familiarity) || identity(a).localeCompare(identity(b)))
}

function diverseReasonableMoves(moves: SolverMoveSummary[], options: AnalysisOptions): SolverMoveSummary[] {
  const ordered = reasonableMoves(moves, options)
  const limit = options.reasonableMovesPerState ?? defaultAnalysisConfig.reasonableMovesPerState
  const firstWords = new Set<string>()
  const distinct = ordered.filter(move => {
    if (firstWords.has(move.word)) return false
    firstWords.add(move.word)
    return true
  })
  return [...distinct, ...ordered.filter(move => !distinct.includes(move))].slice(0, limit)
}

/** Analyses witnessed wins and sampled reasonable states; limits stay visible. */
export function analysePuzzle(input: CandidatePuzzle | LetterStrikeEncounter, options: AnalysisOptions = {}): PuzzleAnalysis {
  const encounter = 'encounter' in input ? input.encounter : input
  const initial = createLetterStrikeGame(encounter)
  const commonness = options.wordCommonness ?? getWordCommonness
  const lexicalAudit = encounter.lexicalRules ? auditEncounterLexicon(encounter) : undefined
  const solution = options.solution ?? solvePuzzle(encounter, { ...options.solver,
    wordCommonness: options.solver?.wordCommonness ?? (word => commonness(word) ?? 0) })
  // Analysis augments a private graph so callers may safely reuse solver output.
  const records = new Map(solution.states.map(record => [record.key, { ...record,
    moves: [...record.moves], successorKeys: [...record.successorKeys] }]))
  const ruleKey = encounterRuleKey(encounter)
  const sampledDiscoveries = new Map<string, MoveDiscovery>()
  const root = solution.states.find(record => record.depth === 0)
  const reasonableRoot = reasonableMoves(solution.rootMoves, options)
  const visited = new Set<string>()
  const queue = root ? [{ key: root.key, prefix: [] as SolverMoveSummary[] }] : []
  const sampledDepthCounts: Record<string, number> = {}
  let provenDead = 0, provenWinning = 0, unknown = 0, reasonableStates = 0
  let terminalStates = 0, deadTerminalStates = 0, finalCount = 0, finalRescued = 0, finalNoRescue = 0, finalUnknown = 0
  const earlyReasonableKeys: string[] = []
  const clutchLines: ClutchLine[] = []
  const remainingCoverage: number[] = []
  const maxStates = options.maxReasonableStates ?? defaultAnalysisConfig.maxReasonableStates
  const maxFinal = options.maxFinalStates ?? defaultAnalysisConfig.maxFinalStates
  while (queue.length && visited.size < maxStates) {
    // Pure breadth-first sampling can spend its entire budget before the last
    // Resolve (especially after a free Ward turn). Alternate oldest and deepest
    // pending positions: retain opening diversity and give late play a sample.
    let queueIndex = 0
    if (visited.size % 2 === 1) {
      for (let index = 1; index < queue.length; index++) {
        if (queue[index].prefix.length > queue[queueIndex].prefix.length) queueIndex = index
      }
    }
    const item = queue.splice(queueIndex, 1)[0]
    if (visited.has(item.key)) continue
    visited.add(item.key)
    const record = records.get(item.key)
    if (!record) continue
    sampledDepthCounts[item.prefix.length] = (sampledDepthCounts[item.prefix.length] ?? 0) + 1
    const state = record.state
    if (state.status !== 'playing') {
      terminalStates++
      deadTerminalStates += Number(state.status === 'lost')
      continue
    }
    if (!record.expanded) {
      const discovery = discoverValidMoves(state, { ...options.solver,
        maxMoves: options.maxReasonableMoves ?? defaultAnalysisConfig.maxReasonableMoves,
        maxSelections: options.maxReasonableSelections ?? defaultAnalysisConfig.maxReasonableSelections,
        wordCommonness: options.solver?.wordCommonness ?? (word => commonness(word) ?? 0) })
      sampledDiscoveries.set(item.key, discovery)
      record.moves = discovery.moves.map(moveSummary)
      record.successorKeys = discovery.moves.map(move => stateKey(move.resultingState, ruleKey))
      record.expanded = true
      record.movesComplete = discovery.complete && discovery.vocabularyComplete
      if (discovery.moves.some(move => move.resultingState.status === 'won')) record.canWin = true
      else if (record.movesComplete && discovery.moves.every(move => move.resultingState.status === 'lost')) record.canWin = false
    }
    const alive = state.enemyLetters.filter(letter => letter.hitsRemaining > 0)
    remainingCoverage.push(alive.filter(letter => state.tiles.some(tile => tile.letter === letter.letter)).length / Math.max(1, alive.length))
    if (state.playerResolve > 1 && item.prefix.length > 0) {
      earlyReasonableKeys.push(item.key)
    }
    if (state.playerResolve === 1 && finalCount < maxFinal) {
      finalCount++
      const cached = sampledDiscoveries.get(item.key)
      const discovery = cached?.complete ? cached : discoverValidMoves(state, { ...options.solver,
        maxMoves: options.maxFinalMoves ?? defaultAnalysisConfig.maxFinalMoves,
        maxSelections: options.maxReasonableSelections ?? defaultAnalysisConfig.maxReasonableSelections,
        wordCommonness: options.solver?.wordCommonness ?? (word => commonness(word) ?? 0) })
      const winning = discovery.moves.filter(move => move.resultingState.status === 'won').map(moveSummary)
      if (winning.length) {
        record.canWin = true
        finalRescued++
        const familiarities = known(winning.map(move => commonness(move.word)))
        const meanFamiliarity = average(familiarities)
        const wordLength = Math.max(...winning.map(move => move.word.length))
        const difficulty = meanFamiliarity === null ? null : clamp((1 - meanFamiliarity) * 0.65 + Math.max(0, wordLength - 3) / 13 * 0.35)
        clutchLines.push({ stateKey: `sample-${clutchLines.length}`, remainingLetters: alive.map(letter => letter.letter).join(''), prefix: item.prefix,
          winningMoves: winning.slice(0, 8), commonness: meanFamiliarity, wordLength, difficulty,
          discoveryComplete: discovery.complete && discovery.vocabularyComplete })
      } else if ((discovery.complete && discovery.vocabularyComplete) || hasImpossibleLetterSupply(state)) finalNoRescue++
      else finalUnknown++
    }
    const choices = diverseReasonableMoves(record.moves, options)
    for (const move of choices) {
      const index = record.moves.indexOf(move)
      const key = record.successorKeys[index]
      if (key) {
        // Beam pruning must not silently remove reasonable losing/unknown states
        // from the fairness denominator. Replay the edge and sample that state.
        if (!records.has(key)) {
          const successor = submitLetterStrike(state, move.tileIds)
          records.set(key, { key, state: successor, depth: record.depth + 1, moves: [], successorKeys: [], expanded: false,
            movesComplete: false, canWin: successor.status === 'won' ? true : successor.status === 'lost' ? false : null })
        }
        queue.push({ key, prefix: [...item.prefix, move] })
      }
    }
  }
  // New sampled winning continuations also prove their reachable ancestors.
  // A missing child or a bounded move list can never prove a dead state.
  for (const record of [...records.values()].sort((a, b) => b.state.refillIndex - a.state.refillIndex)) {
    if (record.state.status !== 'playing') continue
    if (hasImpossibleLetterSupply(record.state)) record.canWin = false
    const children = record.successorKeys.map(key => records.get(key)?.canWin ?? null)
    if (children.some(value => value === true)) record.canWin = true
    else if (record.expanded && record.movesComplete && children.every(value => value === false)) record.canWin = false
  }
  for (const key of earlyReasonableKeys) {
    reasonableStates++
    const record = records.get(key)!
    if (record.canWin === false) provenDead++
    else if (record.canWin === true) provenWinning++
    else unknown++
  }
  // Search witnesses are also valid routes to final Resolve, even if a beam
  // omitted one of their prefixes from the reasonable-state traversal.
  for (const line of solution.winningLines) {
    if (clutchLines.length >= maxFinal) break
    let state = initial
    const prefix: SolverMoveSummary[] = []
    for (const move of line.moves) {
      if (clutchLines.length >= maxFinal) break
      if (state.playerResolve === 1 && !clutchLines.some(clutch => clutch.prefix.map(identity).join('|') === prefix.map(identity).join('|'))) {
        const next = submitLetterStrike(state, move.tileIds)
        if (next.status === 'won') {
          const familiarity = commonness(move.word)
          clutchLines.push({ stateKey: `witness:${prefix.map(identity).join('|')}`, remainingLetters: state.enemyLetters.filter(letter => letter.hitsRemaining > 0).map(letter => letter.letter).join(''),
            prefix: [...prefix], winningMoves: [move], commonness: familiarity, wordLength: move.word.length,
            difficulty: familiarity === null ? null : clamp((1 - familiarity) * 0.65 + Math.max(0, move.word.length - 3) / 13 * 0.35), discoveryComplete: false })
        }
      }
      state = submitLetterStrike(state, move.tileIds)
      prefix.push(move)
    }
  }

  const allMoves = [...records.values()].flatMap(record => record.moves)
  const supplyQueue = reachableRefillUpperBound(initial)
  const letterOpportunityCounts = initial.enemyLetters.map((letter, position): LetterOpportunity => {
    const hitting = allMoves.filter(move => move.hits.some(hit => hit.enemyLetterId === letter.id))
    const boardCopies = initial.tiles.filter(tile => tile.letter === letter.letter).length
    const queueCopies = count(supplyQueue, letter.letter)
    return { position, letter: letter.letter, requiredHits: letter.hitsRemaining, currentBoardCopies: boardCopies,
      reachableRefillCopies: queueCopies, physicalSupplyUpperBound: boardCopies + queueCopies,
      observedMatchingMoves: new Set(hitting.map(move => move.word)).size,
      observedCategories: [...new Set(hitting.map(move => move.semanticLabel))].sort(),
      observedStrikeExceptions: new Set(hitting.filter(move => move.strikeUsed && move.semanticLabel === 'RESISTED').map(move => move.word)).size }
  })
  const requiredByLetter = new Map<string, number>()
  initial.enemyLetters.forEach(letter => requiredByLetter.set(letter.letter, (requiredByLetter.get(letter.letter) ?? 0) + letter.initialHits))
  const criticalSinglePointLetters = letterOpportunityCounts.filter(letter => letter.physicalSupplyUpperBound <= (requiredByLetter.get(letter.letter) ?? 1)).map(letter => letter.position)
  const armored = letterOpportunityCounts.filter(letter => letter.requiredHits > 1)
  const winningMoves = solution.winningLines.flatMap(line => line.moves)
  const familiarityValues = winningMoves.map(move => commonness(move.word))
  const lineFamiliarity = solution.winningLines.map(line => {
    const values = line.moves.map(move => commonness(move.word))
    return values.some(value => value === null) ? null : Math.min(...values as number[])
  })
  const knownLineFamiliarity = known(lineFamiliarity)
  const bestLineFamiliarity = knownLineFamiliarity.length ? Math.max(...knownLineFamiliarity) : null
  const hasRegen = mechanicPresent(encounter, 'regen')
  const mechanics: MechanicName[] = ['semantic', 'ward', 'strike', 'grammar', 'armour', ...(hasRegen ? ['regen' as const] : [])]
  const counterfactuals = mechanics.map(mechanic => compareMechanic(encounter, solution, mechanic, options))
  const importance = (mechanic: MechanicName) => counterfactuals.find(item => item.mechanic === mechanic)!.importance
  const bestLine = [...solution.winningLines].sort((a, b) => a.turns - b.turns || b.resolveRemaining - a.resolveRemaining)[0]
  const strongest = [...solution.rootMoves].sort((a, b) => scoreImmediateMove(b) - scoreImmediateMove(a))[0]
  const winningOpenings = new Set(solution.winningLines.map(line => identity(line.moves[0])).filter(Boolean))
  const strongestIsWitnessed = strongest ? winningOpenings.has(identity(strongest)) : false
  const strongestIndex = strongest && root ? root.moves.findIndex(move => identity(move) === identity(strongest)) : -1
  const strongestRecord = root && strongestIndex >= 0 ? records.get(root.successorKeys[strongestIndex]) : undefined
  const strongestOptimal = !strongest || !bestLine ? null : strongestIsWitnessed
    ? solution.minimumTurnsProven && solution.winningLines.some(line => line.turns === solution.minimumTurnsToWin
      && identity(line.moves[0]) === identity(strongest)) ? true : null
    : strongestRecord?.canWin === false ? false : null
  const strategicOpening = bestLine?.moves[0] ?? null
  const strategies = new Set(solution.winningLines.map(line => encounter.lexicalRules || options.solver?.hintLines !== undefined
    ? winningStrategySignature(line.moves)
    : `${line.moves[0]?.word}|${line.moves.map(move => move.semanticLabel).join(',')}|ward:${line.moves.findIndex(move => move.wardUsed)}|strike:${line.moves.findIndex(move => move.strikeUsed)}`))
  const expanded = [...records.values()].filter(record => record.expanded)
  const assessed = provenDead + provenWinning
  function specialDecision(mechanic: 'ward' | 'strike' | 'regen'): SpecialTileDecision {
    const specialIds = initial.tiles.filter(tile => tile.type === 'gem' && tile.gem
      && (mechanic === 'ward' ? encounter.tileEffects[tile.gem]?.preventResolveLoss
        : mechanic === 'regen' ? encounter.tileEffects[tile.gem]?.regenerate : encounter.tileEffects[tile.gem]?.strike))
      .map(tile => tile.id)
    const consumes = (move: SolverMoveSummary) => specialIds.some(id => move.tileIds.includes(id))
    const using = (moves: SolverMoveSummary[]) => new Set(moves.filter(consumes).map(move => move.word)).size
    const preserving = (moves: SolverMoveSummary[]) => new Set(moves.filter(move => !consumes(move)).map(move => move.word)).size
    const usingReasonable = using(reasonableRoot)
    const preservingReasonable = preserving(reasonableRoot)
    const complete = root?.movesComplete === true && solution.vocabularyComplete
    const turns = solution.winningLines.flatMap(line => line.moves.flatMap((move, index) => consumes(move) ? [index + 1] : []))
    return { openingWordsUsing: using(solution.rootMoves), openingWordsPreserving: preserving(solution.rootMoves),
      reasonableOpeningWordsUsing: usingReasonable, reasonableOpeningWordsPreserving: preservingReasonable,
      winningUseTurns: [...new Set(turns)].sort((a, b) => a - b),
      mandatoryInObservedWins: solution.winningLines.length ? solution.winningLines.every(line => line.moves.some(consumes)) : null,
      automaticInReasonableOpenings: !specialIds.length || !usingReasonable ? null
        : preservingReasonable > 0 ? false : complete ? true : null,
      openingDiscoveryComplete: complete }
  }
  const notes = [
    'Winning-line counts and viable openings are lower bounds from retained witnesses; they are not exhaustive path counts.',
    'Reasonable play samples useful moves within an immediate-score margin, taking a fixed number per state; fairness is conditional on this sample.',
    'The fixed fairness state budget alternates breadth and deepest pending positions, preserving early opening diversity while sampling late Resolve; this is not an unbiased random-player distribution.',
    'Unknown bounded-search states are not counted as dead or safe. Fairness rates exclude unknown states and report an uncertainty interval.',
    'Letter supply is an optimistic physical upper bound. Observed word opportunities are lower bounds and do not guarantee future accessibility.',
    'Commonness is a local curated familiarity estimate; missing annotations remain unknown. Required vocabulary describes the best observed winning line.',
    'Counterfactual replays are exact for the same tile-ID sequence; separate bounded searches compare witnessed solutions and cannot prove decorative mechanics unless exhaustive.',
    'The strategic opening is from the best observed line. Immediate-move optimality is reported only when proved, using physical tile identities and minimum-turn wins.',
    'Special preservation means retaining its physical tile, including an untriggered Strike tile. Automatic-opening claims require complete dictionary and tile-ID discovery within the reasonable-play definition.',
    'Clutch lines may include additional exact winning witnesses outside the reasonable-state sample; those witnesses do not inflate the sampled final-turn rescue rate.',
  ]
  if (solution.searchLimitReached) notes.push(`Solver limits: ${solution.cutoffReasons.join(', ')}.`)
  if (hasRegen) notes.push('REGEN recovery is resolved after damage in every searched state. Its importance measures observed route changes; avoiding the harmful tile can itself be a valid strategy.')
  if (encounter.lexicalRules) notes.push('Winning witnesses retain distinct opening, semantic-pattern and special-timing strategies. Counterfactuals replay the same diverse sample of at most six prefixes and finishes for every mechanic; final-word variants do not crowd out distinct strategies.')
  if (finalUnknown) notes.push(`${finalUnknown} sampled final-Resolve states have unknown one-move rescue status.`)
  return {
    ...(lexicalAudit ? { lexicalAudit } : {}),
    ...(encounter.finiteRefills ? { refillPressure: analyseRefillPressure(encounter, solution.winningLines) } : {}),
    solvable: solution.solvable === null && hasImpossibleLetterSupply(initial) ? false : solution.solvable, minimumTurnsToWin: solution.minimumTurnsToWin,
    minimumTurnsProven: solution.minimumTurnsToWin !== null,
    bestWinDepth: solution.bestWinDepth, maximumResolveRemaining: solution.maximumResolveRemaining,
    maximumResolveProven: solution.maximumResolveProven,
    winningLinesFound: solution.winningLines.length,
    winningLines: solution.winningLines.map((line: WinningLine) => ({ moves: line.moves, turns: line.turns, resolveRemaining: line.resolveRemaining })),
    viableOpeningMoves: winningOpenings.size,
    reasonableOpeningMoves: new Set(reasonableRoot.map(move => move.word)).size,
    branchingFactor: average(expanded.map(record => new Set(record.moves.map(move => move.word)).size)) ?? 0,
    branchingFactorIsLowerBound: expanded.some(record => !record.movesComplete),
    deadEndRate: terminalStates ? deadTerminalStates / terminalStates : null,
    prematureDeadStateRate: assessed ? provenDead / assessed : null,
    penultimateRescueRate: finalRescued + finalNoRescue ? finalRescued / (finalRescued + finalNoRescue) : null,
    remainingLetterCoverage: average(remainingCoverage) ?? 0,
    reachableWinDepth: solution.bestWinDepth,
    clutchOpportunityCount: clutchLines.length, clutchLines,
    clutchWordCommonness: average(known(clutchLines.map(line => line.commonness))),
    clutchWordLength: average(clutchLines.map(line => line.wordLength)),
    clutchWordDifficulty: average(known(clutchLines.map(line => line.difficulty))),
    clutchWinningMoves: clutchLines.reduce((sum, line) => sum + line.winningMoves.length, 0),
    fairness: { reasonableStates, provenDeadStates: provenDead, provenWinningStates: provenWinning, unknownStates: unknown,
      assessedFraction: reasonableStates ? assessed / reasonableStates : 0,
      prematureDeadStateRateLowerBound: reasonableStates ? provenDead / reasonableStates : null,
      prematureDeadStateRateUpperBound: reasonableStates ? (provenDead + unknown) / reasonableStates : null,
      finalResolveStates: finalCount, rescuedFinalStates: finalRescued, finalStatesWithoutRescue: finalNoRescue, finalStatesUnknown: finalUnknown,
      scope: 'bounded-reasonable-state-sample', samplingSchedule: 'alternating-breadth-and-depth', sampledDepthCounts },
    statesExplored: solution.statesExplored + sampledDiscoveries.size, searchLimitReached: solution.searchLimitReached,
    searchComplete: solution.exhaustive, vocabularyComplete: solution.vocabularyComplete,
    counterMoveUsage: winningMoves.filter(move => move.semanticLabel === 'COUNTER').length / Math.max(1, winningMoves.length),
    neutralMoveUsage: winningMoves.filter(move => move.semanticLabel === 'NEUTRAL').length / Math.max(1, winningMoves.length),
    resistedMoveUsage: winningMoves.filter(move => move.semanticLabel === 'RESISTED').length / Math.max(1, winningMoves.length),
    semanticMechanicImportance: importance('semantic'), wardImportance: importance('ward'), strikeImportance: importance('strike'),
    ...(hasRegen ? { regenImportance: importance('regen') } : {}),
    armourImportance: importance('armour'), grammarImportance: importance('grammar'), counterfactuals,
    resistedBaitQuality: clamp(solution.rootMoves.filter(move => move.semanticLabel === 'RESISTED' && move.word.length >= 4).length / 3)
      * (solution.rootMoves.some(move => move.semanticLabel === 'COUNTER') ? 1 : 0.25),
    strongestImmediateMove: strongest?.word ?? null, optimalStrategicMove: strategicOpening?.word ?? null,
    isStrongestImmediateOptimal: strongestOptimal,
    greedyTrapStrength: strongestOptimal === false ? 1 : strongest && strategicOpening && strongest.word !== strategicOpening.word ? 0.25 : 0,
    numberOfDistinctWinningStrategies: strategies.size,
    winningWordCommonness: average(known(familiarityValues)),
    winningVocabularyCoverage: familiarityValues.length ? known(familiarityValues).length / familiarityValues.length : 0,
    requiredObscureWordScore: bestLineFamiliarity === null ? null : 1 - bestLineFamiliarity,
    requiredVocabularyEvidence: 'best-observed-winning-line',
    letterOpportunityCounts,
    enemyLetterRedundancy: average(letterOpportunityCounts.map(letter => clamp((letter.observedMatchingMoves - 1) / 4))) ?? 0,
    criticalSinglePointLetters,
    armouredLetterCoverage: armored.length ? armored.filter(letter => letter.observedMatchingMoves >= 2).length / armored.length : 1,
    refillPlanningImportance: winningMoves.length ? winningMoves.filter(move => move.tileIds.some(id => id >= initial.nextTileId)).length / winningMoves.length : 0,
    specialTileChoices: {
      ward: new Set(solution.rootMoves.filter(move => move.wardUsed).map(move => move.word)).size,
      strike: new Set(solution.rootMoves.filter(move => move.strikeUsed).map(move => move.word)).size,
      ...(hasRegen ? { regen: new Set(solution.rootMoves.filter(move => move.regenUsed).map(move => move.word)).size } : {}),
    },
    specialTileDecisions: { ward: specialDecision('ward'), strike: specialDecision('strike'),
      ...(hasRegen ? { regen: specialDecision('regen') } : {}),
    },
    notes,
  }
}
