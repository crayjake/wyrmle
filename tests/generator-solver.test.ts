import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLetterStrikeGame, letterStrikeEncounter, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { discoverValidMoves, findValidMoves } from '../src/generator/findMoves.ts'
import { solvePuzzle } from '../src/generator/solve.ts'
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
