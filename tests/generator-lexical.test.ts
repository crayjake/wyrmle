import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDictionaryWord } from '../src/game/dictionary.ts'
import { createLetterStrikeGame, letterStrikeEncounter, previewLetterStrike } from '../src/game/letterStrike.ts'
import { analyseEnemySuitability } from '../src/generator/enemySuitability.ts'
import { selectEnemy } from '../src/generator/enemySelector.ts'
import { getWordCommonness, localLexicalProvider } from '../src/generator/lexicalProvider.ts'
import type { LexicalProvider } from '../src/generator/lexicalProvider.ts'
import { buildWordPools, matchingLetterCount } from '../src/generator/wordPools.ts'

test('local semantic seed supports familiar counter, resisted, and neutral MELANCHOLY choices', () => {
  const pools = buildWordPools(' melancholy ')
  assert.equal(pools.enemyWord, 'MELANCHOLY')
  assert.ok(pools.counters.length >= 30)
  assert.ok(pools.resisted.length >= 12)
  assert.ok(pools.clutch.some(entry => entry.word === 'COMICALLY'))
  assert.ok(pools.clutch.some(entry => entry.word === 'ELATION'))
  assert.ok(pools.grammar.some(entry => entry.word === 'HOMELY'))
  assert.ok(pools.neutral.some(entry => entry.word === 'HARMONY'))
  assert.ok(!pools.counters.some(entry => entry.word === 'HARMONY'))
  assert.ok(pools.ward.length > 5)
  assert.ok(pools.strike.some(entry => entry.word === 'GLOOM'))
  for (const entries of [pools.counters, pools.resisted, pools.neutral, pools.grammar, pools.clutch]) {
    assert.ok(entries.every(entry => isDictionaryWord(entry.word)))
  }
  assert.deepEqual(buildWordPools('MELANCHOLY'), pools)
})

test('familiarity estimates disclose their source and unknown vocabulary stays unknown', () => {
  assert.equal(localLexicalProvider.getEntry('happy')?.commonnessSource, 'curated-estimate')
  assert.ok((getWordCommonness('HAPPY') ?? 0) >= 0.8)
  assert.equal(getWordCommonness('XYLOPHONE'), null)
  assert.equal(localLexicalProvider.getEntry('XYLOPHONE')?.commonnessSource, 'unknown')
  assert.equal(localLexicalProvider.getEntry('NOTAWORDQQQ'), undefined)
})

test('enemy suitability rejects XERO explicitly and accepts several supported concepts', () => {
  const xero = analyseEnemySuitability('XERO')
  assert.equal(xero.eligible, false)
  assert.ok(xero.overallScore < 0.2)
  assert.ok(xero.rejectionReasons.some(reason => /Familiarity/.test(reason)))
  assert.ok(xero.rejectionReasons.some(reason => /counter vocabulary/.test(reason)))
  assert.ok(xero.rejectionReasons.some(reason => /semantic neighbourhood/.test(reason)))
  for (const enemy of localLexicalProvider.enemyWords()) {
    const result = analyseEnemySuitability(enemy)
    assert.equal(result.eligible, true, `${enemy}: ${result.rejectionReasons.join(', ')}`)
    assert.equal(result.counterLetterCoverage, 1)
    assert.ok(result.counterCount >= 6)
  }
})

test('enemy choice is seed deterministic, suitable, and not permanently fixed to one enemy', () => {
  const seen = new Set<string>()
  for (let seed = 0; seed < 30; seed++) {
    const result = selectEnemy(seed)
    assert.deepEqual(result, selectEnemy(seed))
    assert.ok(result.selected)
    assert.ok(result.suitability?.eligible)
    seen.add(result.selected)
  }
  assert.ok(seen.size >= 4)
  assert.equal(selectEnemy('bad', { candidateWords: ['XERO', 'ZZZ'] }).selected, null)
  assert.equal(selectEnemy('empty', { candidateWords: [] }).selected, null)
})

test('serialized semantic and grammar information agrees with real gameplay', () => {
  const pools = buildWordPools('MELANCHOLY')
  const encounter = {
    ...letterStrikeEncounter,
    enemy: { ...letterStrikeEncounter.enemy, semanticRelations: pools.semanticRelations },
    wordPartsOfSpeech: pools.wordPartsOfSpeech,
  }
  for (const [word, semantic, grammar] of [
    ['JOY', 'COUNTER', 0], ['GLOOM', 'RESISTED', 0], ['HARMONY', 'NEUTRAL', 0],
    ['HOMELY', 'NEUTRAL', 1], ['COMICALLY', 'COUNTER', 0], ['AMUSED', 'COUNTER', 0],
  ] as const) {
    const state = createLetterStrikeGame({ ...encounter, startingTiles: [...word.padEnd(16, 'X')].map((letter, id) => ({ id, letter, type: 'normal' as const })) })
    const preview = previewLetterStrike(state, [...word].map((_, id) => id))
    assert.equal(preview.valid, true)
    assert.equal(preview.semanticLabel, semantic, word)
    assert.equal(preview.grammaticalModifier, grammar, word)
  }
})

test('provider is replaceable without changing runtime semantic code', () => {
  const original = localLexicalProvider.getEntry('MELANCHOLY')!
  const custom: LexicalProvider = {
    id: 'test-provider',
    getEntry(word) {
      return word.trim().toUpperCase() === 'MELANCHOLY'
        ? { ...original, counters: ['JOY'], synonyms: ['SAD'], related: ['HARMONY'] }
        : localLexicalProvider.getEntry(word)
    },
    enemyWords: () => ['MELANCHOLY'],
    vocabulary: () => [],
  }
  const pools = buildWordPools('MELANCHOLY', custom)
  assert.equal(pools.providerId, custom.id)
  assert.deepEqual(pools.semanticRelations, { opposite: ['JOY'], similar: ['SAD'], related: ['HARMONY'] })
  assert.deepEqual(pools.wordPartsOfSpeech.SAD, ['adjective'])
  assert.deepEqual(pools.counters.map(entry => entry.word), ['JOY'])
  assert.equal(analyseEnemySuitability('MELANCHOLY', custom).eligible, false)
})

test('pool cutoffs do not change the serialized meaning of excluded words', () => {
  const pools = buildWordPools('MELANCHOLY', localLexicalProvider, { maximumLength: 5 })
  assert.ok(pools.counters.every(entry => entry.word.length <= 5))
  assert.ok(pools.semanticRelations.opposite.includes('COMICALLY'))
  assert.ok(pools.semanticRelations.similar.includes('MOURNFUL'))
})

test('all curated semantic neighbours have locally valid, known familiarity metadata', () => {
  for (const word of localLexicalProvider.enemyWords()) {
    const entry = localLexicalProvider.getEntry(word)!
    for (const neighbour of [...entry.counters, ...entry.synonyms, ...entry.related]) {
      assert.ok(isDictionaryWord(neighbour), neighbour)
      assert.notEqual(getWordCommonness(neighbour), null, `${word}: ${neighbour}`)
    }
  }
})

test('letter overlap counts physical occurrences instead of distinct character sets', () => {
  assert.equal(matchingLetterCount('COMICALLY', 'MELANCHOLY'), 7)
  assert.equal(matchingLetterCount('LLL', 'MELANCHOLY'), 2)
  assert.equal(matchingLetterCount('LLL', 'LL'), 2)
})
