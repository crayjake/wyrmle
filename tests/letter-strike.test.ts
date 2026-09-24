import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clearLetterStrikeSelection, createLetterStrikeGame as createCurrentPrototype, evaluateLetterStrike,
  previewLetterStrike, selectEnemyTarget,
  submitLetterStrike, toggleLetterStrikeTile,
} from '../src/game/letterStrike.ts'
import type { EnemyLetter, LetterStrikeGem, LetterStrikeState } from '../src/game/letterStrike.ts'
import { createHistoricalBoardGame as createLetterStrikeGame, historicalBoardEncounter as letterStrikeEncounter } from './letter-strike-fixture.ts'
import { getPartsOfSpeech, prototypeWordPartsOfSpeech } from '../src/game/dictionary.ts'

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

function withLongWord(word: string, specials: Record<number, LetterStrikeGem> = {}): LetterStrikeState {
  const state = withWord(word, specials)
  return { ...state, encounter: { ...state.encounter, longWordRule: { minimumLength: 6, bonusStrikes: 1 }, wordPartsOfSpeech: prototypeWordPartsOfSpeech } }
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
    const state = withWord(word)
    const preview = previewLetterStrike({ ...state, encounter: { ...state.encounter, grammarModifiers: undefined } })
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

test('LAD preserves its neutral allowance after the actual Strike L, in preview and submission', () => {
  const state = createLetterStrikeGame()
  const ids = wordIds(state, 'LAD')
  const before = structuredClone(state)
  const preview = previewLetterStrike(state, ids)
  assert.equal(preview.semanticLabel, 'NEUTRAL')
  assert.equal(preview.grammaticalModifier, 0)
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.hits.map(hit => [hit.tileId, hit.letter]), [[9, 'L'], [13, 'A']])
  assert.deepEqual(preview.effectLabels, ['STRIKE'])
  const submitted = submitLetterStrike(state, ids)
  assert.deepEqual(submitted.enemyLetters, preview.enemyLetters)
  assert.deepEqual(submitted.playedWords[0].preview.hits, preview.hits)
  assert.equal(submitted.playerResolve, 4)
  assert.equal(submitted.tiles.some(tile => tile.id === 9), false)
  assert.deepEqual(state, before)
})

test('Strike tiles before or after the normal neutral hit preserve the allowance', () => {
  for (const strikeIndex of [0, 1]) {
    const state = { ...withWord('ALERT', { [strikeIndex]: 'strike' }), enemyLetters: letters('AL', [0]) }
    const preview = previewLetterStrike(state)
    assert.equal(preview.strikes, 2)
    assert.deepEqual(preview.hits.map(hit => hit.letter), ['A', 'L'])
    assert.equal(preview.enemyLetters[0].hitsRemaining, 1)
    assert.equal(preview.enemyLetters[1].hitsRemaining, 0)
  }
})

test('an unmatched Strike leaves the neutral allowance for a living matching tile', () => {
  const state = { ...withWord('LAD', { 0: 'strike' }), enemyLetters: letters('A') }
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['A'])
  assert.deepEqual(preview.effectLabels, [])
})

test('a lone matched Strike cannot reuse its tile to spend the remaining neutral allowance', () => {
  const state = { ...withWord('LAD', { 0: 'strike' }), enemyLetters: letters('L', [0]) }
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.hits.map(hit => [hit.hitsBefore, hit.hitsAfter]), [[2, 1]])
})

test('Strike followed by a separate neutral tile can break and remove the same armour', () => {
  const state = { ...withWord('EEL', { 0: 'strike' }), enemyLetters: letters('E', [0]) }
  const preview = previewLetterStrike(state)
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.hits.map(hit => [hit.tileId, hit.hitsBefore, hit.hitsAfter]), [[0, 2, 1], [1, 1, 0]])
  assert.equal(preview.letterOutcomes[0].armourBroken, true)
  assert.equal(preview.letterOutcomes[0].removed, true)
  assert.deepEqual(submitLetterStrike(state).enemyLetters, preview.enemyLetters)
})

