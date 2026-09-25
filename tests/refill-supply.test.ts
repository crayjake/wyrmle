import assert from 'node:assert/strict'
import test from 'node:test'
import { letterStrikeEncounter } from '../src/game/letterStrike.ts'
import { describeRefillGroups, getRefillGroups } from '../src/components/refillSupply.ts'

test('finite refill counts follow the real cursor and distinct surviving letters, retaining zero copies', () => {
  const encounter = { ...letterStrikeEncounter, finiteRefills: true as const, refillQueue: 'XYAAXE' }
  const enemyLetters = [...'AABE'].map((letter, id) => ({ id: String(id), letter, initialHits: 1, hitsRemaining: 1 }))
  const groups = getRefillGroups({ encounter, enemyLetters, refillIndex: 2 })!
  assert.deepEqual(groups, [{ letter: null, count: 1 }, { letter: 'A', count: 2 }, { letter: 'B', count: 0 }, { letter: 'E', count: 1 }])
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), encounter.refillQueue.length - 2)
  assert.deepEqual(getRefillGroups({ encounter: { ...encounter, refillQueue: 'xYaAxE' }, enemyLetters, refillIndex: 2 }), groups)
  assert.match(describeRefillGroups(groups), /B 0/)
  assert.match(describeRefillGroups(groups), /reserve copies, not the next draw order/)

  const exhausted = getRefillGroups({ encounter, enemyLetters, refillIndex: encounter.refillQueue.length })!
  assert.deepEqual(exhausted.map(group => group.count), [0, 0, 0, 0])
})

test('defeated letter copies join the blank group and reappear when Revive restores that letter', () => {
  const encounter = { ...letterStrikeEncounter, finiteRefills: true as const, refillQueue: 'AABE' }
  const enemyLetters = [...'AE'].map((letter, id) => ({ id: String(id), letter, initialHits: 1, hitsRemaining: letter === 'A' ? 0 : 1 }))
  assert.deepEqual(getRefillGroups({ encounter, enemyLetters, refillIndex: 0 }), [
    { letter: null, count: 3 }, { letter: 'E', count: 1 },
  ])
  enemyLetters[0].hitsRemaining = 1
  assert.deepEqual(getRefillGroups({ encounter, enemyLetters, refillIndex: 0 }), [
    { letter: null, count: 1 }, { letter: 'A', count: 2 }, { letter: 'E', count: 1 },
  ])
  assert.equal(getRefillGroups({ encounter: letterStrikeEncounter, enemyLetters, refillIndex: 0 }), null)
})
