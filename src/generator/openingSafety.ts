import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import { normalizeWord } from '../game/dictionary.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import { getEncounterPartsOfSpeech } from '../game/lexicalRules.ts'
import { hasImpossibleLetterSupply } from './analyse.ts'
import { discoverValidMoves, moveSummary } from './findMoves.ts'
import type { SolverMoveSummary } from './findMoves.ts'
import { getWordCommonness, localLexicalProvider } from './lexicalProvider.ts'
import { solvePuzzle } from './solve.ts'
import type { SolverOptions, SolverResult } from './solve.ts'
import { stateKey } from './stateKey.ts'
import { sha256 } from './sha256.ts'
import type { CandidatePuzzle } from './types.ts'

export type OpeningSafetyScope = 'all-damaging-openings' | 'all-valid-openings'
export type OpeningSafetyResult = {
  successorKey: string
  openings: { word: string; tileIds: number[] }[]
  status: 'safe' | 'unsafe' | 'unknown'
  evidence: 'winning-witness' | 'opening-victory' | 'terminal-loss' | 'impossible-letter-supply'
    | 'exhaustive-continuation-search' | 'bounded-search' | 'not-searched'
  continuation: SolverMoveSummary[] | null
  resolveRemaining: number | null
  solverStatesExplored: number
  attempts: number
  cutoffReasons: string[]
}
export type OpeningSafetyReport = {
  schemaVersion: 1
  encounterId: string
  /** Exact serialized content binds the certificate to its immutable rules and board. */
  encounterKey: string
  dictionaryFingerprint: string
  scope: OpeningSafetyScope
  openingVocabulary: { scope: 'full-dictionary' | 'restricted-spellings'; words: string[] | null }
  familiarity: { required: boolean; minimum: number; source: string; appliesTo: 'continuation-words' }
  searchBudget: {
    maxSuccessors: number
    maxDurationMs: number
    solver: Omit<SolverOptions, 'vocabulary' | 'wordCommonness' | 'hintLine'>
  }
  enumeration: {
    completePhysicalSelections: boolean
    vocabularyComplete: boolean
    validSelections: number
    excludedSelections: number
    requiredSelections: number
    distinctSuccessors: number
  }
  safeSelections: number
  unsafeSelections: number
  unknownSelections: number
  safeSuccessors: number
  unsafeSuccessors: number
  unknownSuccessors: number
  /** Certification applies only to the declared opening spelling scope. */
  certified: boolean
  status: 'certified' | 'failed' | 'incomplete'
  results: OpeningSafetyResult[]
  work: {
    invocationSuccessorsSearched: number
    cumulativeSolverStatesExplored: number
    reusedWitnesses: number
    elapsedMs: number
    stoppedBy: 'complete' | 'successor-budget' | 'time-budget' | 'unsafe-opening'
  }
  notes: string[]
}
export type OpeningSafetyOptions = {
  scope?: OpeningSafetyScope
  /** Omit to enumerate the full dictionary; restrictions remain explicit in the certificate. */
  openingVocabulary?: readonly string[]
  requireFamiliarContinuation?: boolean
  minimumCommonness?: number
  wordCommonness?: (word: string) => number | null
  /** Required when supplying a custom commonness function, for checkpoint provenance. */
  commonnessSource?: string
  familiarVocabulary?: readonly string[]
  /** Hints from other searches/scopes: spellings are replayed with actual current tile choices. */
  witnessLines?: readonly (readonly Pick<SolverMoveSummary, 'word'>[])[]
  maxSuccessors?: number
  maxDurationMs?: number
  solver?: Omit<SolverOptions, 'vocabulary' | 'wordCommonness' | 'hintLine'>
  stopOnUnsafe?: boolean
  resume?: OpeningSafetyReport
  checkpointEvery?: number
  onCheckpoint?: (report: OpeningSafetyReport) => void
}

