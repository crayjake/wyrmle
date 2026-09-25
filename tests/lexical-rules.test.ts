import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dailyEncounter20260924V6, dailyEncounter20260924V7 } from '../src/daily/catalog.ts'
import { createLetterStrikeGame, getLetterStrikeAllowance, previewLetterStrike } from '../src/game/letterStrike.ts'
import { getEncounterPartsOfSpeech, getEncounterWordClassification } from '../src/game/lexicalRules.ts'
import { discoverValidMoves } from '../src/generator/findMoves.ts'
import { encounterRuleKey } from '../src/generator/stateKey.ts'

test('broad adjective recognition applies to everyday opening words and keeps every valid POS', () => {
  for (const word of ['DIRTY', 'DIRE', 'DRY', 'AIRY', 'DEAD', 'DROWSY', 'FAIR', 'FRAIL', 'FROSTY', 'READY', 'ROSY', 'SORRY', 'TIRED', 'WEARY', 'WILD', 'WORRIED']) {
    assert.ok(getEncounterPartsOfSpeech(dailyEncounter20260924V7, word)?.includes('adjective'), word)
    assert.equal(getLetterStrikeAllowance(dailyEncounter20260924V7, word, 4).grammaticalModifier, 1, word)
  }
  assert.deepEqual(getEncounterPartsOfSpeech(dailyEncounter20260924V7, 'DIRTY'), ['verb', 'adjective'])
  assert.equal(getLetterStrikeAllowance(dailyEncounter20260924V6, 'DIRTY', 4).grammaticalModifier, 0)
})

test('word senses choose one applicable grammar effect, without stacking or erasing ambiguity', () => {
  const encounter = structuredClone(dailyEncounter20260924V7)
  encounter.grammarModifiers = { adjective: 1, verb: 2, noun: -1 }
  assert.equal(getLetterStrikeAllowance(encounter, 'DIRTY', 5).grammaticalModifier, 2)
  assert.equal(getLetterStrikeAllowance(encounter, 'DIRTY', 5).grammaticalPartOfSpeech, 'verb')
  encounter.grammarModifiers = { adjective: -1 }
  assert.equal(getLetterStrikeAllowance(encounter, 'DIRTY', 5).grammaticalModifier, 0)
  assert.equal(getLetterStrikeAllowance(encounter, 'SHADY', 5).grammaticalModifier, -1)
})

test('known related meanings and unlisted semantic fallbacks remain distinguishable', () => {
  const worry = getEncounterWordClassification(dailyEncounter20260924V7, 'WORRY')
  assert.equal(worry.relation, 'related')
  assert.equal(worry.semanticSource, 'curated-or-wordnet')
  assert.equal(getLetterStrikeAllowance(dailyEncounter20260924V7, 'WORRY', 2).semanticLabel, 'NEUTRAL')
  const dirty = getEncounterWordClassification(dailyEncounter20260924V7, 'DIRTY')
  assert.equal(dirty.semanticSource, 'unlisted')
  assert.notEqual(dirty.partOfSpeechSource, 'unknown')
})

test('solver summaries and runtime preview use the same broad metadata for all physical choices', () => {
  const state = createLetterStrikeGame(dailyEncounter20260924V7)
  const discovery = discoverValidMoves(state, { vocabulary: ['DIRTY', 'WORRY', 'TIRED', 'FAIR'] })
  assert.ok(discovery.moves.some(move => move.word === 'DIRTY'))
  assert.ok(discovery.moves.some(move => move.word === 'WORRY' && move.wardUsed))
  for (const move of discovery.moves) {
    const preview = previewLetterStrike(state, move.tileIds)
    assert.deepEqual(move.partsOfSpeech, getEncounterPartsOfSpeech(state.encounter, move.word))
    assert.equal(move.grammarModifier, preview.grammaticalModifier)
    assert.equal(move.strikes, preview.strikes)
  }
})

test('lexical versions distinguish search states and reject unsupported data instead of silently rescoring', () => {
  const original = structuredClone(dailyEncounter20260924V6)
  const updated = { ...original, lexicalRules: dailyEncounter20260924V7.lexicalRules }
  assert.notEqual(encounterRuleKey(original), encounterRuleKey(updated))
  assert.throws(() => createLetterStrikeGame({ ...updated, lexicalRules: { version: 'missing-version', grammarPolicy: 'any-recognized' } } as never), /Unsupported lexical/)
})
