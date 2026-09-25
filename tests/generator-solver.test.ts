import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLetterStrikeGame, letterStrikeEncounter, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { discoverValidMoves, findValidMoves } from '../src/generator/findMoves.ts'
import { solvePuzzle, winningStrategySignature } from '../src/generator/solve.ts'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { currentLexicalRules } from '../src/game/lexicalRules.ts'
import { stateKey } from '../src/generator/stateKey.ts'

function fixture(board: string, enemy: string, resolve = 2): LetterStrikeState {
  const initial = createLetterStrikeGame({
    ...letterStrikeEncounter,
    startingResolve: resolve,
    grammarModifiers: {},
    longWordRule: undefined,
    wordPartsOfSpeech: {},
    enemy: { ...letterStrikeEncounter.enemy, semanticRelations: { opposite: [], similar: [], related: [] } },
    refillQueue: 'CAT'.repeat(40),
  })
  return {
    ...initial,
    // Reachable-position test harnesses can be small; the production creator
    // still requires a full board. All moves use the unchanged real transition.
    tiles: [...board].map((letter, id) => ({ id, letter, type: 'normal' })),
    enemyLetters: [...enemy].map((letter, index) => ({ id: `e-${index}`, letter, hitsRemaining: 1, initialHits: 1 })),
    playerResolve: resolve,
  }
}

test('move discovery uses real tile IDs, preview events and full submitted result', () => {
  const state = fixture('GLAD', 'LAD')
  state.tiles[1] = { ...state.tiles[1], type: 'gem', gem: 'strike' }
  state.tiles[3] = { ...state.tiles[3], type: 'gem', gem: 'ward' }
  state.encounter = { ...state.encounter, grammarModifiers: { adjective: 1 } }
  const before = structuredClone(state)
  const move = findValidMoves(state, { vocabulary: ['GLAD'] })[0]
  const preview = previewLetterStrike(state, move.tileIds)
  assert.deepEqual(move.resultingState, submitLetterStrike(state, move.tileIds))
  assert.deepEqual(move.hits, preview.hits)
  assert.deepEqual(move.tileIds, [0, 1, 2, 3])
  assert.equal(move.grammarModifier, 1)
  assert.equal(move.semanticLabel, preview.semanticLabel)
  assert.equal(move.wardUsed, true)
  assert.equal(move.strikeUsed, true)
  assert.equal(move.resolveCost, 0)
  assert.equal(move.resultingState.playerResolve, state.playerResolve)
  assert.deepEqual(state, before)
})

test('normal duplicate slot choices survive deduplication and refill different positions', () => {
  const state = fixture('CAAT', 'A')
  const moves = findValidMoves(state, { vocabulary: ['CAT'] })
  assert.equal(moves.length, 2)
  assert.deepEqual(moves.map(move => move.tileIds).sort(), [[0, 1, 3], [0, 2, 3]])
  assert.notEqual(stateKey(moves[0].resultingState), stateKey(moves[1].resultingState))
  assert.equal(moves[0].resultingState.tiles.find(tile => tile.id === 2)?.letter, 'A')
})

test('same-letter Strike order is enumerated because it changes actual targeting', () => {
  const state = fixture('EEL', 'EL')
  state.tiles[0] = { ...state.tiles[0], type: 'gem', gem: 'strike' }
  const moves = findValidMoves(state, { vocabulary: ['EEL'] })
  assert.equal(moves.length, 2)
  assert.deepEqual(moves.map(move => move.strikes).sort(), [1, 2])
  assert.equal(moves.find(move => move.tileIds[0] === 0)?.resultingState.status, 'won')
  const armoured = { ...state, enemyLetters: [{ id: 'armour', letter: 'E', hitsRemaining: 2, initialHits: 2 }] }
  const hit = findValidMoves(armoured, { vocabulary: ['EEL'] })[0]
  assert.deepEqual(hit.hits.map(event => [event.enemyLetterId, event.hitsBefore, event.hitsAfter]), [
    ['armour', 2, 1], ['armour', 1, 0],
  ])
})