test('archived encounters explicitly preserve the original overlapping Strike allowance', () => {
  const state = createLetterStrikeGame()
  const archived = { ...state, encounter: { ...state.encounter, strikeConsumesAllowance: true } }
  const preview = previewLetterStrike(archived, wordIds(archived, 'LAD'))
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['L'])
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

test('predicted target IDs and final armour outcomes exactly match submitted enemy slots', () => {
  const targets = letters('CEEH', [1])
  targets[3].hitsRemaining = 0
  const state = { ...withWord('CHEER'), enemyLetters: targets }
  const preview = previewLetterStrike(state)
  assert.deepEqual(preview.hits.map(hit => hit.enemyLetterId), ['target-0', 'target-1', 'target-1'])
  assert.deepEqual(preview.hits.map(hit => [hit.hitsBefore, hit.hitsAfter]), [[1, 0], [2, 1], [1, 0]])
  const projectedHits = new Map(state.enemyLetters.map(letter => [letter.id, letter.hitsRemaining]))
  for (const hit of preview.hits) {
    assert.equal(projectedHits.get(hit.enemyLetterId), hit.hitsBefore)
    projectedHits.set(hit.enemyLetterId, hit.hitsAfter)
  }
  const submitted = submitLetterStrike(state)
  assert.deepEqual(submitted.enemyLetters.map(letter => [letter.id, letter.hitsRemaining]), [...projectedHits])
  assert.deepEqual(submitted.enemyLetters, preview.enemyLetters)
  assert.deepEqual(submitted.enemyLetters.map(letter => [letter.id, letter.letter]), targets.map(letter => [letter.id, letter.letter]))
  assert.equal(submitted.enemyLetters[2].hitsRemaining, 1)
  assert.equal(submitted.enemyLetters[3].hitsRemaining, 0)
})

test('an untriggered Strike tile adds no preview or recorded effect label', () => {
  const state = { ...withWord('GLOOM', { 1: 'strike' }), enemyLetters: letters('A') }
  const preview = previewLetterStrike(state)
  assert.equal(preview.valid, true)
  assert.equal(preview.strikes, 0)
  assert.deepEqual(preview.effectLabels, [])
  const submitted = submitLetterStrike(state)
  assert.deepEqual(submitted.playedWords[0].effectLabels, [])
  assert.equal(submitted.playerResolve, 4)
})

test('dead and invalid targets never produce preview hits or actionable outcomes', () => {
  const targets = letters('CHE')
  targets.forEach(letter => { letter.hitsRemaining = 0 })
  const state = { ...withWord('CHEER', { 0: 'strike' }), enemyLetters: targets }
  const deadPreview = previewLetterStrike(state)
  assert.equal(deadPreview.valid, true)
  assert.equal(deadPreview.strikes, 0)
  assert.deepEqual(deadPreview.hits, [])
  assert.deepEqual(deadPreview.effectLabels, [])
  assert.deepEqual(deadPreview.enemyLetters, targets)
  for (const ids of [[], [0], [0, 0, 0], [999]]) {
    const preview = previewLetterStrike(state, ids)
    assert.equal(preview.valid, false)
    assert.equal(preview.resolveCost, 0)
    assert.deepEqual(preview.hits, [])
    assert.deepEqual(preview.enemyLetters, targets)
  }
})

test('encounter adjective weakness grants resisted one and neutral two matching strikes', () => {
  const resisted = previewLetterStrike(withWord('SAD'))
  assert.equal(resisted.semanticLabel, 'RESISTED')
  assert.equal(resisted.grammaticalPartOfSpeech, 'adjective')
  assert.equal(resisted.grammaticalModifier, 1)
  assert.deepEqual(resisted.hits.map(hit => hit.letter), ['A'])
  const neutral = previewLetterStrike(withWord('GLAD'))
  assert.equal(neutral.semanticLabel, 'NEUTRAL')
  assert.equal(neutral.grammaticalModifier, 1)
  assert.deepEqual(neutral.hits.map(hit => hit.letter), ['L', 'A'])
  const unrelatedNoun = withWord('GLAD')
  unrelatedNoun.encounter = { ...unrelatedNoun.encounter, grammarModifiers: undefined }
  assert.equal(previewLetterStrike(unrelatedNoun).strikes, 1)
})

test('grammar never creates unmatched hits or surplus counter strikes', () => {
  const happy = previewLetterStrike(withWord('HAPPY'))
  assert.equal(happy.semanticLabel, 'COUNTER')
  assert.equal(happy.strikes, 3)
  assert.equal(happy.grammaticalModifier, 0)
  assert.equal(happy.grammaticalPartOfSpeech, null)
  const noTargets = previewLetterStrike({ ...withWord('GLAD'), enemyLetters: letters('XYZ') })
  assert.equal(noTargets.grammaticalModifier, 1)
  assert.equal(noTargets.strikes, 0)
})

test('ambiguous and unknown parts of speech never infer grammatical bonuses', () => {
  for (const word of ['CALM', 'BLUE', 'ALERT']) {
    const preview = previewLetterStrike(withWord(word))
    assert.equal(preview.valid, true)
    assert.equal(preview.grammaticalModifier, 0, word)
    assert.equal(preview.grammaticalPartOfSpeech, null, word)
  }
})

test('Strike tiles preserve grammar and semantic allowances regardless of their order', () => {
  const neutral = { ...withWord('GLAD', { 1: 'strike', 3: 'strike' }), enemyLetters: letters('LAD') }
  const preview = previewLetterStrike(neutral)
  assert.equal(preview.strikes, 3)
  assert.deepEqual(preview.hits.map(hit => hit.tileId), [1, 2, 3])
  const resisted = { ...withWord('SAD', { 0: 'strike' }), enemyLetters: letters('SA') }
  assert.equal(previewLetterStrike(resisted).strikes, 2)
  const laterStrike = { ...withWord('SAD', { 1: 'strike' }), enemyLetters: letters('SA') }
  assert.equal(previewLetterStrike(laterStrike).strikes, 2)
  const neutralGrammar = { ...withWord('GLAD', { 1: 'strike' }), enemyLetters: letters('LAD') }
  assert.deepEqual(previewLetterStrike(neutralGrammar).hits.map(hit => hit.letter), ['L', 'A', 'D'])
})

test('negative grammar reduces normal allowances without blocking matching Strike tiles', () => {
  const state = withWord('GLAD', { 1: 'strike' })
  state.encounter = { ...state.encounter, grammarModifiers: { adjective: -1 } }
  const preview = previewLetterStrike(state)
  assert.equal(preview.grammaticalModifier, -1)
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.effectLabels, ['STRIKE'])
  const happy = withWord('HAPPY')
  happy.encounter = { ...happy.encounter, grammarModifiers: { adjective: -1 } }
  assert.deepEqual(previewLetterStrike(happy).hits.map(hit => hit.letter), ['H', 'A'])
  const resisted = withWord('SAD')
  resisted.encounter = { ...resisted.encounter, grammarModifiers: { adjective: -5 } }
  assert.equal(previewLetterStrike(resisted).strikes, 0)
  assert.equal(previewLetterStrike(resisted).grammaticalModifier, 0)
})

