import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLetterStrikeGame, evaluateLetterStrike, previewLetterStrike, selectEnemyTarget, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../src/game/letterStrike.ts'
import { getMaximumImmediateStrikes } from '../src/experimental/maxStrikes.ts'
import { analysePuzzle, counterfactualEncounter } from '../src/generator/analyse.ts'
import { findValidMoves, scoreImmediateMove } from '../src/generator/findMoves.ts'
import { createCandidate } from '../src/generator/generate.ts'
import { mutateCandidate } from '../src/generator/mutate.ts'
import { solvePuzzle } from '../src/generator/solve.ts'
import { stateKey } from '../src/generator/stateKey.ts'

function fixture(board: string, enemy = 'E', regens: readonly number[] = [0], relation: 'opposite' | 'similar' = 'similar'): LetterStrikeState {
  const encounter: LetterStrikeEncounter = {
    id: 'regen-engine-fixture',
    enemy: { word: enemy, definition: 'test enemy', partOfSpeech: 'noun',
      semanticRelations: { opposite: [], similar: [], related: [], [relation]: [board] } },
    enemyLetters: [...enemy].map((letter, index) => ({ id: `enemy-${index}`, letter, initialHits: 1, hitsRemaining: 1 })),
    startingTiles: [...board.padEnd(16, 'Z')].map((letter, id) => ({ id, letter,
      type: regens.includes(id) ? 'gem' : 'normal', ...(regens.includes(id) ? { gem: 'regen' as const } : {}) })),
    startingResolve: 5, refillQueue: 'CAT'.repeat(40), minimumWordLength: 3, grammarModifiers: {}, wordPartsOfSpeech: {},
    tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true },
      regen: { strike: false, preventResolveLoss: false, regenerate: true } },
  }
  return { ...createLetterStrikeGame(encounter), selectedTileIds: [...board].map((_, id) => id) }
}

test('REGEN revives a dead matching letter and leaves unrelated letters alone', () => {
  const state = fixture('EAT', 'ES')
  state.enemyLetters[0].hitsRemaining = 0
  const before = structuredClone(state)
  const preview = previewLetterStrike(state)
  assert.equal(preview.valid, true)
  assert.equal(preview.strikes, 0)
  assert.deepEqual(preview.enemyLetters.map(letter => letter.hitsRemaining), [1, 1])
  assert.deepEqual(preview.recoveries, [{ tileId: 0, enemyLetterId: 'enemy-0', letter: 'E', hitsBefore: 0, hitsAfter: 1 }])
  assert.deepEqual(preview.letterOutcomes[0], { enemyLetterId: 'enemy-0', position: 0, hitsBefore: 0, hitsAfter: 1,
    armourBroken: false, removed: false, regenerated: true, recoveryCount: 1 })
  assert.deepEqual(submitLetterStrike(state).playedWords[0].preview, preview)
  assert.deepEqual(state, before)
})

test('REGEN adds armour even to originally unarmoured letters, capped at two hits', () => {
  const state = fixture('EAT')
  const preview = previewLetterStrike(state)
  assert.equal(preview.enemyLetters[0].hitsRemaining, 2)
  assert.equal(preview.enemyLetters[0].initialHits, 1)
  assert.equal(preview.enemyLetters[0].armourGained, true)
  assert.deepEqual(preview.recoveries?.map(event => [event.hitsBefore, event.hitsAfter]), [[1, 2]])
  state.enemyLetters[0].hitsRemaining = 2
  const capped = previewLetterStrike(state)
  assert.equal(capped.enemyLetters[0].hitsRemaining, 2)
  assert.deepEqual(capped.recoveries, [])
  assert.deepEqual(capped.effectLabels, ['REGEN'])
  assert.equal(capped.letterOutcomes[0].regenerated, undefined)
  const unrelated = previewLetterStrike(fixture('EAT', 'S'))
  assert.deepEqual(unrelated.recoveries, [])
  assert.equal(unrelated.enemyLetters[0].hitsRemaining, 1)
})

test('a wound in REGEN-granted armour keeps the existing damaged-armour targeting priority', () => {
  const state = fixture('EAT')
  const healed = previewLetterStrike(state).enemyLetters[0]
  const wounded = { ...healed, hitsRemaining: 1 }
  const untouched = { ...state.enemyLetters[0], id: 'earlier-unarmoured' }
  assert.equal(selectEnemyTarget([untouched, wounded], 'E')?.id, wounded.id)
  const withArmourMemory = { ...state, enemyLetters: [untouched, wounded] }
  assert.notEqual(stateKey(withArmourMemory), stateKey({ ...withArmourMemory,
    enemyLetters: [untouched, { ...wounded, armourGained: undefined }] }))
})

