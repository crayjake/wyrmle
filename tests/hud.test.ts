import assert from 'node:assert/strict'
import { test } from 'node:test'
import { melancholyEncounter } from '../src/game/encounters.ts'
import { createGame, submitWord } from '../src/game/game.ts'
import {
  getActiveGrammarModifiers, getCurrentTileSummary, getRecentBattleEvents,
} from '../src/game/hud.ts'
import type { GameState, PartOfSpeech, Tile } from '../src/game/types.ts'

function wordIds(state: GameState, word: string): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = state.tiles.find((tile) => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Board is missing ${letter} for ${word}`)
    ids.push(tile.id)
  }
  return ids
}

test('HUD grammar lists only word types that modify the current enemy type', () => {
  const expected: Record<PartOfSpeech, string | null> = {
    noun: 'ADJECTIVE', verb: 'ADVERB', adjective: 'ADVERB', adverb: null,
  }
  for (const partOfSpeech of Object.keys(expected) as PartOfSpeech[]) {
    const state = createGame({
      ...melancholyEncounter,
      enemy: { ...melancholyEncounter.enemy, partOfSpeech },
    })
    const label = expected[partOfSpeech]
    assert.deepEqual(getActiveGrammarModifiers(state), label === null ? [] : [{
      id: label.toLowerCase(), label, value: 2,
    }])
  }
})

test('HUD grammar follows disabled, zero, and negative configured rules', () => {
  for (const grammar of [
    { enabled: false, bonus: 2 },
    { enabled: true, bonus: 0 },
    { enabled: true, bonus: -2 },
  ]) {
    const state = createGame({
      ...melancholyEncounter,
      rules: { ...melancholyEncounter.rules, grammar },
    })
    assert.deepEqual(getActiveGrammarModifiers(state), grammar.enabled && grammar.bonus !== 0
      ? [{ id: 'adjective', label: 'ADJECTIVE', value: grammar.bonus }]
      : [])
  }
})

test('special summary counts actual gems and removes types as they are consumed and refilled', () => {
  const initial = createGame(melancholyEncounter)
  assert.deepEqual(getCurrentTileSummary(initial), [
    {
      id: 'power', label: 'POWER', symbol: '◆', count: 1,
      bonusDamage: 3, preventsResolveLoss: false, detail: '+3',
    },
    {
      id: 'ward', label: 'LIFE', symbol: '▪', count: 1,
      bonusDamage: 0, preventsResolveLoss: true, detail: 'SAVES A LIFE THIS TURN',
    },
  ])
  const afterJoy = submitWord(initial, wordIds(initial, 'JOY'))
  assert.deepEqual(getCurrentTileSummary(afterJoy).map((entry) => entry.id), ['power'])
  const afterCheer = submitWord(afterJoy, wordIds(afterJoy, 'CHEER'))
  assert.deepEqual(getCurrentTileSummary(afterCheer), [])
  assert.equal(getCurrentTileSummary(initial).length, 2)
})

test('normal and Power E remain distinct in board summary', () => {
  const state = createGame(melancholyEncounter)
  const normalE = submitWord(state, [4, 6, 9, 7]) // HEAR using the ordinary E.
  const powerE = submitWord(state, [4, 5, 9, 7]) // HEAR using Power E.
  assert.equal(getCurrentTileSummary(normalE).find((entry) => entry.id === 'power')?.count, 1)
  assert.equal(getCurrentTileSummary(powerE).some((entry) => entry.id === 'power'), false)
})

test('special summaries use configured effects per tile and current counts', () => {
  const state = createGame({
    ...melancholyEncounter,
    startingTiles: melancholyEncounter.startingTiles.map((tile): Tile => tile.id === 6
      ? { ...tile, type: 'gem', gem: 'power' }
      : tile),
    rules: {
      ...melancholyEncounter.rules,
      tileEffects: {
        power: { bonusDamage: 7, preventResolveLoss: false },
        ward: { bonusDamage: -1, preventResolveLoss: true },
      },
    },
  })
  assert.deepEqual(getCurrentTileSummary(state).map(({ id, count, detail, bonusDamage }) => ({
    id, count, detail, bonusDamage,
  })), [
    { id: 'power', count: 2, detail: '+7', bonusDamage: 7 },
    { id: 'ward', count: 1, detail: '-1 SAVES A LIFE THIS TURN', bonusDamage: -1 },
  ])
})

test('battle events omit rejected attacks and capture semantic results with actual effects', () => {
  let state = createGame(melancholyEncounter)
  state = submitWord(state, [0, 2, 5]) // Invalid JYE.
  assert.deepEqual(getRecentBattleEvents(state), [])
  state = submitWord(state, wordIds(state, 'JOY'))
  state = submitWord(state, wordIds(state, 'CHEER'))
  assert.deepEqual(getRecentBattleEvents(state), [
    { id: 1, word: 'CHEER', damage: 13, semanticLabel: 'COUNTER', effectLabels: ['POWER'] },
    { id: 0, word: 'JOY', damage: 8, semanticLabel: 'COUNTER', effectLabels: ['WARD'] },
  ])
  for (const [word, semanticLabel] of [['GLOOM', 'RESISTED'], ['CRY', 'RELATED'], ['DASH', 'NEUTRAL']]) {
    const initial = createGame(melancholyEncounter)
    const next = submitWord(initial, wordIds(initial, word))
    assert.equal(next.error, null)
    assert.equal(getRecentBattleEvents(next)[0].semanticLabel, semanticLabel)
  }
})

test('history keeps its submission snapshots after rules and relations change', () => {
  const state = createGame(melancholyEncounter)
  const afterAttack = submitWord(state, wordIds(state, 'CHEER'))
  const changedRules: GameState = {
    ...afterAttack,
    encounter: {
      ...afterAttack.encounter,
      enemy: {
        ...afterAttack.encounter.enemy,
        semanticRelations: { similar: ['CHEER'], opposite: [], related: [] },
      },
      rules: {
        ...afterAttack.encounter.rules,
        tileEffects: {
          ...afterAttack.encounter.rules.tileEffects,
          power: { bonusDamage: 0, preventResolveLoss: false },
        },
      },
    },
  }
  assert.deepEqual(getRecentBattleEvents(changedRules), getRecentBattleEvents(afterAttack))
  assert.deepEqual(getRecentBattleEvents(changedRules)[0], {
    id: 0, word: 'CHEER', damage: 13, semanticLabel: 'COUNTER', effectLabels: ['POWER'],
  })
})

test('history labels only triggered tile effects, including nonstandard configured effects', () => {
  for (const [bonusDamage, preventResolveLoss, expected] of [
    [0, false, []], [4, false, ['WARD']], [0, true, ['WARD']],
  ] as const) {
    const state = createGame({
      ...melancholyEncounter,
      rules: {
        ...melancholyEncounter.rules,
        tileEffects: {
          ...melancholyEncounter.rules.tileEffects,
          ward: { bonusDamage, preventResolveLoss },
        },
      },
    })
    const afterAttack = submitWord(state, wordIds(state, 'JOY'))
    assert.deepEqual(getRecentBattleEvents(afterAttack)[0].effectLabels, expected)
  }
})

test('history includes every played turn newest first, supports optional limits, and preserves state', () => {
  let state = createGame({
    ...melancholyEncounter,
    enemy: { ...melancholyEncounter.enemy, maxHealth: 100 },
    startingTiles: [...'CAT'.padEnd(16, 'A')].map((letter, id) => ({ id, letter, type: 'normal' })),
    refillQueue: 'CAT'.repeat(40),
  })
  for (let index = 0; index < 5; index += 1) {
    state = submitWord(state, wordIds(state, 'CAT'))
    assert.equal(state.error, null)
  }
  const before = structuredClone(state)
  Object.freeze(state)
  Object.freeze(state.playedWords)
  state.playedWords.forEach(Object.freeze)
  assert.deepEqual(getRecentBattleEvents(state).map((entry) => entry.id), [4, 3, 2, 1, 0])
  assert.deepEqual(getRecentBattleEvents(state, 1).map((entry) => entry.id), [4])
  assert.deepEqual(getRecentBattleEvents(state, 2.9).map((entry) => entry.id), [4, 3])
  assert.deepEqual(getRecentBattleEvents(state, 20).map((entry) => entry.id), [4, 3, 2, 1, 0])
  assert.deepEqual(getRecentBattleEvents(state, Infinity).map((entry) => entry.id), [4, 3, 2, 1, 0])
  assert.deepEqual(getRecentBattleEvents(state, 0), [])
  assert.deepEqual(getRecentBattleEvents(state, -1), [])
  assert.deepEqual(getRecentBattleEvents(state, -Infinity), [])
  assert.deepEqual(getRecentBattleEvents(state, NaN), [])
  getActiveGrammarModifiers(state)
  getCurrentTileSummary(state)
  assert.deepEqual(state, before)
})