test('per-position outcomes distinguish untouched, broken, removed, and broken plus removed', () => {
  const state = { ...withWord('CHEER'), enemyLetters: letters('CEHXY', [1, 2]) }
  state.enemyLetters[4].hitsRemaining = 0
  const preview = previewLetterStrike(state)
  assert.deepEqual(preview.letterOutcomes, [
    { enemyLetterId: 'target-0', position: 0, hitsBefore: 1, hitsAfter: 0, armourBroken: false, removed: true },
    { enemyLetterId: 'target-1', position: 1, hitsBefore: 2, hitsAfter: 0, armourBroken: true, removed: true },
    { enemyLetterId: 'target-2', position: 2, hitsBefore: 2, hitsAfter: 1, armourBroken: true, removed: false },
    { enemyLetterId: 'target-3', position: 3, hitsBefore: 1, hitsAfter: 1, armourBroken: false, removed: false },
    { enemyLetterId: 'target-4', position: 4, hitsBefore: 0, hitsAfter: 0, armourBroken: false, removed: false },
  ])
  const next = submitLetterStrike(state)
  assert.deepEqual(next.playedWords[0].preview.letterOutcomes, preview.letterOutcomes)
  assert.deepEqual(next.enemyLetters.map(letter => letter.hitsRemaining), preview.letterOutcomes.map(outcome => outcome.hitsAfter))
  const invalid = previewLetterStrike(state, [])
  assert.ok(invalid.letterOutcomes.every(outcome => !outcome.armourBroken && !outcome.removed && outcome.hitsBefore === outcome.hitsAfter))
})

