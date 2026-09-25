import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION,
} from '../src/lexicon/meaningDictionary.ts'
import profiles from '../src/lexicon/data/semantic-profiles-v1.json' with { type: 'json' }
import {
  getCoveredMeaningWords, getMeaningSense, getMeaningSynset, getWordMeanings,
} from '../scripts/lib/wordMeanings.ts'

test('new validity dictionary contains every defined spelling and no uncovered spelling', () => {
  const words = getDefinedDictionaryWords()
  assert.deepEqual(words, getCoveredMeaningWords())
  assert.deepEqual(words, [...words].sort())
  assert.equal(words.length, 116_197)
  assert.equal(getDictionaryMeaning('AWFY'), undefined)
  assert.equal(getDictionaryMeaning('THE'), undefined)
  assert.equal(getDictionaryMeaning('WHERE'), undefined)
  const cheerful = getDictionaryMeaning(' cheerful ')!
  assert.equal(cheerful.word, 'CHEERFUL')
  assert.match(cheerful.definition, /good spirits/)
  assert.deepEqual(cheerful.partsOfSpeech, ['adjective'])
  assert.ok(Object.isFrozen(cheerful))
})

test('ANGER counters are whole reviewed meaning families, not an isolated CHEERFUL fix', () => {
  for (const word of ['CHEER', 'CHEERFUL', 'CHEERY', 'CHEERILY', 'HAPPY', 'HAPPILY', 'JOY', 'JOYFUL', 'CALM', 'CALMLY', 'KIND', 'KINDLY', 'GENTLE', 'PEACEFUL', 'RELAX', 'RELAXED', 'SMILE', 'LAUGH']) {
    assert.equal(profiles.ANGER.relations[word]?.relation, 'opposite', word)
  }
  for (const word of ['ANGER', 'ANGRY', 'ANGRILY', 'FURY', 'RAGE', 'WRATH', 'RESENTFUL', 'ANNOYED', 'IRRITATED']) {
    assert.equal(profiles.ANGER.relations[word]?.relation, 'similar', word)
  }
  assert.equal(profiles.ANGER.relations.CAREFUL, undefined)
  for (const word of ['EASY', 'DILIGENT', 'PERSEVERING', 'MODERATE', 'MILD', 'TEMPERATE']) {
    assert.notEqual(profiles.ANGER.relations[word]?.relation, 'opposite', word)
  }
  assert.equal(profiles.ANGER.relations.KIND.senseId, 'oewn-kind__3.00.00..')
  assert.match(profiles.ANGER.relations.GENTLE.definition, /kindly|kind|soothing|mild/)
})

test('profiles use each enemy concept rather than a universal positive-negative sentiment rule', () => {
  for (const word of ['BRAVE', 'BRAVELY', 'BOLD', 'SAFE', 'SECURE', 'SECURITY']) {
    assert.equal(profiles.FEAR.relations[word]?.relation, 'opposite', word)
  }
  for (const word of ['WORRY', 'WORRIED', 'ANXIETY', 'NERVOUS', 'SCARY', 'HORROR']) {
    assert.equal(profiles.FEAR.relations[word]?.relation, 'similar', word)
  }
  assert.equal(profiles.FEAR.relations.HAPPY, undefined)
  assert.equal(profiles.FEAR.relations.INTEREST, undefined)
  assert.equal(profiles.FEAR.relations.OCCUPY, undefined)
  assert.equal(profiles.FEAR.relations.SURELY, undefined)
  assert.notEqual(profiles.FEAR.relations.POSITIVELY?.definition, 'downright')
  assert.equal(profiles.FEAR.relations.DESPERATE, undefined)
  assert.equal(profiles.FEAR.relations.HEROIC.relation, 'opposite')
  assert.equal(profiles.DESPAIR.relations.HOPE.relation, 'opposite')
  assert.equal(profiles.DESPAIR.relations.WORRY.relation, 'related')
  assert.equal(profiles.MELANCHOLY.relations.SADLY.senseId, 'oewn-sadly__4.02.03..')
  assert.equal(profiles.MELANCHOLY.relations.TEARFUL.relation, 'similar')
  for (const word of ['MERCILESS', 'RUTHLESS', 'TORTURE']) {
    assert.equal(profiles.CRUELTY.relations[word]?.relation, 'similar', word)
  }
  for (const word of ['MESS', 'MESSY', 'RANDOM', 'UNRULY', 'ANARCHY', 'ANARCHIC', 'LAWLESS', 'DISRUPTION', 'DISRUPT', 'CONFUSED', 'DISARRAY', 'TURMOIL']) {
    assert.equal(profiles.CHAOS.relations[word]?.relation, 'similar', word)
  }
  for (const word of ['ANARCHIST', 'NIHILIST', 'SYNDICALIST']) {
    assert.equal(profiles.CHAOS.relations[word]?.relation, 'related', word)
  }
  for (const word of ['ORDER', 'ORDERLY', 'TIDY', 'SORT', 'PLAN']) {
    assert.equal(profiles.CHAOS.relations[word]?.relation, 'opposite', word)
  }
})

