import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createLetterStrikeGame, letterStrikeEncounter } from '../src/game/letterStrike.ts'
import { MEANING_LEXICON_VERSION } from '../src/game/meaningLexicon.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import type { SemanticRelation } from '../src/game/types.ts'
import { encounterRuleKey, stateKey } from '../src/generator/stateKey.ts'

function meaning(relation: SemanticRelation): PuzzleWordMeaning {
  return Object.freeze({
    definition: 'A fixture definition.', lemma: 'fixture', senseId: 'fixture-sense', partsOfSpeech: ['noun'],
    relation, reason: 'Reviewed fixture meaning.', source: 'oewn-2025', evidence: 'defined-neutral',
  }) as PuzzleWordMeaning
}

function lexicon(entries: readonly (readonly [string, SemanticRelation])[]): PuzzleMeaningLexicon {
  return Object.freeze({
    version: MEANING_LEXICON_VERSION, dictionaryVersion: 'fixture-dictionary', profileVersion: 'fixture-profile',
    policy: 'defined-only', enemyWord: 'ANGER', letterSupply: 'AACCEEFLRRU', minimumWordLength: 3, maximumWordLength: 16,
    words: Object.freeze(Object.fromEntries(entries.map(([word, relation]) => [word, meaning(relation)]))),
  })
}

const entries = [['CARE', 'unrelated'], ['CAREFUL', 'unrelated'], ['CHEERFUL', 'opposite'], ['RAGE', 'similar']] as const
const base = createLetterStrikeGame()
const withLexicon = (meaningLexicon: PuzzleMeaningLexicon) => ({ ...base, encounter: { ...base.encounter, meaningLexicon } })

test('state keys distinguish meaning word membership, relation and schema version', () => {
  const original = withLexicon(lexicon(entries))
  assert.notEqual(stateKey(original), stateKey(base))
  assert.notEqual(stateKey(original), stateKey(withLexicon(lexicon(entries.slice(1)))))
  assert.notEqual(stateKey(original), stateKey(withLexicon(lexicon([...entries, ['CALM', 'opposite']]))))
  assert.notEqual(stateKey(original), stateKey(withLexicon(lexicon(entries.map(([word, relation]) => [word, word === 'CHEERFUL' ? 'similar' : relation])))))
  const changedVersion = { ...original.encounter.meaningLexicon, version: 'future-meaning-schema' } as unknown as PuzzleMeaningLexicon
  assert.notEqual(stateKey(original), stateKey(withLexicon(changedVersion)))
})

test('record order and definition-only edits do not change meaning rule state keys', () => {
  const original = lexicon(entries)
  assert.equal(stateKey(withLexicon(original)), stateKey(withLexicon(lexicon([...entries].reverse()))))
  const definitions = {
    ...original,
    words: Object.fromEntries(Object.entries(original.words).map(([word, entry]) => [word, { ...entry, definition: 'An improved display definition.' }])),
  }
  assert.equal(stateKey(withLexicon(original)), stateKey(withLexicon(definitions)))
})

test('rule key embeds the canonical SHA-256 digest, not the complete meaning table', () => {
  const compiled = lexicon(entries)
  const key = encounterRuleKey({ ...letterStrikeEncounter, meaningLexicon: compiled })
  const expected = createHash('sha256').update(JSON.stringify({ version: compiled.version,
    words: [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
  })).digest('hex')
  assert.ok(key.includes(JSON.stringify(['meaning-lexicon-sha256', expected])))
  assert.ok(!key.includes('CAREFUL'))
  const large = lexicon(Array.from({ length: 22_000 }, (_, index) => [`FIXTURE${index}`, 'unrelated'] as const))
  const largeKey = encounterRuleKey({ ...letterStrikeEncounter, meaningLexicon: large })
  assert.equal(largeKey.length, key.length, 'Meaning dictionary size must not inflate every search state.')
})

test('a shared immutable meaning lexicon is hashed only once across encounter variants', () => {
  let enumerations = 0
  const original = lexicon(entries)
  const compiled = Object.freeze({ ...original, words: new Proxy(original.words, {
    ownKeys(target) { enumerations++; return Reflect.ownKeys(target) },
  }) })
  const initial = { ...letterStrikeEncounter, meaningLexicon: compiled }
  const first = encounterRuleKey(initial)
  for (let index = 0; index < 25; index++) {
    assert.equal(encounterRuleKey({ ...initial }), first)
    stateKey({ ...base, encounter: { ...initial, strikeConsumesAllowance: index % 2 === 0 } })
  }
  assert.equal(enumerations, 1)
})
