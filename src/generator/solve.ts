import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import { getPartsOfSpeech } from '../game/dictionary.ts'
import { discoverValidMoves, moveSummary, scoreImmediateMove } from './findMoves.ts'
import type { MoveDiscoveryOptions, SolverMoveSummary } from './findMoves.ts'
import { encounterRuleKey, stateKey } from './stateKey.ts'

export type SolverOptions = {
  strategy?: 'bfs' | 'beam'
  maxStates?: number
  beamWidth?: number
  maxMovesPerState?: number
  maxSelectionsPerState?: number
  maxDepth?: number
  maxWinningLines?: number
  vocabulary?: readonly string[]
  wordCommonness?: (word: string) => number
  /** A construction witness is replayed through the engine; it is never a proof of optimality. */
  hintLine?: readonly (readonly number[])[]
}

export type WinningLine = {
  moves: SolverMoveSummary[]
  finalState: LetterStrikeState
  turns: number
  resolveRemaining: number
}
export type SearchStateRecord = {
  key: string
  state: LetterStrikeState
  depth: number
  moves: SolverMoveSummary[]
  /** Index-aligned with moves. Missing records denote unexplored successors. */
  successorKeys: string[]
  expanded: boolean
  movesComplete: boolean
  canWin: boolean | null
}
export type SolverResult = {
  status: 'won' | 'impossible' | 'unknown'
  solvable: boolean | null
  minimumTurnsToWin: number | null
  minimumTurnsProven: boolean
  bestWinDepth: number | null
  maximumResolveRemaining: number | null
  maximumResolveProven: boolean
  winningLines: WinningLine[]
  rootMoves: SolverMoveSummary[]
  states: SearchStateRecord[]
  statesExplored: number
  statesDiscovered: number
  movesExamined: number
  searchLimitReached: boolean
  cutoffReasons: string[]
  vocabularyComplete: boolean
  exhaustive: boolean
}

type SearchNode = { record: SearchStateRecord; line: SolverMoveSummary[]; score: number }

function makeRecord(state: LetterStrikeState, depth: number, key: string): SearchStateRecord {
  return {
    key, state, depth, moves: [], successorKeys: [], expanded: state.status !== 'playing',
    movesComplete: state.status !== 'playing', canWin: state.status === 'won' ? true : state.status === 'lost' ? false : null,
  }
}

/**
 * Bounded search over the exact game transition. Beam results are witnesses;
 * unexplored/pruned positions remain unknown, never "unsolvable". BFS proves
 * shortest depth only when every shallower layer was completely explored.
 */