let dictionaryFingerprint: string | undefined
function currentDictionaryFingerprint(): string {
  if (!dictionaryFingerprint) {
    let hash = 0x811c9dc5
    for (const word of englishWords) {
      for (const letter of `${word}\n`) hash = Math.imul(hash ^ letter.charCodeAt(0), 0x01000193) >>> 0
    }
    dictionaryFingerprint = `fnv1a32:${hash.toString(16).padStart(8, '0')}`
  }
  return dictionaryFingerprint
}
const positionKey = (state: LetterStrikeState) => stateKey(state, '')
// Definitions belong in the published encounter once, not duplicated in every
// checkpoint. Keep archived certificate keys byte-for-byte compatible.
const certificateEncounterKey = (encounter: LetterStrikeEncounter) => encounter.meaningLexicon
  ? `sha256:${sha256(JSON.stringify(encounter))}` : JSON.stringify(encounter)
const normalizedVocabulary = (words: readonly string[]) => [...new Set(words.map(normalizeWord))].sort()

function summarizedMove(before: LetterStrikeState, after: LetterStrikeState, tileIds: readonly number[]): SolverMoveSummary {
  const preview = after.playedWords.at(-1)!.preview
  // Reuse discovery's canonical summary format without a second move search.
  return moveSummary({ word: preview.word, tileIds: [...tileIds], semanticLabel: preview.semanticLabel,
    partsOfSpeech: getEncounterPartsOfSpeech(before.encounter, preview.word) ?? [],
    grammarModifier: preview.grammaticalModifier, longWordModifier: preview.longWordModifier,
    wardUsed: preview.resolveCost === 0, strikeUsed: preview.effectLabels.includes('STRIKE'),
    ...(preview.effectLabels.includes('REGEN') ? { regenUsed: true as const, recoveries: preview.recoveries ?? [] } : {}),
    strikes: preview.strikes, resolveCost: before.playerResolve - after.playerResolve,
    hits: preview.hits, letterOutcomes: preview.letterOutcomes, resultingState: after,
  })
}

function replayWitness(initial: LetterStrikeState, moves: readonly Pick<SolverMoveSummary, 'word' | 'tileIds'>[], familiar: (word: string) => boolean): {
  moves: SolverMoveSummary[]; resolve: number
} | null {
  let state = initial
  const replayed: SolverMoveSummary[] = []
  for (const move of moves) {
    if (state.status !== 'playing' || !familiar(move.word)) return null
    const next = submitLetterStrike(state, move.tileIds)
    if (next.playedWords.length !== state.playedWords.length + 1 || next.playedWords.at(-1)!.word !== move.word) return null
    replayed.push(summarizedMove(state, next, move.tileIds))
    state = next
  }
  return state.status === 'won' ? { moves: replayed, resolve: state.playerResolve } : null
}

/** Reuses spellings only after finding and executing real tile selections. */
function replayWordRoute(initial: LetterStrikeState, words: readonly string[], familiar: (word: string) => boolean): {
  moves: SolverMoveSummary[]; resolve: number
} | null {
  let explored = 0
  const visited = new Set<string>()
  function visit(state: LetterStrikeState, index: number, moves: SolverMoveSummary[]): { moves: SolverMoveSummary[]; resolve: number } | null {
    if (state.status === 'won') return { moves, resolve: state.playerResolve }
    if (state.status !== 'playing' || index >= words.length || explored >= 32 || !familiar(words[index])) return null
    const key = `${index}:${positionKey(state)}`
    if (visited.has(key)) return null
    visited.add(key)
    explored++
    const discovery = discoverValidMoves(state, { vocabulary: [words[index]], maxMoves: 64, maxSelections: 256 })
    for (const move of discovery.moves) {
      const result = visit(move.resultingState, index + 1, [...moves, moveSummary(move)])
      if (result) return result
    }
    return null
  }
  return visit(initial, 0, [])
}