test('authored armour has exactly two hits so every turn fits the supported outcome states', () => {
  const encounter = { ...letterStrikeEncounter, enemyLetters: [{ id: 'thick', letter: 'E', initialHits: 3, hitsRemaining: 3 }] }
  assert.throws(() => createLetterStrikeGame(encounter), /one or two/)
})

test('short neutral words keep one normal strike while six-letter neutrals gain LONG', () => {
  for (const word of ['LAD', 'HEAR', 'ALERT']) {
    const preview = previewLetterStrike(withLongWord(word))
    assert.equal(preview.valid, true, word)
    assert.equal(preview.semanticLabel, 'NEUTRAL', word)
    assert.equal(preview.longWordModifier, 0, word)
    assert.equal(preview.strikes, 1, word)
  }
  for (const [word, targets] of [['CLOSET', ['C', 'L']], ['THREAD', ['H', 'E']]] as const) {
    const preview = previewLetterStrike(withLongWord(word))
    assert.equal(preview.valid, true)
    assert.equal(preview.longWordModifier, 1)
    assert.equal(preview.grammaticalModifier, 0)
    assert.deepEqual(preview.hits.map(hit => hit.letter), targets)
  }
})

test('LONG is opt-in encounter data and does not change archived neutral allowances', () => {
  assert.equal(previewLetterStrike(withWord('CLOSET')).strikes, 1)
  assert.equal(previewLetterStrike(withWord('CLOSET')).longWordModifier, 0)
  const state = withLongWord('CLOSET')
  state.encounter = { ...state.encounter, longWordRule: { minimumLength: 7, bonusStrikes: 1 } }
  assert.equal(previewLetterStrike(state).strikes, 1)
  state.encounter = { ...state.encounter, longWordRule: { minimumLength: 6, bonusStrikes: 2 } }
  assert.equal(previewLetterStrike(state).strikes, 3)
  assert.equal(previewLetterStrike(state).longWordModifier, 2)
})

test('long resisted words receive no LONG, while counters still strike all matches', () => {
  for (const word of ['SORROW', 'SADNESS']) {
    const preview = previewLetterStrike(withLongWord(word))
    assert.equal(preview.valid, true, word)
    assert.equal(preview.semanticLabel, 'RESISTED')
    assert.equal(preview.longWordModifier, 0)
    assert.equal(preview.strikes, 0)
  }
  const counter = previewLetterStrike(withLongWord('DELIGHT'))
  assert.equal(counter.semanticLabel, 'COUNTER')
  assert.equal(counter.longWordModifier, 0)
  assert.deepEqual(counter.hits.map(hit => hit.letter), ['E', 'L', 'H'])
})

