import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLetterStrikeGame, letterStrikeEncounter, submitLetterStrike } from '../src/game/letterStrike.ts'
import { captureUndoSnapshot, restoreUndoSnapshot } from '../src/daily/undo.ts'
import { createCandidate, generateForEnemy } from '../src/generator/generate.ts'
import { mutateCandidate } from '../src/generator/mutate.ts'
import { solvePuzzle } from '../src/generator/solve.ts'
import { withCompiledMeanings } from '../src/generator/meaningCompiler.ts'

test('finite construction caps planned supply and keeps only legal engine-replayed trace prefixes', () => {
  const seed = 'finite-construction'
  const ordinary = createCandidate('ANGER', seed, { includeRegenTile: true })
  assert.equal(Object.hasOwn(ordinary.encounter, 'finiteRefills'), false)
  for (const refillLimit of [0, 12, 18, 24, 96]) {
    const candidate = createCandidate('ANGER', seed, { refillLimit, includeRegenTile: true })
    assert.deepEqual(candidate, createCandidate('ANGER', seed, { refillLimit, includeRegenTile: true }))
    assert.equal(candidate.encounter.finiteRefills, true)
    assert.equal(candidate.encounter.refillQueue.length, refillLimit)
    assert.equal(candidate.encounter.refillQueue, ordinary.encounter.refillQueue.slice(0, refillLimit))
    assert.deepEqual(candidate.encounter.startingTiles, ordinary.encounter.startingTiles)
    assert.notEqual(candidate.id, ordinary.id)
    let state = createLetterStrikeGame(candidate.encounter)
    for (const [turn, ids] of candidate.construction.plannedTileIds.entries()) {
      const next = submitLetterStrike(state, ids)
      assert.equal(next.playedWords.length, state.playedWords.length + 1)
      assert.equal(next.playedWords.at(-1)?.preview.word, candidate.construction.plannedWords[turn])
      assert.ok(next.refillIndex <= refillLimit)
      state = next
    }
    for (const block of candidate.construction.refillBlocks) {
      assert.equal(candidate.encounter.refillQueue.slice(block.offset, block.offset + block.letters.length), block.letters)
      assert.ok(block.offset + block.letters.length <= refillLimit)
    }
  }
  assert.equal(createCandidate('ANGER', seed, { refillLimit: 96, startingResolve: 3 }).encounter.refillQueue.length, 96)
})

test('finite generation rejects invalid budgets and handles zero without silently supplying letters', () => {
  for (const refillLimit of [-1, 97, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createCandidate('ANGER', 'invalid-finite', { refillLimit }), /between 0 and 96/)
    assert.throws(() => generateForEnemy('XERO', 'invalid-finite', { refillLimit }), /between 0 and 96/)
  }
  const candidate = createCandidate('ANGER', 'finite-empty', { refillLimit: 0, includeRegenTile: true })
  const resolve = mutateCandidate(candidate, 'finite-resolve', { kind: 'resolve', allowResolveMutation: true })
  assert.equal(resolve.encounter.refillQueue, '')
  assert.equal(resolve.encounter.finiteRefills, true)
  assert.doesNotThrow(() => createLetterStrikeGame(resolve.encounter))
  assert.equal(mutateCandidate(candidate, 'empty-letter', { kind: 'refill-letter' }).encounter.refillQueue, '')
})

test('finite-only supply mutations change a bounded queue, invalidate old IDs and leave parents untouched', () => {
  const ordinary = createCandidate('ANGER', 'finite-mutation')
  assert.throws(() => mutateCandidate(ordinary, 'unlimited-length', { kind: 'refill-length' }), /finite encounter/)
  const candidate = createCandidate('ANGER', 'finite-mutation', { refillLimit: 18, includeRegenTile: true })
  const before = structuredClone(candidate)
  const lengths = new Set<number>()
  for (let index = 0; index < 8; index++) {
    const seed = `finite-length:${index}`
    const result = mutateCandidate(candidate, seed, { kind: 'refill-length' })
    assert.deepEqual(result, mutateCandidate(candidate, seed, { kind: 'refill-length' }))
    assert.equal(result.encounter.finiteRefills, true)
    assert.notEqual(result.encounter.refillQueue.length, 18)
    assert.ok(result.encounter.refillQueue.length >= 0 && result.encounter.refillQueue.length <= 96)
    assert.ok(result.encounter.refillQueue.startsWith(candidate.encounter.refillQueue)
      || candidate.encounter.refillQueue.startsWith(result.encounter.refillQueue))
    assert.deepEqual(result.construction.plannedTileIds, [])
    assert.doesNotThrow(() => createLetterStrikeGame(result.encounter))
    lengths.add(result.encounter.refillQueue.length)
  }
  assert.ok([...lengths].some(length => length < 18))
  assert.ok([...lengths].some(length => length > 18))
  assert.deepEqual(candidate, before)
})