test('move discovery agrees with exhaustive physical selection outcomes on a small board', () => {
  const state = fixture('AATER', 'AATE')
  state.tiles[0] = { ...state.tiles[0], type: 'gem', gem: 'strike' }
  state.tiles[2] = { ...state.tiles[2], type: 'gem', gem: 'ward' }
  state.enemyLetters[0] = { ...state.enemyLetters[0], hitsRemaining: 2, initialHits: 2 }
  state.encounter = { ...state.encounter, enemy: { ...state.encounter.enemy,
    semanticRelations: { opposite: ['RATE', 'TEAR'], similar: ['EAT'], related: [] },
  } }
  const oracle = new Set<string>()
  const selected: number[] = []
  const visit = () => {
    if (selected.length >= 3 && previewLetterStrike(state, selected).valid) oracle.add(stateKey(submitLetterStrike(state, selected)))
    for (const tile of state.tiles) {
      if (selected.includes(tile.id)) continue
      selected.push(tile.id); visit(); selected.pop()
    }
  }
  visit()
  const found = discoverValidMoves(state)
  assert.equal(found.complete, true)
  assert.deepEqual(new Set(found.moves.map(move => stateKey(move.resultingState))), oracle)
})

test('state keys ignore UI/history but distinguish board slots, identities, armour and rules', () => {
  const state = fixture('CAT', 'CA')
  assert.equal(stateKey(state), stateKey({ ...state, selectedTileIds: [0], error: 'anything', playedWords: [] }))
  const different: LetterStrikeState[] = [
    { ...state, tiles: [...state.tiles].reverse() },
    { ...state, tiles: state.tiles.map((tile, index) => index === 0 ? { ...tile, id: 80 } : tile) },
    { ...state, refillIndex: 1 },
    { ...state, nextTileId: 80 },
    { ...state, playerResolve: 1 },
    { ...state, enemyLetters: state.enemyLetters.map((letter, index) => index === 0 ? { ...letter, hitsRemaining: 0 } : letter) },
    { ...state, encounter: { ...state.encounter, strikeConsumesAllowance: true } },
    { ...state, encounter: { ...state.encounter, grammarModifiers: { noun: 1 } } },
  ]
  for (const changed of different) assert.notEqual(stateKey(state), stateKey(changed))
})

test('exhaustive BFS proves a two-turn victory and its shortest depth', () => {
  const state = fixture('CAT', 'CA', 2)
  const result = solvePuzzle(state, { strategy: 'bfs', maxStates: 100 })
  assert.equal(result.solvable, true)
  assert.equal(result.exhaustive, true)
  assert.equal(result.minimumTurnsToWin, 2)
  assert.equal(result.minimumTurnsProven, true)
  assert.ok(result.winningLines.length > 0)
  for (const line of result.winningLines) {
    let played = state
    for (const move of line.moves) played = submitLetterStrike(played, move.tileIds)
    assert.equal(played.status, 'won')
    assert.deepEqual(played, line.finalState)
  }
})

test('unrestricted exhaustive failure is impossible while bounded failure stays unknown', () => {
  const impossible = fixture('CAT', 'Z', 1)
  const exact = solvePuzzle(impossible, { strategy: 'bfs', maxStates: 20 })
  assert.equal(exact.status, 'impossible')
  assert.equal(exact.solvable, false)
  assert.equal(exact.searchLimitReached, false)
  const restricted = solvePuzzle(impossible, { strategy: 'bfs', vocabulary: ['CAT'] })
  assert.equal(restricted.status, 'unknown')
  assert.equal(restricted.solvable, null)
  assert.equal(restricted.vocabularyComplete, false)
  const bounded = solvePuzzle(fixture('CAT', 'CA'), { strategy: 'bfs', maxStates: 1 })
  assert.equal(bounded.status, 'unknown')
  assert.equal(bounded.minimumTurnsToWin, null)
  assert.ok(bounded.cutoffReasons.includes('state-limit'))
})