test('LONG and adjective weakness stack with independent Strike and Ward effects', () => {
  const normal = previewLetterStrike(withLongWord('LONELY'))
  assert.equal(normal.semanticLabel, 'NEUTRAL')
  assert.equal(normal.longWordModifier, 1)
  assert.equal(normal.grammaticalModifier, 1)
  assert.deepEqual(normal.hits.map(hit => hit.letter), ['L', 'O', 'N'])
  const state = withLongWord('LONELY', { 0: 'strike', 3: 'ward' })
  const preview = previewLetterStrike(state)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['L', 'O', 'N', 'E'])
  assert.deepEqual(preview.effectLabels, ['STRIKE', 'WARD'])
  assert.equal(preview.resolveCost, 0)
  const submitted = submitLetterStrike(state)
  assert.equal(submitted.playerResolve, state.playerResolve)
  assert.deepEqual(submitted.playedWords[0].preview, preview)
  const resisted = previewLetterStrike(withLongWord('SADNESS', { 1: 'strike' }))
  assert.equal(resisted.longWordModifier, 0)
  assert.equal(resisted.strikes, 1)
})

test('LONG never creates unmatched strikes or hits beyond available physical tiles', () => {
  const noTargets = { ...withLongWord('CLOSET'), enemyLetters: letters('Y') }
  assert.equal(previewLetterStrike(noTargets).strikes, 0)
  const oneMatch = { ...withLongWord('CLOSET'), enemyLetters: letters('C', [0]) }
  const preview = previewLetterStrike(oneMatch)
  assert.equal(preview.strikes, 1)
  assert.equal(preview.enemyLetters[0].hitsRemaining, 1)
  const deadTargets = { ...withLongWord('CLOSET'), enemyLetters: letters('CL') }
  deadTargets.enemyLetters.forEach(letter => { letter.hitsRemaining = 0 })
  assert.equal(previewLetterStrike(deadTargets).strikes, 0)
})

test('long neutral target order follows spelling order for the same available tiles', () => {
  const state = withLongWord('THREAD')
  const thread = previewLetterStrike(state)
  const dearth = previewLetterStrike(state, wordIds(state, 'DEARTH'))
  assert.deepEqual(thread.hits.map(hit => hit.letter), ['H', 'E'])
  assert.deepEqual(dearth.hits.map(hit => hit.letter), ['E', 'A'])
})

test('invalid long words never expose an actionable LONG bonus or spend resources', () => {
  const state = withLongWord('QZXQZX')
  const preview = previewLetterStrike(state)
  assert.equal(preview.valid, false)
  assert.equal(preview.longWordModifier, 0)
  assert.equal(preview.strikes, 0)
  assert.equal(preview.resolveCost, 0)
  assert.deepEqual({ ...submitLetterStrike(state), error: null }, state)
})

test('prototype anchor words have explicit deterministic part-of-speech data', () => {
  assert.deepEqual(prototypeWordPartsOfSpeech.SAD, ['adjective'])
  assert.deepEqual(prototypeWordPartsOfSpeech.GLAD, ['adjective'])
  assert.deepEqual(prototypeWordPartsOfSpeech.GLOOM, ['noun'])
  assert.deepEqual(prototypeWordPartsOfSpeech.JOY, ['noun'])
  assert.deepEqual(prototypeWordPartsOfSpeech.CHEER, ['noun', 'verb'])
  assert.deepEqual(prototypeWordPartsOfSpeech.CLOSET, ['noun'])
  assert.deepEqual(prototypeWordPartsOfSpeech.THREAD, ['noun', 'verb'])
})

test('SANDY is a prototype adjective while archived encounters retain unknown POS behavior', () => {
  const preview = previewLetterStrike(withLongWord('SANDY'))
  assert.equal(preview.semanticLabel, 'NEUTRAL')
  assert.equal(preview.grammaticalPartOfSpeech, 'adjective')
  assert.equal(preview.grammaticalModifier, 1)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['A', 'N'])
  assert.equal(preview.longWordModifier, 0)
  assert.equal(getPartsOfSpeech('SANDY'), undefined)
  assert.equal(previewLetterStrike(withWord('SANDY')).strikes, 1)
})

