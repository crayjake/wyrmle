import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPartsOfSpeech } from '../src/game/dictionary.ts'
import { melancholyEncounter } from '../src/game/encounters.ts'
import { createGame, previewAttack, submitWord } from '../src/game/game.ts'
import { getGrammaticalModifier } from '../src/game/grammar.ts'
import type { Encounter, Tile } from '../src/game/types.ts'

function wordEncounter(word: string): Encounter {
  const startingTiles: Tile[] = [...word.padEnd(16, 'L')].map((letter, id) => ({
    id, letter, type: 'normal',
  }))
  return { ...melancholyEncounter, startingTiles }
}

function previewWord(word: string, encounter = wordEncounter(word)) {
  return previewAttack(createGame(encounter), [...word].map((_, id) => id))
}

test('similarity damage floors at one before the optional adjective bonus', () => {
  const encounter = wordEncounter('SAD')
  const withoutGrammar = previewWord('SAD', {
    ...encounter,
    rules: { ...encounter.rules, grammar: { ...encounter.rules.grammar, enabled: false } },
  })
  assert.equal(withoutGrammar.valid, true)
  assert.equal(withoutGrammar.baseDamage, 3)
  assert.equal(withoutGrammar.semanticRelation, 'similar')
  assert.equal(withoutGrammar.totalDamage, 1)
  assert.equal(withoutGrammar.grammaticalModifier, 0)

  const withGrammar = previewWord('SAD', encounter)
  assert.equal(withGrammar.grammaticalModifier, 2)
  assert.equal(withGrammar.totalDamage, 3)
})

test('a related word receives the small configured semantic reduction', () => {
  const preview = previewWord('TEARS')
  assert.equal(preview.valid, true)
  assert.equal(preview.baseDamage, 5)
  assert.equal(preview.semanticRelation, 'related')
  assert.equal(preview.semanticModifier, -1)
  assert.equal(preview.totalDamage, 4)
})

test('an unambiguous adjective attacking a noun adds two after the semantic counter', () => {
  const preview = previewWord('HAPPY')
  assert.equal(preview.valid, true)
  assert.equal(preview.baseDamage, 5)
  assert.equal(preview.semanticRelation, 'opposite')
  assert.equal(preview.semanticModifier, 5)
  assert.equal(preview.grammaticalModifier, 2)
  assert.equal(preview.totalDamage, 12)
})

test('grammar supports only the small intended modifier relationships', () => {
  const rules = melancholyEncounter.rules.grammar
  assert.equal(getGrammaticalModifier(['adjective'], 'noun', rules), 2)
  assert.equal(getGrammaticalModifier(['adverb'], 'verb', rules), 2)
  assert.equal(getGrammaticalModifier(['adverb'], 'adjective', rules), 2)
  assert.equal(getGrammaticalModifier(['noun'], 'noun', rules), 0)
  assert.equal(getGrammaticalModifier(['adjective'], 'adjective', rules), 0)
  assert.equal(getGrammaticalModifier(['adverb'], 'adverb', rules), 0)
  assert.equal(getGrammaticalModifier(['noun'], 'verb', rules), 0)
  assert.equal(getGrammaticalModifier(['adverb'], 'noun', rules), 0)
  assert.equal(getGrammaticalModifier(['adjective'], 'verb', rules), 0)
})

test('missing or ambiguous POS data never forces a grammatical bonus', () => {
  const rules = melancholyEncounter.rules.grammar
  assert.equal(getGrammaticalModifier(undefined, 'noun', rules), 0)
  assert.equal(getGrammaticalModifier([], 'noun', rules), 0)
  assert.equal(getGrammaticalModifier(['adjective', 'noun'], 'noun', rules), 0)
  assert.equal(getGrammaticalModifier(['adverb', 'verb'], 'verb', rules), 0)
  assert.equal(getPartsOfSpeech('qzxqzx'), undefined)
  assert.ok((getPartsOfSpeech('BLUE')?.length ?? 0) > 1)
  assert.equal(previewWord('BLUE').grammaticalModifier, 0)
  assert.equal(previewWord('COASTER').grammaticalModifier, 0)
})