function refreshTotals(report: OpeningSafetyReport): void {
  for (const status of ['safe', 'unsafe', 'unknown'] as const) {
    const results = report.results.filter(result => result.status === status)
    report[`${status}Successors`] = results.length
    report[`${status}Selections`] = results.reduce((sum, result) => sum + result.openings.length, 0)
  }
  report.certified = report.enumeration.completePhysicalSelections && report.enumeration.requiredSelections > 0
    && report.unsafeSuccessors === 0 && report.unknownSuccessors === 0
  report.status = report.certified ? 'certified' : report.unsafeSuccessors > 0 ? 'failed' : 'incomplete'
  report.work.cumulativeSolverStatesExplored = report.results.reduce((sum, result) => sum + result.solverStatesExplored, 0)
}

/** A current, non-vacuous certificate with no unknown or unsafe required opening. */
export function isOpeningSafetyCertificateCurrent(encounter: LetterStrikeEncounter, report: OpeningSafetyReport): boolean {
  if (!report || report.schemaVersion !== 1 || report.encounterId !== encounter.id
    || report.encounterKey !== certificateEncounterKey(encounter) || report.dictionaryFingerprint !== currentDictionaryFingerprint()
    || !report.enumeration?.completePhysicalSelections || !Array.isArray(report.results)) return false
  const required = report.results.reduce((sum, result) => sum + result.openings.length, 0)
  return report.certified === true && report.status === 'certified' && required > 0
    && report.enumeration.requiredSelections === required && report.enumeration.distinctSuccessors === report.results.length
    && report.safeSelections === required && report.unsafeSelections === 0 && report.unknownSelections === 0
    && report.results.every(result => result.status === 'safe' && result.continuation !== null)
    && report.familiarity?.appliesTo === 'continuation-words'
}

/**
 * The root is fully enumerated with every physical special-tile choice. Work
 * budgets apply only to continuation searches; budget exhaustion stays unknown.
 * A restricted opening vocabulary can certify that declared subset, never all
 * dictionary words. An unsafe result requires a real terminal or losing proof.
 */