test('all six enemy profiles have meaningful counter and resistance examples', () => {
  const cases: [keyof typeof profiles, string[], string[]][] = [
    ['ANGER', ['CHEERFUL', 'CALM', 'PATIENCE'], ['ANGRY', 'RAGE', 'RESENTFUL']],
    ['DESPAIR', ['HOPE', 'HOPEFUL', 'OPTIMISM'], ['DESPAIR', 'HOPELESS', 'DESPERATE']],
    ['FEAR', ['COURAGE', 'SAFE', 'SECURITY'], ['TERROR', 'PANIC', 'WORRY']],
    ['MELANCHOLY', ['JOY', 'CHEERY', 'HAPPY'], ['SAD', 'GLOOMY', 'TEARFUL']],
    ['CRUELTY', ['KIND', 'MERCY', 'COMPASSION'], ['CRUEL', 'MERCILESS', 'TORTURE']],
    ['CHAOS', ['TIDY', 'ORDER', 'SORT', 'PLAN'], ['CHAOTIC', 'MESSY', 'RANDOM']],
  ]
  for (const [enemy, counters, reinforcements] of cases) {
    for (const word of counters) assert.equal(profiles[enemy].relations[word]?.relation, 'opposite', `${enemy}: ${word}`)
    for (const word of reinforcements) assert.equal(profiles[enemy].relations[word]?.relation, 'similar', `${enemy}: ${word}`)
  }
})

test('every generated profile record has licensed word evidence and a verifiable source path', () => {
  for (const [enemy, profile] of Object.entries(profiles)) {
    assert.equal(profile.dictionaryVersion, MEANING_DICTIONARY_VERSION)
    for (const [word, record] of Object.entries(profile.relations)) {
      const context = `${enemy}: ${word}`
      assert.ok(getDictionaryMeaning(word), context)
      const sense = getMeaningSense(record.senseId)!
      assert.equal(record.definition, sense.definition, context)
      assert.equal(record.lemma, sense.lemma, context)
      assert.ok(getWordMeanings(word).senses.some(candidate => candidate.id === record.senseId), context)
      assert.ok(profile.roots.some(root => root.senseId === record.rootSense), context)
      assert.equal(record.confidence, record.evidence.length ? 'lexical-expansion' : 'reviewed-profile', context)
      assert.ok(record.evidence.filter(edge => edge.type === 'derivation').length <= 1, context)
      assert.ok(record.evidence.filter(edge => edge.type === 'similar').length <= 1, context)
      let previous = record.rootSense
      for (const edge of record.evidence) {
        assert.equal(edge.from, previous, context)
        const from = getMeaningSense(edge.from)!
        const to = getMeaningSense(edge.to)!
        if (edge.type === 'same-synset') assert.equal(from.synset, to.synset, context)
        else if (edge.type === 'similar') {
          assert.ok(from.synset.endsWith('-a'), context)
          assert.ok(getMeaningSynset(from.synset)!.relations.some(relation => relation.type === 'similar' && relation.target === to.synset), context)
        } else if (edge.type === 'inverse-pertainym') {
          assert.equal(to.partOfSpeech, 'adverb', context)
          assert.ok(to.relations.some(relation => relation.type === 'pertainym' && relation.target === from.id), context)
        } else {
          assert.ok(from.relations.some(relation => relation.type === edge.type && relation.target === to.id), context)
        }
        previous = edge.to
      }
      assert.equal(previous, record.senseId, context)
    }
  }
})
