import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION,
} from '../src/lexicon/meaningDictionary.ts'
import profiles from '../src/lexicon/data/semantic-profiles-v1.json' with { type: 'json' }
import {
  getCoveredMeaningWords, getMeaningSense, getMeaningSynset, getWordMeanings, WORD_MEANINGS_VERSION,
} from '../scripts/lib/wordMeanings.ts'
import { getFunctionWord, getFunctionWords } from '../src/lexicon/functionWords.ts'

test('new validity dictionary contains every defined spelling and no uncovered spelling', () => {
  const words = getDefinedDictionaryWords()
  assert.deepEqual(words, [...new Set([...getCoveredMeaningWords(), ...getFunctionWords()])].sort())
  assert.deepEqual(words, [...words].sort())
  assert.ok(words.length > 116_197)
  assert.equal(getDictionaryMeaning('AWFY'), undefined)
  for (const word of ['THE', 'WHERE', 'AND', 'HOW', 'HER', 'SHE', 'HIM', 'YOU', 'WITH']) {
    const entry = getDictionaryMeaning(word)!
    assert.ok(entry?.definition.trim(), word)
    assert.equal(entry.source, 'wiktionary-en', word)
    assert.ok(getFunctionWord(word)?.senses.some(sense => sense.id === entry.senseId), word)
  }
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

test('CHAOS counters cover calmness, peace, composure and coherent order as reviewed families', () => {
  const families = [
    ['CALM', 'CALMS', 'CALMED', 'CALMING', 'CALMER', 'CALMEST', 'CALMLY', 'CALMNESS'],
    ['COMPOSE', 'COMPOSES', 'COMPOSING', 'COMPOSED', 'COMPOSEDLY', 'COMPOSURE', 'EQUANIMITY'],
    ['SERENE', 'SERENER', 'SERENEST', 'SERENELY', 'SERENITY', 'TRANQUIL', 'TRANQUILLY', 'TRANQUILITY', 'TRANQUILLITY'],
    ['QUIET', 'QUIETER', 'QUIETEST', 'QUIETLY', 'QUIETNESS', 'QUIETEN', 'QUIETED', 'QUIETUDE', 'UNTROUBLED'],
    ['PEACE', 'PEACEFUL', 'PEACEFULLY', 'PEACEFULNESS', 'PEACEABLE'],
    ['COOL', 'COOLER', 'COOLLY', 'COOLHEADED', 'COLLECTED', 'COLLECTEDLY', 'POISED', 'UNFLAPPABLE', 'UNRUFFLED'],
    ['PLACID', 'PLACIDLY', 'PLACIDITY', 'RELAX', 'RELAXED', 'RELAXING', 'RELAXATION', 'MELLOW', 'UNWIND'],
    ['ORDER', 'ORDERLY', 'TIDY', 'METHOD', 'METHODICAL', 'SYSTEM', 'SYSTEMATIC', 'COHERENCE', 'COHERENT', 'COHERENTLY', 'CLARITY', 'BALANCE', 'STABILITY'],
  ]
  for (const family of families) {
    for (const word of family) assert.equal(profiles.CHAOS.relations[word]?.relation, 'opposite', word)
  }
  assert.equal(profiles.CHAOS.version, 'semantic-profiles-v2-chaos')
  for (const [enemy, profile] of Object.entries(profiles)) {
    if (enemy !== 'CHAOS') assert.equal(profile.version, 'semantic-profiles-v1', enemy)
  }
})

test('CHAOS calmness expansion preserves the relevant sense rather than leaking into physical or political senses', () => {
  const senses = {
    CALM: 'oewn-calm__5.00.00.composed.00',
    COOL: 'oewn-cool__5.00.00.composed.00',
    TRANQUIL: 'oewn-tranquil__5.00.00.composed.00',
    TRANQUILLY: 'oewn-tranquilly__4.02.01..',
    QUIET: 'oewn-quiet__3.00.02..',
    QUIETLY: 'oewn-quietly__4.02.02..',
    PLACID: 'oewn-placid__5.00.00.good-natured.00',
    STILL: 'oewn-still__2.37.00..',
    REPOSE: 'oewn-repose__1.07.00..',
    RELAXATION: 'oewn-relaxation__1.12.00..',
    BALANCE: 'oewn-balance__1.07.00..',
    CLARITY: 'oewn-clarity__1.07.01..',
    COHERENT: 'oewn-coherent__3.00.00..',
  }
  for (const [word, sense] of Object.entries(senses)) assert.equal(profiles.CHAOS.relations[word]?.senseId, sense, word)
  // Physical rest, silence, weather, sedation, lack of war, or merely positive
  // sentiment do not by themselves establish composure or an orderly state.
  for (const word of [
    'REST', 'SLEEP', 'SLUMBER', 'STILLNESS', 'MOTIONLESS', 'WINDLESS', 'SILENT', 'NOISELESS',
    'SEDATIVE', 'SEDATION', 'PACIFIST', 'PACIFISTIC', 'DOVISH', 'NONBELLIGERENT',
    'HAPPY', 'CHEERFUL', 'KIND', 'EASY', 'MILD', 'COLD', 'COOLANT', 'ADHESIVE',
  ]) assert.notEqual(profiles.CHAOS.relations[word]?.relation, 'opposite', word)
})

test('all six enemy profiles have meaningful counter and resistance examples', () => {
  const cases: [keyof typeof profiles, string[], string[]][] = [
    ['ANGER', ['CHEERFUL', 'CALM', 'PATIENCE'], ['ANGRY', 'RAGE', 'RESENTFUL']],
    ['DESPAIR', ['HOPE', 'HOPEFUL', 'OPTIMISM'], ['DESPAIR', 'HOPELESS', 'DESPERATE']],
    ['FEAR', ['COURAGE', 'SAFE', 'SECURITY'], ['TERROR', 'PANIC', 'WORRY']],
    ['MELANCHOLY', ['JOY', 'CHEERY', 'HAPPY'], ['SAD', 'GLOOMY', 'TEARFUL']],
    ['CRUELTY', ['KIND', 'MERCY', 'COMPASSION'], ['CRUEL', 'MERCILESS', 'TORTURE']],
    ['CHAOS', ['TIDY', 'ORDER', 'SORT', 'PLAN', 'CALM', 'PEACE', 'SERENE'], ['CHAOTIC', 'MESSY', 'RANDOM']],
  ]
  for (const [enemy, counters, reinforcements] of cases) {
    for (const word of counters) assert.equal(profiles[enemy].relations[word]?.relation, 'opposite', `${enemy}: ${word}`)
    for (const word of reinforcements) assert.equal(profiles[enemy].relations[word]?.relation, 'similar', `${enemy}: ${word}`)
  }
})

test('every generated profile record has licensed word evidence and a verifiable source path', () => {
  for (const [enemy, profile] of Object.entries(profiles)) {
    // Profiles retain their pinned OEWN relation graph; the merged validity
    // dictionary adds function words without inventing graph relationships.
    assert.equal(profile.dictionaryVersion, WORD_MEANINGS_VERSION)
    assert.notEqual(profile.dictionaryVersion, MEANING_DICTIONARY_VERSION)
    for (const [word, record] of Object.entries(profile.relations)) {
      const context = `${enemy}: ${word}`
      assert.ok(getDictionaryMeaning(word), context)
      const sense = getMeaningSense(record.senseId)!
      assert.equal(record.definition, sense.definition, context)
      assert.equal(record.lemma, sense.lemma, context)
      assert.ok(getWordMeanings(word).senses.some(candidate => candidate.id === record.senseId), context)
      const root = profile.roots.find(root => root.senseId === record.rootSense)
      assert.ok(root, context)
      if ('derivations' in root && root.derivations === false) {
        assert.ok(record.evidence.every(edge => edge.type !== 'derivation'), context)
      }
      if ('similarities' in root && root.similarities === false) {
        assert.ok(record.evidence.every(edge => edge.type !== 'similar'), context)
      }
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