test('GAY counters only when authored as an opposite and never gains surplus adjective hits', () => {
  const state = withLongWord('GAY')
  state.encounter = { ...state.encounter, enemy: { ...state.encounter.enemy, semanticRelations: {
    ...state.encounter.enemy.semanticRelations, opposite: [...state.encounter.enemy.semanticRelations.opposite, 'GAY'],
  } } }
  const preview = previewLetterStrike(state)
  assert.equal(preview.semanticLabel, 'COUNTER')
  assert.equal(preview.grammaticalModifier, 0)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['A', 'Y'])
  assert.equal(getPartsOfSpeech('GAY'), undefined)
})

test('encounter POS annotations override historic ambiguity without mutating the global lookup', () => {
  const state = withLongWord('GLOOM')
  state.encounter = { ...state.encounter, grammarModifiers: { noun: 1 } }
  const preview = previewLetterStrike(state)
  assert.equal(preview.grammaticalPartOfSpeech, 'noun')
  assert.equal(preview.strikes, 1)
  assert.deepEqual(getPartsOfSpeech('GLOOM'), ['noun', 'verb'])
  assert.deepEqual(getPartsOfSpeech('JOY'), ['noun', 'verb'])
  assert.equal(getPartsOfSpeech('CLOSET'), undefined)
  assert.equal(getPartsOfSpeech('THREAD'), undefined)
  const ambiguous = withLongWord('THREAD')
  ambiguous.encounter = { ...ambiguous.encounter, grammarModifiers: { noun: 2 } }
  assert.equal(previewLetterStrike(ambiguous).grammaticalModifier, 0)
})

test('current GLOOMY is resisted adjective with independent Strike and no LONG allowance', () => {
  const state = createCurrentPrototype()
  const selected = wordIds(state, 'GLOOMY')
  const preview = previewLetterStrike(state, selected)
  assert.equal(preview.valid, true)
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.grammaticalPartOfSpeech, 'adjective')
  assert.equal(preview.grammaticalModifier, 1)
  assert.equal(preview.longWordModifier, 0)
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['L', 'O'])
  assert.deepEqual(preview.effectLabels, ['STRIKE'])
  const noStrike = { ...state, tiles: state.tiles.map(tile => tile.gem === 'strike'
    ? { id: tile.id, letter: tile.letter, type: 'normal' as const } : tile) }
  const withoutSpecial = previewLetterStrike(noStrike, selected)
  assert.equal(withoutSpecial.strikes, 1)
  assert.deepEqual(withoutSpecial.effectLabels, [])
  assert.deepEqual(submitLetterStrike(state, selected).playedWords[0].preview, preview)
  assert.equal(getPartsOfSpeech('GLOOMY'), undefined)
})

test('curated refill adjectives receive current encounter grammar without changing archived annotations', () => {
  const prototype = createCurrentPrototype()
  for (const word of ['COMELY', 'HOMELY', 'STEADY', 'STORMY', 'DREAMY', 'HEARTY', 'LOAMY', 'CHEERY']) {
    const state = { ...withWord(word), encounter: prototype.encounter }
    const preview = previewLetterStrike(state)
    assert.equal(preview.valid, true, word)
    assert.equal(preview.grammaticalPartOfSpeech, 'adjective', word)
    assert.equal(preview.grammaticalModifier, 1, word)
    if (word !== 'CHEERY') assert.equal(getPartsOfSpeech(word), undefined, word)
  }
  assert.deepEqual(prototype.encounter.wordPartsOfSpeech?.MERRY, ['adjective'])
  assert.equal(previewLetterStrike({ ...withWord('MERRY'), encounter: prototype.encounter }).semanticLabel, 'COUNTER')
})