test('the grammar experiment can be disabled or tuned without changing semantic scoring', () => {
  const encounter = wordEncounter('HAPPY')
  const withoutGrammar = previewWord('HAPPY', {
    ...encounter,
    rules: { ...encounter.rules, grammar: { enabled: false, bonus: 2 } },
  })
  assert.equal(withoutGrammar.grammaticalModifier, 0)
  assert.equal(withoutGrammar.semanticModifier, 5)
  assert.equal(withoutGrammar.totalDamage, 10)
  const adjusted = previewWord('HAPPY', {
    ...encounter,
    rules: { ...encounter.rules, grammar: { enabled: true, bonus: 1 } },
  })
  assert.equal(adjusted.grammaticalModifier, 1)
  assert.equal(adjusted.semanticModifier, 5)
  assert.equal(adjusted.totalDamage, 11)
})

test('base and semantic damage values can be tuned independently through encounter data', () => {
  const encounter = wordEncounter('JOY')
  const preview = previewWord('JOY', {
    ...encounter,
    rules: {
      ...encounter.rules,
      damagePerLetter: 2,
      semantic: { ...encounter.rules.semantic, opposite: 7 },
    },
  })
  assert.equal(preview.baseDamage, 6)
  assert.equal(preview.semanticModifier, 7)
  assert.equal(preview.totalDamage, 13)
  assert.equal(preview.resolveCost, 1) // Spelling JOY does not grant Ward without the tile.
})

test('Ward and Power compose, and the effects record the actual triggering tile IDs', () => {
  const baseEncounter = wordEncounter('JOY')
  const encounter: Encounter = {
    ...baseEncounter,
    startingTiles: baseEncounter.startingTiles.map((tile) =>
      tile.id === 0 ? { ...tile, type: 'gem', gem: 'power' }
        : tile.id === 2 ? { ...tile, type: 'gem', gem: 'ward' }
          : tile,
    ),
  }
  const state = createGame(encounter)
  const preview = previewAttack(state, [0, 1, 2])
  assert.equal(preview.totalDamage, 11)
  assert.equal(preview.resolveCost, 0)
  assert.deepEqual(preview.tileEffects, [
    { tileId: 0, gem: 'power', bonusDamage: 3, preventsResolveLoss: false },
    { tileId: 2, gem: 'ward', bonusDamage: 0, preventsResolveLoss: true },
  ])
  const next = submitWord(state, [0, 1, 2])
  assert.equal(next.playerResolve, state.playerResolve)
  assert.equal(state.enemyHp - next.enemyHp, 11)
  assert.deepEqual(next.playedWords[0].effects, preview.tileEffects)
  assert.deepEqual(next.playedWords[0].preview, preview)
  assert.deepEqual(next.playedWords[0].tiles.map((tile) => tile.id), [0, 1, 2])
})

test('two Ward tiles negate the normal cost once and cannot generate extra Resolve', () => {
  const baseEncounter = wordEncounter('JOY')
  const encounter: Encounter = {
    ...baseEncounter,
    startingTiles: baseEncounter.startingTiles.map((tile) =>
      tile.id < 2 ? { ...tile, type: 'gem', gem: 'ward' } : tile,
    ),
    refillQueue: baseEncounter.refillQueue + 'A'.repeat(16),
  }
  const state = createGame(encounter)
  assert.equal(previewAttack(state, [0, 1, 2]).resolveCost, 0)
  assert.equal(submitWord(state, [0, 1, 2]).playerResolve, state.playerResolve)
})

test('special tile damage is configurable through the existing gem rule family', () => {
  const encounter: Encounter = {
    ...melancholyEncounter,
    rules: {
      ...melancholyEncounter.rules,
      tileEffects: {
        ...melancholyEncounter.rules.tileEffects,
        power: { bonusDamage: 7, preventResolveLoss: false },
      },
    },
  }
  const state = createGame(encounter)
  const preview = previewAttack(state, [3, 4, 5, 6, 7])
  assert.equal(preview.totalDamage, 17)
  assert.equal(preview.resolveCost, 1)
  assert.equal(preview.tileEffects[0].bonusDamage, 7)
})