test('a valid construction witness proves solvability but not bounded shortest depth', () => {
  const state = fixture('CAT', 'CA')
  const first = submitLetterStrike(state, [0, 1, 2])
  const secondIds = [first.tiles[1].id, first.tiles[0].id, first.tiles[2].id]
  const result = solvePuzzle(state, { maxStates: 0, hintLine: [[0, 1, 2], secondIds] })
  assert.equal(result.solvable, true)
  assert.equal(result.bestWinDepth, 2)
  assert.equal(result.minimumTurnsToWin, null)
  assert.equal(result.states.filter(record => record.canWin === true).length, 3)
  assert.ok(result.states.every(record => record.moves.length === record.successorKeys.length))
  const invalid = solvePuzzle(state, { maxStates: 0, hintLine: [[0, 0, 0]] })
  assert.equal(invalid.status, 'unknown')
})

test('beam cutoff cannot be reported as impossible and capped move lists retain different words', () => {
  const state = fixture('CAATER', 'CAER', 3)
  const moves = discoverValidMoves(state, { maxMoves: 6 })
  assert.equal(moves.complete, false)
  assert.ok(new Set(moves.moves.map(move => move.word)).size >= 3)
  const result = solvePuzzle(state, { maxStates: 1, beamWidth: 1, maxMovesPerState: 1 })
  assert.notEqual(result.status, 'impossible')
  assert.equal(result.exhaustive, false)
})

function hintForWords(initial: LetterStrikeState, words: readonly string[]): number[][] {
  let state = initial
  const selections: number[][] = []
  for (const word of words) {
    const move = findValidMoves(state, { vocabulary: [word] })[0]
    assert.ok(move, `${word} must be physically playable in the test witness.`)
    selections.push(move.tileIds)
    state = move.resultingState
  }
  assert.equal(state.status, 'won', 'A fixture hint must be a real winning route.')
  return selections
}

test('multiple hint routes merge independent real proofs and reject invalid prefixes without erasing valid hints', () => {
  const state = fixture('CAT', 'CA')
  const cat = hintForWords(state, ['CAT', 'ACT'])
  const act = hintForWords(state, ['ACT', 'CAT'])
  const invalid = [[2, 1, 0], [999, 998, 997]]
  const result = solvePuzzle(state, { maxStates: 0, hintLine: cat, hintLines: [invalid, act, cat] })
  assert.deepEqual(result.hintReplay, { submittedRoutes: 4, winningRoutes: 2, duplicateRoutes: 1, rejectedRoutes: 1 })
  assert.equal(result.winningLines.length, 2)
  assert.deepEqual(new Set(result.rootMoves.map(move => move.word)), new Set(['CAT', 'ACT']))
  assert.equal(result.states.filter(record => record.canWin === true).length, 4)
  assert.ok(result.states.every(record => record.moves.length === record.successorKeys.length))
  assert.equal(result.statesExplored, 0, 'Replaying supplied evidence does not pretend to explore the search graph.')
  assert.equal(result.movesExamined, 0)
  assert.equal(result.solvable, true)
  assert.equal(result.bestWinDepth, 2)
  assert.equal(result.minimumTurnsProven, false)
  assert.equal(result.minimumTurnsToWin, null)
  assert.equal(result.exhaustive, false)
  for (const line of result.winningLines) {
    let replayed = state
    for (const move of line.moves) replayed = submitLetterStrike(replayed, move.tileIds)
    assert.deepEqual(replayed, line.finalState)
    assert.equal(replayed.status, 'won')
  }
})

test('finishing-word variants cannot crowd out a different opening and semantic strategy', () => {
  const state = fixture('CATDOG', 'CD', 3)
  state.encounter = { ...state.encounter, enemy: { ...state.encounter.enemy,
    semanticRelations: { opposite: ['GOD'], similar: [], related: [] } } }
  const variants = ['DOG', 'DOT', 'DAG', 'DAGO', 'DATO', 'DOAT', 'TOD'].map(word => hintForWords(state, ['CAT', word]))
  const different = hintForWords(state, ['GOD', 'CAT'])
  const result = solvePuzzle(state, { maxStates: 0, maxWinningLines: 2, hintLines: [...variants, different] })
  assert.equal(result.hintReplay!.winningRoutes, 8, 'All eight supplied physical routes really win.')
  assert.equal(result.winningLines.length, 2, 'Seven finishing variations share one strategy representative.')
  assert.deepEqual(new Set(result.winningLines.map(line => line.moves[0].word)), new Set(['CAT', 'GOD']))
  assert.equal(new Set(result.winningLines.map(line => winningStrategySignature(line.moves))).size, 2)
  assert.equal(result.bestWinDepth, 2)
  assert.equal(result.minimumTurnsProven, false)
})

