import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { getLetterStrikeBattleEvents, getLetterStrikeBonuses, getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from '../src/game/letterStrikeHud.ts'

function wordIds(state: LetterStrikeState, word: string): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = state.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing ${letter} for ${word}`)
    ids.push(tile.id)
  }
  return ids
}

test('tile summaries describe only remaining special tile identities and active rules', () => {
  const state = createLetterStrikeGame()
  assert.deepEqual(getLetterStrikeTileSummary(state), [
    { id: 'strike', label: 'STRIKE', symbol: '◆', detail: 'STRIKES MATCHING LETTER' },
    { id: 'ward', label: 'WARD', symbol: '◇', detail: 'SAVE TURN' },
  ])
  const withoutWard = submitLetterStrike(state, wordIds(state, 'JOY'))
  assert.deepEqual(getLetterStrikeTileSummary(withoutWard).map(summary => summary.id), ['strike'])
  const withoutSpecials = submitLetterStrike(withoutWard, wordIds(withoutWard, 'GLOOM'))
  assert.deepEqual(getLetterStrikeTileSummary(withoutSpecials), [])
})

test('tile detail follows configured effects rather than hardcoded special names', () => {
  const initial = createLetterStrikeGame()
  const state = { ...initial, encounter: {
    ...initial.encounter,
    tileEffects: {
      strike: { strike: false, preventResolveLoss: true },
      ward: { strike: true, preventResolveLoss: true },
    },
  } }
  assert.deepEqual(getLetterStrikeTileSummary(state), [
    { id: 'strike', label: 'STRIKE', symbol: '◆', detail: 'SAVE TURN' },
    { id: 'ward', label: 'WARD', symbol: '◇', detail: 'STRIKES MATCHING LETTER · SAVE TURN' },
  ])
  const inactive = { ...state, encounter: { ...state.encounter, tileEffects: {
    strike: { strike: false, preventResolveLoss: false },
    ward: { strike: false, preventResolveLoss: false },
  } } }
  assert.ok(getLetterStrikeTileSummary(inactive).every(summary => summary.detail === ''))
})

test('normal tiles never acquire special metadata from a leftover gem field', () => {
  const state = createLetterStrikeGame()
  const normalBoard = { ...state, tiles: state.tiles.map(tile => ({ ...tile, type: 'normal' as const })) }
  assert.deepEqual(getLetterStrikeTileSummary(normalBoard), [])
})

test('battle events preserve every recorded turn in reverse order with stable turn IDs', () => {
  let state = createLetterStrikeGame()
  assert.deepEqual(getLetterStrikeBattleEvents(state), [])
  state = submitLetterStrike(state, wordIds(state, 'JOY'))
  state = submitLetterStrike(state, wordIds(state, 'GLOOM'))
  assert.deepEqual(getLetterStrikeBattleEvents(state), [
    { id: 1, word: 'GLOOM', damage: 1, semanticLabel: 'RESISTED', effectLabels: ['STRIKE'] },
    { id: 0, word: 'JOY', damage: 2, semanticLabel: 'COUNTER', effectLabels: ['WARD'] },
  ])
  assert.deepEqual(getLetterStrikeBattleEvents(state, 1).map(event => event.id), [1])
  assert.deepEqual(getLetterStrikeBattleEvents(state, 99).map(event => event.id), [1, 0])
  assert.deepEqual(getLetterStrikeBattleEvents(state, 0), [])
  assert.deepEqual(getLetterStrikeBattleEvents(state, -3), [])
})

test('history projection stays pure and later rule changes cannot alter past effects', () => {
  let state = createLetterStrikeGame()
  state = submitLetterStrike(state, wordIds(state, 'JOY'))
  const before = structuredClone(state)
  const changed = { ...state, encounter: { ...state.encounter, tileEffects: {
    strike: { strike: false, preventResolveLoss: false },
    ward: { strike: true, preventResolveLoss: false },
  } } }
  const events = getLetterStrikeBattleEvents(changed)
  assert.deepEqual(events[0].effectLabels, ['WARD'])
  events[0].effectLabels.push('STRIKE')
  assert.deepEqual(state, before)
  assert.deepEqual(getLetterStrikeBattleEvents(state)[0].effectLabels, ['WARD'])
})

test('grammar weaknesses project only configured nonzero encounter allowances', () => {
  const state = createLetterStrikeGame()
  assert.deepEqual(getLetterStrikeGrammarModifiers(state), [{ id: 'adjective', label: 'ADJECTIVE', value: 1 }])
  assert.deepEqual(getLetterStrikeGrammarModifiers({ encounter: { ...state.encounter, grammarModifiers: undefined } }), [])
  assert.deepEqual(getLetterStrikeGrammarModifiers({ encounter: { ...state.encounter, grammarModifiers: { noun: 0, verb: -1, adjective: 2 } } }), [
    { id: 'verb', label: 'VERB', value: -1 },
    { id: 'adjective', label: 'ADJECTIVE', value: 2 },
  ])
})

test('current move bonuses show applied grammar between semantics and actual effects', () => {
  const state = createLetterStrikeGame()
  assert.deepEqual(getLetterStrikeBonuses(previewLetterStrike(state, wordIds(state, 'SAD'))), [
    { label: 'RESISTED' }, { label: 'ADJECTIVE', value: 1 },
  ])
  assert.deepEqual(getLetterStrikeBonuses(previewLetterStrike(state, wordIds(state, 'JOY'))), [
    { label: 'COUNTER' }, { label: 'WARD' },
  ])
  assert.deepEqual(getLetterStrikeBonuses(previewLetterStrike(state, wordIds(state, 'GLOOM'))), [
    { label: 'RESISTED' }, { label: 'STRIKE' },
  ])
  assert.deepEqual(getLetterStrikeBonuses(previewLetterStrike(state, [])), [])
})

test('history includes recorded grammar even when current encounter weaknesses change', () => {
  const state = createLetterStrikeGame()
  const submitted = submitLetterStrike(state, wordIds(state, 'SAD'))
  assert.deepEqual(getLetterStrikeBattleEvents(submitted)[0], {
    id: 0, word: 'SAD', damage: 1, semanticLabel: 'RESISTED', effectLabels: ['ADJECTIVE +1'],
  })
  const changed = { ...submitted, encounter: { ...submitted.encounter, grammarModifiers: { adjective: -1 } } }
  assert.deepEqual(getLetterStrikeBattleEvents(changed)[0].effectLabels, ['ADJECTIVE +1'])
})