export function solvePuzzle(input: LetterStrikeEncounter | LetterStrikeState, options: SolverOptions = {}): SolverResult {
  const initial = 'tiles' in input ? input : createLetterStrikeGame(input)
  const strategy = options.strategy ?? 'beam'
  const maxStates = Math.max(0, options.maxStates ?? 160)
  const beamWidth = Math.max(1, options.beamWidth ?? 16)
  const maxWinningLines = Math.max(1, options.maxWinningLines ?? 12)
  const wards = initial.tiles.filter(tile => tile.type === 'gem' && tile.gem && initial.encounter.tileEffects[tile.gem].preventResolveLoss).length
  const maxDepth = options.maxDepth ?? initial.playerResolve + wards
  const discoveryOptions: MoveDiscoveryOptions = {
    vocabulary: options.vocabulary,
    wordCommonness: options.wordCommonness,
    maxMoves: options.maxMovesPerState ?? (strategy === 'bfs' ? Number.POSITIVE_INFINITY : 64),
    maxSelections: options.maxSelectionsPerState ?? (strategy === 'bfs' ? Number.POSITIVE_INFINITY : 1600),
  }
  const ruleKey = encounterRuleKey(initial.encounter)
  const getKey = (state: LetterStrikeState) => stateKey(state, ruleKey)
  const root = makeRecord(initial, 0, getKey(initial))
  const records = new Map<string, SearchStateRecord>([[root.key, root]])
  const knownTerminal = new Map<string, boolean>()
  const winningLines: WinningLine[] = []
  const winningSignatures = new Set<string>()
  const routeSignature = (line: readonly SolverMoveSummary[]) => line.map(move => `${move.word}:${move.wardUsed}:${move.strikeUsed}`).join('|')
  const witnessRecords: { state: LetterStrikeState; depth: number; move: SolverMoveSummary; successor: LetterStrikeState }[] = []
  const cutoffs = new Set<string>()
  const vocabularyComplete = options.vocabulary === undefined
  if (!vocabularyComplete) cutoffs.add('restricted-vocabulary')
  let firstIncompleteDepth = vocabularyComplete ? Number.POSITIVE_INFINITY : 0
  let statesExplored = 0
  let movesExamined = 0
  let statesDiscovered = 1
  let bestWinDepth: number | null = null
  let maximumResolveRemaining: number | null = null
  let constructionWitness: WinningLine | undefined
  const lineCommonness = (line: WinningLine) => line.moves.length === 0 ? 0
    : line.moves.reduce((sum, move) => sum + (options.wordCommonness?.(move.word) ?? 0), 0) / line.moves.length
  const registerWin = (state: LetterStrikeState, line: SolverMoveSummary[]) => {
    bestWinDepth = bestWinDepth === null ? line.length : Math.min(bestWinDepth, line.length)
    maximumResolveRemaining = Math.max(maximumResolveRemaining ?? -1, state.playerResolve)
    const signature = line.map(move => `${move.word}:${move.tileIds.join(',')}`).join('|')
    if (winningSignatures.has(signature)) return
    winningSignatures.add(signature)
    const existingRoute = winningLines.findIndex(winning => routeSignature(winning.moves) === routeSignature(line))
    if (existingRoute >= 0) {
      if (winningLines[existingRoute].resolveRemaining >= state.playerResolve) return
      winningLines.splice(existingRoute, 1)
    }
    const winning = { moves: line, finalState: state, turns: line.length, resolveRemaining: state.playerResolve }
    winningLines.push(winning)
    winningLines.sort((a, b) => lineCommonness(b) - lineCommonness(a) || a.turns - b.turns || b.resolveRemaining - a.resolveRemaining
      || a.moves.map(move => move.word).join(' ').localeCompare(b.moves.map(move => move.word).join(' ')))
    if (winningLines.length > maxWinningLines) winningLines.pop()
  }
  if (initial.status === 'won') registerWin(initial, [])

  // Witnesses must satisfy the actual board IDs, dictionary and transition.
  if (options.hintLine) {
    let state = initial
    const line: SolverMoveSummary[] = []
    for (const selection of options.hintLine) {
      const next = submitLetterStrike(state, selection)
      if (next.playedWords.length !== state.playedWords.length + 1) break
      const preview = next.playedWords[next.playedWords.length - 1].preview
      const summary: SolverMoveSummary = {
        word: preview.word, tileIds: [...selection], semanticLabel: preview.semanticLabel,
        partsOfSpeech: state.encounter.wordPartsOfSpeech?.[preview.word] ?? getPartsOfSpeech(preview.word) ?? [],
        grammarModifier: preview.grammaticalModifier, longWordModifier: preview.longWordModifier,
        wardUsed: preview.resolveCost === 0, strikeUsed: preview.effectLabels.includes('STRIKE'),
        strikes: preview.strikes, resolveCost: preview.resolveCost, hits: preview.hits, letterOutcomes: preview.letterOutcomes,
      }
      witnessRecords.push({ state, depth: line.length, move: summary, successor: next })
      line.push(summary)
      state = next
      if (state.status === 'won') {
        registerWin(state, line)
        constructionWitness = { moves: line, finalState: state, turns: line.length, resolveRemaining: state.playerResolve }
        break
      }
      if (state.status === 'lost') break
    }
    if (state.status !== 'won') witnessRecords.length = 0
  }

  let frontier: SearchNode[] = initial.status === 'playing' ? [{ record: root, line: [], score: 0 }] : []
  while (frontier.length > 0) {
    const nextLayer = new Map<string, SearchNode>()
    for (const node of frontier) {
      const { record } = node
      if (statesExplored >= maxStates) {
        cutoffs.add('state-limit')
        firstIncompleteDepth = Math.min(firstIncompleteDepth, record.depth)
        continue
      }
      if (record.depth >= maxDepth) {
        cutoffs.add('depth-limit')
        firstIncompleteDepth = Math.min(firstIncompleteDepth, record.depth)
        continue
      }
      const discovery = discoverValidMoves(record.state, discoveryOptions)
      statesExplored += 1
      movesExamined += discovery.legalSelectionsExamined
      record.expanded = true
      record.movesComplete = discovery.complete && discovery.vocabularyComplete
      if (!discovery.complete) {
        cutoffs.add('move-limit')
        firstIncompleteDepth = Math.min(firstIncompleteDepth, record.depth)
      }
      for (const move of discovery.moves) {
        const summary = moveSummary(move)
        const key = getKey(move.resultingState)
        record.moves.push(summary)
        record.successorKeys.push(key)
        const line = [...node.line, summary]
        if (move.resultingState.status === 'won') {
          registerWin(move.resultingState, line)
          knownTerminal.set(key, true)
          if (!records.has(key) && winningLines.some(winning => winning.finalState === move.resultingState)) {
            records.set(key, makeRecord(move.resultingState, record.depth + 1, key))
          }
          continue
        }
        if (move.resultingState.status === 'lost') { knownTerminal.set(key, false); continue }
        const existing = records.get(key)
        if (existing && existing.depth <= record.depth + 1) continue
        if (nextLayer.has(key)) continue
        const child = makeRecord(move.resultingState, record.depth + 1, key)
        const remainingHits = move.resultingState.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)
        // Remaining objective and Resolve are useful guidance, not impossibility bounds.
        const score = -remainingHits * 100 + move.resultingState.playerResolve * 22
          + scoreImmediateMove(summary, options.wordCommonness) * 0.01
        nextLayer.set(key, { record: child, line, score })
        statesDiscovered += 1
      }
    }
    let next = [...nextLayer.values()]
    if (strategy === 'beam') {
      next.sort((a, b) => b.score - a.score || a.record.key.localeCompare(b.record.key))
      if (next.length > beamWidth) {
        cutoffs.add('beam-width')
        firstIncompleteDepth = Math.min(firstIncompleteDepth, next[beamWidth].record.depth)
        // Round-robin by opening spelling keeps physical-ID variants from
        // eliminating every competing first move from a bounded search.
        const groups = new Map<string, SearchNode[]>()
        for (const node of next) {
          const opening = node.line[0]?.word ?? ''
          const group = groups.get(opening) ?? []
          group.push(node)
          groups.set(opening, group)
        }
        const selected: SearchNode[] = []
        for (let round = 0; selected.length < beamWidth; round += 1) {
          for (const group of groups.values()) {
            if (group[round]) selected.push(group[round])
            if (selected.length >= beamWidth) break
          }
        }
        next = selected
      }
    }
    // Bound retained frontier memory as well as work. Omitted nodes stay unknown.
    const room = Math.max(0, maxStates - statesExplored)
    if (next.length > room) {
      cutoffs.add('state-limit')
      firstIncompleteDepth = Math.min(firstIncompleteDepth, next[room].record.depth)
      next = next.slice(0, room)
    }
    for (const node of next) records.set(node.record.key, node.record)
    frontier = next
  }

  // Expose every replayed witness position to the analysis graph. These edges
  // prove reachability only; an unexpanded witness node stays non-exhaustive.
  for (const witness of witnessRecords) {
    const key = getKey(witness.state)
    const childKey = getKey(witness.successor)
    const record = records.get(key) ?? makeRecord(witness.state, witness.depth, key)
    record.canWin = true
    const alreadyPresent = record.moves.some(move => move.word === witness.move.word
      && move.tileIds.join(',') === witness.move.tileIds.join(','))
    if (!alreadyPresent) {
      record.moves.push(witness.move)
      record.successorKeys.push(childKey)
      const orderedEdges = record.moves.map((move, index) => ({ move, key: record.successorKeys[index] }))
        .sort((a, b) => scoreImmediateMove(b.move, options.wordCommonness) - scoreImmediateMove(a.move, options.wordCommonness))
      record.moves = orderedEdges.map(edge => edge.move)
      record.successorKeys = orderedEdges.map(edge => edge.key)
    }
    records.set(key, record)
    if (witness.successor.status === 'won') {
      knownTerminal.set(childKey, true)
      records.set(childKey, makeRecord(witness.successor, witness.depth + 1, childKey))
    }
  }

  // Propagate only proven facts. Deduplication is safe because history/selection
  // never constrain legal moves and refill position makes the graph acyclic.
  const ordered = [...records.values()].sort((a, b) => b.state.refillIndex - a.state.refillIndex)
  for (const record of ordered) {
    if (record.state.status !== 'playing') continue
    const children = record.successorKeys.map(key => knownTerminal.get(key) ?? records.get(key)?.canWin ?? null)
    if (children.some(value => value === true)) record.canWin = true
    else if (record.expanded && record.movesComplete && children.every(value => value === false)) record.canWin = false
  }
  // A replayed witness may be outside the searched beam but proves its root.
  if (bestWinDepth !== null) root.canWin = true
  if (constructionWitness && !winningLines.some(line => routeSignature(line.moves) === routeSignature(constructionWitness!.moves))) {
    if (winningLines.length >= maxWinningLines) winningLines.pop()
    winningLines.push(constructionWitness)
  }
  const exhaustive = cutoffs.size === 0
  const minimumTurnsProven = bestWinDepth !== null && (bestWinDepth === 0 || firstIncompleteDepth >= bestWinDepth - 1)
  const maximumResolveProven = maximumResolveRemaining !== null
    && (exhaustive || maximumResolveRemaining === initial.playerResolve)
  const solvable = root.canWin
  return {
    status: solvable === true ? 'won' : solvable === false ? 'impossible' : 'unknown',
    solvable,
    minimumTurnsToWin: minimumTurnsProven ? bestWinDepth : null,
    minimumTurnsProven,
    bestWinDepth,
    maximumResolveRemaining,
    maximumResolveProven,
    winningLines,
    rootMoves: root.moves,
    states: [...records.values()],
    statesExplored, statesDiscovered, movesExamined,
    searchLimitReached: cutoffs.size > 0,
    cutoffReasons: [...cutoffs], vocabularyComplete, exhaustive,
  }
}

export const solve = solvePuzzle