export function certifyOpeningSafety(input: CandidatePuzzle | LetterStrikeEncounter, options: OpeningSafetyOptions = {}): OpeningSafetyReport {
  const encounter = 'encounter' in input ? input.encounter : input
  const initial = createLetterStrikeGame(encounter)
  const started = performance.now()
  const scope = options.scope ?? 'all-damaging-openings'
  const minimum = options.minimumCommonness ?? 0.5
  const requiredFamiliar = options.requireFamiliarContinuation ?? true
  if (options.wordCommonness && !options.commonnessSource) throw new Error('Custom commonness needs a stable commonnessSource for certificate provenance.')
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) throw new Error('Commonness threshold must be between zero and one.')
  const commonness = options.wordCommonness ?? getWordCommonness
  const source = options.commonnessSource ?? localLexicalProvider.id
  const familiar = (word: string) => !requiredFamiliar || (commonness(word) ?? -1) >= minimum
  const familiarVocabulary = normalizedVocabulary(options.familiarVocabulary ?? localLexicalProvider.vocabulary().map(entry => entry.word))
    .filter(word => (commonness(word) ?? -1) >= minimum)
  const openingVocabulary = options.openingVocabulary ? normalizedVocabulary(options.openingVocabulary) : undefined
  const searchBudget = {
    maxSuccessors: Math.max(0, options.maxSuccessors ?? 100),
    maxDurationMs: Math.max(0, options.maxDurationMs ?? 30_000),
    solver: { strategy: 'beam' as const, maxStates: 100, beamWidth: 12,
      maxMovesPerState: 64, maxSelectionsPerState: 800, maxWinningLines: 12, ...options.solver },
  }
  const root = discoverValidMoves(initial, { ...(openingVocabulary ? { vocabulary: openingVocabulary } : {}) })
  const grouped = new Map<string, { state: LetterStrikeState; openings: OpeningSafetyResult['openings'] }>()
  let excluded = 0
  for (const move of root.moves) {
    if (scope === 'all-damaging-openings' && move.hits.length === 0) { excluded++; continue }
    const key = positionKey(move.resultingState)
    const group = grouped.get(key) ?? { state: move.resultingState, openings: [] }
    group.openings.push({ word: move.word, tileIds: [...move.tileIds] })
    grouped.set(key, group)
  }
  const report: OpeningSafetyReport = {
    schemaVersion: 1, encounterId: encounter.id, encounterKey: certificateEncounterKey(encounter),
    dictionaryFingerprint: currentDictionaryFingerprint(), scope,
    openingVocabulary: { scope: openingVocabulary ? 'restricted-spellings' : 'full-dictionary', words: openingVocabulary ?? null },
    familiarity: { required: requiredFamiliar, minimum, source, appliesTo: 'continuation-words' },
    searchBudget,
    enumeration: { completePhysicalSelections: root.complete, vocabularyComplete: root.vocabularyComplete,
      validSelections: root.moves.length, excludedSelections: excluded, requiredSelections: root.moves.length - excluded,
      distinctSuccessors: grouped.size },
    safeSelections: 0, unsafeSelections: 0, unknownSelections: 0,
    safeSuccessors: 0, unsafeSuccessors: 0, unknownSuccessors: 0,
    certified: false, status: 'incomplete',
    results: [...grouped].map(([successorKey, group]) => ({ successorKey, openings: group.openings,
      status: 'unknown', evidence: 'not-searched', continuation: null, resolveRemaining: null,
      solverStatesExplored: 0, attempts: 0, cutoffReasons: [] })),
    work: { invocationSuccessorsSearched: 0, cumulativeSolverStatesExplored: 0, reusedWitnesses: 0,
      elapsedMs: 0, stoppedBy: 'complete' },
    notes: [
      'Every nonequivalent physical opening selection in the declared spelling scope is enumerated, including different choices and orders of special tiles. Permuting identical normal or same-gem copies within the same selected set shares its identical transition. Equivalent successor states share continuation work.',
      'Damaging means at least one actual strike hit. A damaging REGEN move remains included even when its later recovery cancels or exceeds the damage.',
      'Safe requires an exact engine-replayed winning continuation. Familiarity, when required, applies to every continuation word; the player-selected opening is excluded from that requirement.',
      'Unsafe requires terminal loss, an optimistic physical-letter-supply impossibility certificate, or a complete unrestricted losing search. An unfinished search remains unknown.',
      'Restricted spelling lists do not certify other dictionary openings. No zero-damage opening guarantee is implied by the damaging-only scope.',
      'The time budget is cooperative between continuation searches. Initial opening enumeration is complete and unbudgeted; a running solver call may overrun the requested duration.',
      'Checkpoints replay safe witnesses before reusing them. Unreplayable or incomplete work is searched again; prior exhaustive loss claims are not trusted without fresh proof.',
    ],
  }
  const routeCache = new Map<string, string[]>()
  const remember = (moves: readonly Pick<SolverMoveSummary, 'word'>[]) => {
    for (let index = 0; index < moves.length; index++) {
      const words = moves.slice(index).map(move => move.word)
      const key = words.join(' ')
      if (!routeCache.has(key)) routeCache.set(key, words)
    }
    while (routeCache.size > 128) routeCache.delete(routeCache.keys().next().value!)
  }
  for (const line of options.witnessLines ?? []) remember(line)
  const safe = (result: OpeningSafetyResult, witness: { moves: SolverMoveSummary[]; resolve: number }, openingVictory = false) => {
    result.status = 'safe'
    result.evidence = openingVictory ? 'opening-victory' : 'winning-witness'
    result.continuation = witness.moves
    result.resolveRemaining = witness.resolve
    result.cutoffReasons = []
    remember(witness.moves)
  }
  if (options.resume) {
    const previous = options.resume
    if (previous.schemaVersion !== 1 || previous.encounterKey !== report.encounterKey
      || previous.dictionaryFingerprint !== report.dictionaryFingerprint || previous.scope !== scope
      || JSON.stringify(previous.openingVocabulary) !== JSON.stringify(report.openingVocabulary)
      || JSON.stringify(previous.familiarity) !== JSON.stringify(report.familiarity)) {
      throw new Error('Opening-safety checkpoint does not match this puzzle, opening scope or familiarity requirement.')
    }
    const prior = new Map(previous.results.map(result => [result.successorKey, result]))
    for (const result of report.results) {
      const old = prior.get(result.successorKey)
      if (!old) continue
      result.solverStatesExplored = old.solverStatesExplored
      result.attempts = old.attempts
      if (old.status === 'safe' && old.continuation) {
        const state = grouped.get(result.successorKey)!.state
        const replayed = replayWitness(state, old.continuation, familiar)
        if (replayed) safe(result, replayed, state.status === 'won')
      }
    }
  }
  // These certificates cost no continuation search, so classify them even when
  // the search budget is zero or an earlier root would exhaust that budget.
  for (const result of report.results) {
    if (result.status === 'safe') continue
    const state = grouped.get(result.successorKey)!.state
    if (state.status === 'won') safe(result, { moves: [], resolve: state.playerResolve }, true)
    else if (state.status === 'lost' || hasImpossibleLetterSupply(state)) {
      result.status = 'unsafe'
      result.evidence = state.status === 'lost' ? 'terminal-loss' : 'impossible-letter-supply'
    }
  }
  const checkpoint = () => {
    refreshTotals(report)
    report.work.elapsedMs = Math.round(performance.now() - started)
    options.onCheckpoint?.(report)
  }
  const maxSuccessors = searchBudget.maxSuccessors
  const maxDuration = searchBudget.maxDurationMs
  const checkpointEvery = Math.max(1, options.checkpointEvery ?? 10)
  const solverOptions = { ...searchBudget.solver, wordCommonness: (word: string) => commonness(word) ?? 0 }
  checkpoint()
  if (options.stopOnUnsafe && report.unsafeSuccessors > 0) {
    report.work.stoppedBy = 'unsafe-opening'
    checkpoint()
    return report
  }
  for (const result of report.results) {
    if (result.status !== 'unknown') continue
    const state = grouped.get(result.successorKey)!.state
    if (state.status === 'won') safe(result, { moves: [], resolve: state.playerResolve }, true)
    else if (state.status === 'lost' || hasImpossibleLetterSupply(state)) {
      result.status = 'unsafe'
      result.evidence = state.status === 'lost' ? 'terminal-loss' : 'impossible-letter-supply'
    } else {
      if (performance.now() - started >= maxDuration) { report.work.stoppedBy = 'time-budget'; break }
      if (report.work.invocationSuccessorsSearched >= maxSuccessors) { report.work.stoppedBy = 'successor-budget'; break }
      report.work.invocationSuccessorsSearched++
      result.attempts++
      let rescued = false
      for (const words of routeCache.values()) {
        const witness = replayWordRoute(state, words, familiar)
        if (witness) { safe(result, witness); report.work.reusedWitnesses++; rescued = true; break }
      }
      const acceptSearch = (search: SolverResult): boolean => {
        result.solverStatesExplored += search.statesExplored
        result.cutoffReasons = [...new Set([...result.cutoffReasons, ...search.cutoffReasons])]
        for (const line of search.winningLines) {
          const witness = replayWitness(state, line.moves, familiar)
          if (witness) { safe(result, witness); return true }
        }
        if (search.status === 'impossible' && search.vocabularyComplete && search.exhaustive) {
          result.status = 'unsafe'
          result.evidence = 'exhaustive-continuation-search'
          return true
        }
        return false
      }
      if (!rescued && familiarVocabulary.length) rescued = acceptSearch(solvePuzzle(state, { ...solverOptions, vocabulary: familiarVocabulary }))
      if (!rescued && performance.now() - started < maxDuration) rescued = acceptSearch(solvePuzzle(state, solverOptions))
      if (!rescued) { result.status = 'unknown'; result.evidence = 'bounded-search' }
    }
    if (options.stopOnUnsafe && result.status === 'unsafe') { report.work.stoppedBy = 'unsafe-opening'; break }
    if (report.work.invocationSuccessorsSearched % checkpointEvery === 0) checkpoint()
  }
  checkpoint()
  return report
}