test('REGEN prioritizes dead duplicates, then living unarmoured duplicates, left to right', () => {
  const state = fixture('SEE', 'EEEE', [1, 2])
  ;[1, 0, 0, 2].forEach((hits, index) => { state.enemyLetters[index].hitsRemaining = hits })
  const preview = previewLetterStrike(state)
  assert.deepEqual(preview.recoveries?.map(event => event.enemyLetterId), ['enemy-1', 'enemy-2'])
  assert.deepEqual(preview.enemyLetters.map(letter => letter.hitsRemaining), [1, 1, 1, 2])
  state.enemyLetters.forEach((letter, index) => { letter.hitsRemaining = index === 3 ? 2 : 1 })
  assert.deepEqual(previewLetterStrike(state).recoveries?.map(event => event.enemyLetterId), ['enemy-0', 'enemy-1'])
})

test('all strikes happen before REGEN, including later tiles in the word', () => {
  const state = fixture('EEL', 'EE', [0], 'opposite')
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.hits.map(event => event.enemyLetterId), ['enemy-0', 'enemy-1'])
  assert.deepEqual(preview.enemyLetters.map(letter => letter.hitsRemaining), [1, 0])
  assert.deepEqual(preview.recoveries?.map(event => event.enemyLetterId), ['enemy-0'])
  assert.deepEqual(preview.letterOutcomes.map(outcome => outcome.removed), [false, true])
  assert.deepEqual(submitLetterStrike(state).enemyLetters, preview.enemyLetters)
})

test('each physical REGEN tile heals once, including revival then armour in the same move', () => {
  const state = fixture('SEE', 'E', [1, 2], 'opposite')
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.recoveries?.map(event => [event.hitsBefore, event.hitsAfter]), [[0, 1], [1, 2]])
  assert.equal(preview.enemyLetters[0].hitsRemaining, 2)
  assert.equal(preview.letterOutcomes[0].recoveryCount, 2)
  const duplicateTile = evaluateLetterStrike(state, [state.tiles[1], state.tiles[1]])
  assert.equal(duplicateTile.recoveries?.length, 1)
})

test('victory is checked after recovery, and invalid words expose no actionable recovery', () => {
  const state = { ...fixture('EAT', 'E', [0], 'opposite'), playerResolve: 1 }
  const lost = submitLetterStrike(state)
  assert.equal(lost.status, 'lost')
  assert.equal(lost.playerResolve, 0)
  assert.equal(lost.enemyLetters[0].hitsRemaining, 1)
  const safe = { ...state, tiles: state.tiles.map(tile => ({ ...tile, type: 'normal' as const, gem: undefined })) }
  assert.equal(submitLetterStrike(safe).status, 'won')
  const invalidState = fixture('QXZ', 'Q')
  invalidState.enemyLetters[0].hitsRemaining = 0
  const invalid = previewLetterStrike(invalidState)
  assert.equal(invalid.valid, false)
  assert.deepEqual(invalid.recoveries, [])
  assert.deepEqual(invalid.effectLabels, [])
  assert.equal(invalid.enemyLetters[0].hitsRemaining, 0)
  assert.deepEqual({ ...submitLetterStrike(invalidState), error: null }, invalidState)
})

test('regained armour is the final outcome, while damage and healing remain separate events', () => {
  const state = fixture('EAT', 'E', [0], 'opposite')
  state.enemyLetters[0] = { ...state.enemyLetters[0], initialHits: 2, hitsRemaining: 2 }
  const preview = previewLetterStrike(state)
  assert.equal(preview.hits[0].hitsAfter, 1)
  assert.equal(preview.recoveries?.[0].hitsAfter, 2)
  assert.equal(preview.letterOutcomes[0].hitsAfter, 2)
  assert.equal(preview.letterOutcomes[0].armourBroken, false)
  assert.equal(preview.letterOutcomes[0].regenerated, true)
})