test('a padded construction route is not inherited as a win after finite truncation', () => {
  const ordinary = createCandidate('MELANCHOLY', 'construction-test:0')
  const finite = { ...ordinary.encounter, finiteRefills: true as const, refillQueue: '' }
  assert.throws(() => createLetterStrikeGame(finite), /stale/)
  const result = solvePuzzle(withCompiledMeanings(finite), { maxStates: 0, hintLine: ordinary.construction.plannedTileIds })
  assert.notEqual(result.solvable, true)
  assert.deepEqual(result.winningLines, [])
})

function exhaustedSupplyGame() {
  return createLetterStrikeGame({
    ...letterStrikeEncounter, finiteRefills: true, refillQueue: '', grammarModifiers: {},
    enemy: { ...letterStrikeEncounter.enemy, semanticRelations: { opposite: [], similar: [], related: [] } },
    enemyLetters: [{ id: 'unmatched-z', letter: 'Z', initialHits: 1, hitsRemaining: 1 }],
    startingTiles: [...'CATDOG'.padEnd(16, 'Q')].map((letter, id) => ({ id, letter, type: 'normal' })),
  })
}

test('exhaustive losing proofs reach the root across moves with an unchanged finite refill index', () => {
  const initial = exhaustedSupplyGame()
  const afterCat = submitLetterStrike(initial, [0, 1, 2])
  const afterDog = submitLetterStrike(afterCat, [3, 4, 5])
  assert.equal(afterCat.status, 'playing')
  assert.equal(afterDog.status, 'lost')
  assert.ok(afterDog.playerResolve > 0, 'The second move loses by letter exhaustion, not lives.')
  assert.deepEqual([initial.refillIndex, afterCat.refillIndex, afterDog.refillIndex], [0, 0, 0])
  assert.deepEqual([initial.nextTileId, afterCat.nextTileId, afterDog.nextTileId], [16, 19, 22])

  const bounded = solvePuzzle(initial, { strategy: 'bfs', maxStates: 1 })
  assert.equal(bounded.status, 'unknown')
  assert.equal(bounded.solvable, null)
  const exhaustive = solvePuzzle(initial, { strategy: 'bfs', maxStates: 100 })
  assert.equal(exhaustive.status, 'impossible')
  assert.equal(exhaustive.solvable, false)
  assert.equal(exhaustive.exhaustive, true)
  assert.equal(exhaustive.vocabularyComplete, true)
  assert.equal(exhaustive.searchLimitReached, false)
  assert.ok(exhaustive.states.some(record => record.depth > 0 && record.state.status === 'playing'))
  assert.ok(exhaustive.states.every(record => record.state.refillIndex === 0 && record.canWin === false))
})

test('finite blank-cell snapshots survive JSON, undo restoration and exact turn replay', () => {
  const initial = exhaustedSupplyGame()
  const before = captureUndoSnapshot(initial)
  const afterCat = submitLetterStrike(initial, [0, 1, 2])
  const snapshot = captureUndoSnapshot(afterCat)
  const restored = restoreUndoSnapshot(JSON.parse(JSON.stringify(snapshot)))
  assert.deepEqual(restored, afterCat)
  assert.equal(restored.tiles.filter(tile => tile.letter === '').length, 3)
  assert.equal(restored.encounter.finiteRefills, true)
  assert.equal(restored.refillIndex, 0)
  assert.equal(restored.nextTileId, 19)
  assert.ok(Object.isFrozen(restored.tiles))
  assert.deepEqual(submitLetterStrike(restored, [3, 4, 5]), submitLetterStrike(afterCat, [3, 4, 5]))
  assert.deepEqual(restoreUndoSnapshot(before), initial)
  assert.deepEqual(submitLetterStrike(restoreUndoSnapshot(before), [0, 1, 2]), afterCat)
})