test('different special-use turns remain distinct strategies despite matching opening and semantic categories', () => {
  const state = fixture('CAATDOG', 'CD', 3)
  state.tiles[2] = { ...state.tiles[2], type: 'gem', gem: 'ward' }
  const earlyWard = [[0, 2, 3], [4, 5, 6]]
  const preservedWard = [[0, 1, 3], [4, 5, 6]]
  const lateWard = [[0, 1, 3], [4, 2, 6]]
  const result = solvePuzzle(state, { maxStates: 0, maxWinningLines: 3, hintLines: [earlyWard, preservedWard, lateWard] })
  assert.equal(result.winningLines.length, 3)
  assert.deepEqual(new Set(result.winningLines.map(line => line.moves.findIndex(move => move.wardUsed))), new Set([0, -1, 1]))
  assert.ok(result.winningLines.every(line => line.moves[0].word === 'CAT'))
  assert.ok(result.winningLines.every(line => line.moves.every(move => move.semanticLabel === 'NEUTRAL')))
  assert.equal(new Set(result.winningLines.map(line => winningStrategySignature(line.moves))).size, 3)
})

test('new lexical encounters use diverse retention automatically while legacy result shapes stay unchanged', () => {
  const legacy = fixture('CATDOG', 'CD', 2)
  const modern = { ...legacy, encounter: { ...legacy.encounter, lexicalRules: { ...currentLexicalRules } } }
  const options = { strategy: 'bfs' as const, maxStates: 100, maxWinningLines: 12 }
  const oldResult = solvePuzzle(legacy, options)
  const newResult = solvePuzzle(modern, options)
  assert.equal('hintReplay' in oldResult, false)
  assert.equal('hintReplay' in newResult, true)
  assert.ok(new Set(oldResult.winningLines.map(line => winningStrategySignature(line.moves))).size < oldResult.winningLines.length)
  assert.equal(new Set(newResult.winningLines.map(line => winningStrategySignature(line.moves))).size, newResult.winningLines.length)
  assert.equal(newResult.solvable, oldResult.solvable)
  assert.equal(newResult.minimumTurnsToWin, oldResult.minimumTurnsToWin)
})

test('counterfactual sampling reaches a distinct meaningful route behind six finishing-word variations', () => {
  const seed = fixture('CATDOGQQQQQQQQQQ', 'CD', 3)
  const encounter = { ...seed.encounter, lexicalRules: { ...currentLexicalRules },
    startingTiles: seed.tiles, enemyLetters: seed.enemyLetters,
    enemy: { ...seed.encounter.enemy, semanticRelations: { opposite: ['COD'], similar: [], related: [] } } }
  const initial = createLetterStrikeGame(encounter)
  const variants = ['DOG', 'DOT', 'DAG', 'DAGO', 'DATO', 'DOAT'].map(word => hintForWords(initial, ['CAT', word]))
  const counter = hintForWords(initial, ['COD'])
  const base = solvePuzzle(encounter, { maxStates: 0, hintLines: [...variants, counter] })
  // Simulate an older/external retained list: every entry is independently
  // replayed by the real solver, but six near-identical prefixes come first.
  const realLines = [...variants, counter].map(hintLine => solvePuzzle(encounter, { maxStates: 0, hintLine }).winningLines[0])
  const analysis = analysePuzzle(encounter, { solution: { ...base, winningLines: realLines },
    maxReasonableStates: 0, includeCounterfactuals: false, wordCommonness: () => 0.9 })
  const semantic = analysis.counterfactuals.find(comparison => comparison.mechanic === 'semantic')!
  assert.equal(semantic.replayedWinningLines, 2, 'Finishing variations contribute one representative, plus the distinct COD counter.')
  assert.equal(semantic.changedWinningOutcomes, 1)
  assert.ok(semantic.changedStrikeCount > 0)
  assert.ok(semantic.importance! > 0)
  assert.equal(analysis.winningLinesFound, 7, 'The supplied retained list still describes seven actual wins, not seven distinct strategies.')
  assert.equal(analysis.numberOfDistinctWinningStrategies, 2)
})