test('the solver distinguishes safe duplicate tiles, penalizes recovery and rejects a false win', () => {
  const state = { ...fixture('CAAT', 'A', [1]), playerResolve: 1 }
  const moves = findValidMoves(state, { vocabulary: ['CAT'] })
  assert.equal(moves.length, 2)
  const safe = moves.find(move => !move.regenUsed)!
  const harmful = moves.find(move => move.regenUsed)!
  assert.equal(safe.resultingState.status, 'won')
  assert.equal(harmful.resultingState.status, 'lost')
  assert.deepEqual(harmful.recoveries, harmful.resultingState.playedWords[0].preview.recoveries)
  assert.ok(scoreImmediateMove(safe) > scoreImmediateMove(harmful))
  assert.notEqual(stateKey(safe.resultingState), stateKey(harmful.resultingState))
  assert.equal(getMaximumImmediateStrikes(state), 1)
  const solved = solvePuzzle(state, { strategy: 'bfs', maxStates: 10, vocabulary: ['CAT'] })
  assert.equal(solved.solvable, true)
  assert.ok(solved.winningLines.every(line => line.moves[0].regenUsed === undefined))
  const harmfulOnly = { ...state, tiles: state.tiles.filter(tile => tile.id !== 2) }
  assert.equal(solvePuzzle(harmfulOnly, { strategy: 'bfs', maxStates: 10 }).status, 'impossible')
})

test('REGEN construction and mutation are opt-in, deterministic, and JSON replayable', () => {
  const seed = 'regen-construction'
  const legacy = createCandidate('MELANCHOLY', seed)
  assert.equal(legacy.encounter.tileEffects.regen, undefined)
  assert.equal(legacy.encounter.startingTiles.some(tile => tile.gem === 'regen'), false)
  const candidate = createCandidate('MELANCHOLY', seed, { includeRegenTile: true })
  assert.deepEqual(candidate, createCandidate('MELANCHOLY', seed, { includeRegenTile: true }))
  const regen = candidate.encounter.startingTiles.filter(tile => tile.gem === 'regen')
  assert.equal(regen.length, 1)
  assert.ok(candidate.enemyWord.includes(regen[0].letter))
  assert.deepEqual(createLetterStrikeGame(JSON.parse(JSON.stringify(candidate.encounter))), createLetterStrikeGame(candidate.encounter))
  let state = createLetterStrikeGame(candidate.encounter)
  for (const [index, ids] of candidate.construction.plannedTileIds.entries()) {
    assert.equal(previewLetterStrike(state, ids).word, candidate.construction.plannedWords[index])
    assert.equal(previewLetterStrike(state, ids).valid, true)
    state = submitLetterStrike(state, ids)
  }
  const moved = mutateCandidate(candidate, 'move-regen-test', { kind: 'move-regen' })
  assert.deepEqual(moved, mutateCandidate(candidate, 'move-regen-test', { kind: 'move-regen' }))
  assert.notEqual(moved.encounter.startingTiles.find(tile => tile.gem === 'regen')?.id, regen[0].id)
  assert.doesNotThrow(() => createLetterStrikeGame(moved.encounter))
})

test('analysis records bounded REGEN use and preservation decisions without treating healing as damage', () => {
  const state = fixture('CAAT', 'A', [1])
  const analysis = analysePuzzle(state.encounter, {
    solver: { maxStates: 6, vocabulary: ['CAT'], beamWidth: 2, maxWinningLines: 3 },
    counterfactualSolver: { maxStates: 6, vocabulary: ['CAT'], beamWidth: 2 },
    maxReasonableStates: 0, maxFinalStates: 0,
  })
  assert.equal(analysis.specialTileChoices.regen, 1)
  assert.equal(analysis.specialTileDecisions.regen?.openingWordsUsing, 1)
  assert.equal(analysis.specialTileDecisions.regen?.openingWordsPreserving, 1)
  assert.ok(analysis.counterfactuals.some(item => item.mechanic === 'regen' && item.present))
  assert.equal(analysis.searchComplete, false)
  const without = counterfactualEncounter(state.encounter, 'regen')
  assert.equal(without.tileEffects.regen?.regenerate, false)
  assert.deepEqual(without.tileEffects.strike, state.encounter.tileEffects.strike)
  assert.deepEqual(without.tileEffects.ward, state.encounter.tileEffects.ward)
  assert.equal(previewLetterStrike({ ...state, encounter: without }, [0, 1, 3]).enemyLetters[0].hitsRemaining, 0)
})
