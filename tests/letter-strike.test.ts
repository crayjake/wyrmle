import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clearLetterStrikeSelection, createLetterStrikeGame, evaluateLetterStrike,
  letterStrikeEncounter, previewLetterStrike, selectEnemyTarget,
  submitLetterStrike, toggleLetterStrikeTile,
} from '../src/experimental/letterStrike.ts'
import type { EnemyLetter, LetterStrikeGem, LetterStrikeState } from '../src/experimental/letterStrike.ts'

function wordIds(state: LetterStrikeState, word: string): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = state.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing ${letter} for ${word}`)
    ids.push(tile.id)
  }
  return ids
}

function letters(word: string, armour: number[] = []): EnemyLetter[] {
  return [...word].map((letter, index) => ({
    id: `target-${index}`, letter,
    hitsRemaining: armour.includes(index) ? 2 : 1,
    initialHits: armour.includes(index) ? 2 : 1,
  }))
}

function withWord(word: string, specials: Record<number, LetterStrikeGem> = {}): LetterStrikeState {
  const state = createLetterStrikeGame()
  return {
    ...state,
    tiles: [...word.padEnd(16, 'Z')].map((letter, id) => ({
      id, letter, type: specials[id] ? 'gem' : 'normal',
      ...(specials[id] ? { gem: specials[id] } : {}),
    })),
    selectedTileIds: [...word].map((_, index) => index),
  }
}

test('letter-strike fixture is isolated, deterministic, and owns each enemy letter', () => {
  const state = createLetterStrikeGame()
  assert.equal(state.tiles.map(tile => tile.letter).join(''), 'JOYCHEERGLOOMADS')
  assert.deepEqual(state.tiles.filter(tile => tile.gem).map(tile => [tile.id, tile.gem]), [[2, 'ward'], [9, 'strike']])
  assert.equal(state.playerResolve, 5)
  assert.equal('enemyHp' in state, false)
  assert.equal(new Set(state.enemyLetters.map(letter => letter.id)).size, 10)
  assert.deepEqual(state.enemyLetters.filter(letter => letter.initialHits === 2).map(letter => letter.letter), ['M', 'Y'])
  assert.notEqual(state.enemyLetters[0], letterStrikeEncounter.enemyLetters[0])
  assert.deepEqual(state, createLetterStrikeGame())
})

test('COUNTER strikes each matching living letter and spends exactly one Resolve', () => {
  const state = createLetterStrikeGame()
  const ids = wordIds(state, 'CHEER')
  const preview = previewLetterStrike(state, ids)
  assert.equal(preview.semanticLabel, 'COUNTER')
  assert.equal(preview.valid, true)
  assert.equal(preview.strikes, 3)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['C', 'H', 'E'])
  const next = submitLetterStrike(state, ids)
  assert.equal(next.playerResolve, 4)
  assert.deepEqual(next.enemyLetters.filter(letter => letter.hitsRemaining === 0).map(letter => letter.letter), ['E', 'C', 'H'])
})

test('NEUTRAL strikes only the first eligible match in player word order', () => {
  for (const [word, first] of [['ALERT', 'A'], ['LATER', 'L'], ['REAL', 'E']]) {
    const preview = previewLetterStrike(withWord(word))
    assert.equal(preview.valid, true)
    assert.equal(preview.semanticLabel, 'NEUTRAL')
    assert.equal(preview.strikes, 1)
    assert.equal(preview.hits[0].letter, first)
  }
})

test('neutral words with no living matches remain valid zero-strike moves', () => {
  const state = { ...withWord('DOG'), enemyLetters: letters('XYZ') }
  const next = submitLetterStrike(state)
  assert.equal(next.error, null)
  assert.equal(next.playedWords[0].strikes, 0)
  assert.equal(next.playerResolve, 4)
  assert.equal(next.refillIndex, 3)
})

test('RESISTED has no normal strikes while related words are NEUTRAL', () => {
  for (const word of ['SAD', 'GLOOM', 'SORROW']) {
    const preview = previewLetterStrike(withWord(word))
    assert.equal(preview.semanticLabel, 'RESISTED')
    assert.equal(preview.strikes, 0)
  }
  const related = previewLetterStrike(withWord('MOOD'))
  assert.equal(related.semanticLabel, 'NEUTRAL')
  assert.equal(related.strikes, 1)
})

test('the actual STRIKE tile works in a resisted word', () => {
  const state = createLetterStrikeGame()
  const preview = previewLetterStrike(state, wordIds(state, 'GLOOM'))
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.strikes, 1)
  assert.equal(preview.hits[0].letter, 'L')
  assert.deepEqual(preview.effectLabels, ['STRIKE'])
})

test('STRIKE does not double-hit on a counter, including an armoured target', () => {
  const state = { ...withWord('JOY', { 2: 'strike' }), enemyLetters: letters('Y', [0]) }
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 1)
  assert.equal(preview.enemyLetters[0].hitsRemaining, 1)
})

test('normal neutral strike and STRIKE on its first matching tile merge into one hit', () => {
  const state = { ...withWord('ALERT', { 0: 'strike' }), enemyLetters: letters('AL', [0]) }
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 1)
  assert.equal(preview.enemyLetters[0].hitsRemaining, 1)
  assert.equal(preview.enemyLetters[1].hitsRemaining, 1)
})

test('multiple Strike tiles each hit at most once and supplement a neutral normal strike', () => {
  const resisted = { ...withWord('GLOOM', { 1: 'strike', 2: 'strike', 3: 'strike' }), enemyLetters: letters('LOO') }
  assert.equal(previewLetterStrike(resisted).strikes, 3)
  const neutral = { ...withWord('ALERT', { 1: 'strike', 2: 'strike' }), enemyLetters: letters('ALE') }
  assert.equal(previewLetterStrike(neutral).strikes, 3)
})

test('WARD prevents Resolve loss, does not stack, and does not change strikes', () => {
  const state = createLetterStrikeGame()
  const preview = previewLetterStrike(state, wordIds(state, 'JOY'))
  assert.equal(preview.strikes, 2) // Enemy MELANCHOLY has O and Y, but no J.
  assert.equal(preview.resolveCost, 0)
  assert.deepEqual(preview.effectLabels, ['WARD'])
  assert.equal(submitLetterStrike(state, wordIds(state, 'JOY')).playerResolve, 5)
  const wards = previewLetterStrike(withWord('CHEER', { 0: 'ward', 1: 'ward' }))
  assert.equal(wards.strikes, 3)
  assert.equal(wards.resolveCost, 0)
  assert.deepEqual(wards.effectLabels, ['WARD'])
})

test('special effects are taken from encounter rules rather than gem labels', () => {
  const initial = withWord('SAD', { 0: 'strike', 1: 'ward' })
  const state = {
    ...initial,
    encounter: { ...initial.encounter, tileEffects: {
      strike: { strike: false, preventResolveLoss: true },
      ward: { strike: true, preventResolveLoss: false },
    } },
  }
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 1)
  assert.equal(preview.hits[0].letter, 'A')
  assert.equal(preview.resolveCost, 0)
  assert.deepEqual(preview.effectLabels, ['STRIKE', 'WARD'])
})

test('armour survives the first hit and the second removes the same letter', () => {
  const initial = { ...withWord('MERRY'), enemyLetters: letters('M', [0]) }
  const first = submitLetterStrike(initial)
  assert.equal(first.enemyLetters[0].hitsRemaining, 1)
  assert.equal(first.status, 'playing')
  const secondInput = { ...withWord('MERRY'), enemyLetters: first.enemyLetters }
  const second = submitLetterStrike(secondInput)
  assert.equal(second.enemyLetters[0].hitsRemaining, 0)
  assert.equal(second.status, 'won')
})

test('distinct submitted tiles can finish the same armoured letter within one counter', () => {
  const state = { ...withWord('CHEER'), enemyLetters: letters('E', [0]) }
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.hits.map(hit => [hit.hitsBefore, hit.hitsAfter]), [[2, 1], [1, 0]])
  assert.equal(new Set(preview.hits.map(hit => hit.tileId)).size, 2)
  assert.equal(preview.enemyLetters[0].hitsRemaining, 0)
})

test('duplicate targets prefer wounded armour then stable left-to-right living slots', () => {
  const targets = letters('LLL', [1])
  targets[1].hitsRemaining = 1
  assert.equal(selectEnemyTarget(targets, 'L')?.id, 'target-1')
  targets[1].hitsRemaining = 0
  assert.equal(selectEnemyTarget(targets, 'l')?.id, 'target-0')
  targets[0].hitsRemaining = 0
  assert.equal(selectEnemyTarget(targets, 'L')?.id, 'target-2')
  targets[2].hitsRemaining = 0
  assert.equal(selectEnemyTarget(targets, 'L'), undefined)
})

test('removed letters cannot be hit and dead slots retain their identity and position', () => {
  const targets = letters('CEH')
  targets[0].hitsRemaining = 0
  const preview = previewLetterStrike({ ...withWord('CHEER'), enemyLetters: targets })
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.enemyLetters.map(letter => [letter.id, letter.letter]), targets.map(letter => [letter.id, letter.letter]))
  assert.equal(preview.hits.some(hit => hit.enemyLetterId === 'target-0'), false)
})

test('victory requires every enemy letter removed and wins on the last Resolve', () => {
  const state = { ...withWord('CHEER'), enemyLetters: letters('CHE'), playerResolve: 1 }
  const won = submitLetterStrike(state)
  assert.equal(won.playerResolve, 0)
  assert.equal(won.status, 'won')
  assert.ok(won.enemyLetters.every(letter => letter.hitsRemaining === 0))
  const lost = submitLetterStrike({ ...state, enemyLetters: letters('CHEM') })
  assert.equal(lost.status, 'lost')
  assert.equal(lost.playerResolve, 0)
  assert.ok(lost.enemyLetters.some(letter => letter.hitsRemaining > 0))
})

test('selection is ordered, ignores unknown IDs, and Clear leaves the encounter intact', () => {
  let state = createLetterStrikeGame()
  for (const id of [13, 9, 5]) state = toggleLetterStrikeTile(state, id)
  assert.equal(previewLetterStrike(state).word, 'ALE')
  assert.deepEqual(toggleLetterStrikeTile(state, 9).selectedTileIds, [13, 5])
  assert.equal(toggleLetterStrikeTile(state, 999), state)
  assert.deepEqual(clearLetterStrikeSelection(state), { ...state, selectedTileIds: [], error: null })
})

test('invalid words, duplicate IDs, and unknown IDs spend nothing or consume specials', () => {
  const state = createLetterStrikeGame()
  const before = structuredClone(state)
  for (const ids of [[], [0], [0, 2, 3], [3, 4, 5, 5, 7], [0, 1, 999]]) {
    const preview = previewLetterStrike(state, ids)
    assert.equal(preview.valid, false)
    assert.equal(preview.strikes, 0)
    assert.equal(preview.resolveCost, 0)
    assert.deepEqual(preview.effectLabels, [])
    assert.deepEqual(preview.hits, [])
    assert.deepEqual(preview.enemyLetters, state.enemyLetters)
    const next = submitLetterStrike(state, ids)
    assert.ok(next.error)
    assert.deepEqual({ ...next, error: null }, state)
  }
  assert.deepEqual(state, before)
})

test('scoring a duplicate physical tile directly never creates an extra armour hit', () => {
  const state = { ...withWord('CHEER'), enemyLetters: letters('E', [0]) }
  const tile = state.tiles[2]
  const counter = { ...state, encounter: { ...state.encounter, enemy: {
    ...state.encounter.enemy, semanticRelations: { ...state.encounter.enemy.semanticRelations, opposite: ['EE'] },
  } } }
  assert.equal(evaluateLetterStrike(counter, [tile, tile]).strikes, 1)
})

test('preview matches submitted hits and Resolve, with no mutation of frozen input', () => {
  for (const word of ['JOY', 'CHEER', 'GLOOM', 'SAD', 'DASH']) {
    const state = createLetterStrikeGame()
    const ids = wordIds(state, word)
    const before = structuredClone(state)
    Object.freeze(state)
    Object.freeze(state.tiles)
    Object.freeze(state.enemyLetters)
    Object.freeze(state.playedWords)
    state.tiles.forEach(Object.freeze)
    state.enemyLetters.forEach(Object.freeze)
    const preview = previewLetterStrike(state, ids)
    const next = submitLetterStrike(state, ids)
    const hitsSpent = state.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)
      - next.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)
    assert.equal(hitsSpent, preview.strikes, word)
    assert.equal(state.playerResolve - next.playerResolve, preview.resolveCost, word)
    assert.deepEqual(next.playedWords[0].preview, preview)
    assert.deepEqual(next.enemyLetters, preview.enemyLetters)
    assert.deepEqual(state, before)
  }
})

test('refills consume special identity once and preserve unselected board positions', () => {
  const state = createLetterStrikeGame()
  const ids = wordIds(state, 'JOY')
  const next = submitLetterStrike(state, ids)
  assert.equal(next.refillIndex, 3)
  assert.equal(next.nextTileId, 19)
  assert.deepEqual(next.tiles.slice(0, 3), [
    { id: 16, letter: 'R', type: 'normal' },
    { id: 17, letter: 'Y', type: 'normal' },
    { id: 18, letter: 'E', type: 'normal' },
  ])
  assert.equal(next.tiles.some(tile => tile.gem === 'ward'), false)
  assert.equal(next.tiles[9].gem, 'strike')
  for (let index = 3; index < 16; index += 1) assert.equal(next.tiles[index], state.tiles[index])
  assert.deepEqual(next, submitLetterStrike(state, ids))
})

test('finished encounters lock selection, previews, clear, and submission', () => {
  for (const status of ['won', 'lost'] as const) {
    const state = { ...createLetterStrikeGame(), status }
    assert.equal(toggleLetterStrikeTile(state, 0), state)
    assert.equal(clearLetterStrikeSelection(state), state)
    assert.equal(submitLetterStrike(state, [0, 1, 2]), state)
    assert.equal(previewLetterStrike(state, [0, 1, 2]).valid, false)
  }
})

test('the deterministic fixture has a playable six-move victory using Ward and Strike', () => {
  let state = createLetterStrikeGame()
  const route = [
    [0, 1, 2], // JOY: O and the first Y hit, Ward saves Resolve.
    [12, 5, 7, 16, 17], // MERRY: first M hit, E, and the second Y hit.
    [3, 4, 6, 18, 19], // CHEER: C and H.
    [20, 21, 13, 23, 25, 14], // ELATED: normal L and A; preserve Strike L.
    [24, 10, 9, 27], // MOLD: normal M then Strike L.
    [26, 22, 8], // NAG: the last N, on the final Resolve.
  ]
  for (const ids of route) {
    const preview = previewLetterStrike(state, ids)
    assert.equal(preview.valid, true, `${preview.word}: ${preview.error}`)
    state = submitLetterStrike(state, ids)
  }
  assert.deepEqual(state.playedWords.map(move => move.word), ['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
  assert.deepEqual(state.playedWords.map(move => move.strikes), [2, 3, 2, 2, 2, 1])
  assert.equal(state.playerResolve, 0)
  assert.equal(state.status, 'won')
  assert.ok(state.enemyLetters.every(letter => letter.hitsRemaining === 0))
})
