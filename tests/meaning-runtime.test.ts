import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLetterStrikeGame, previewLetterStrike, submitLetterStrike,
} from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../src/game/letterStrike.ts'
import { getEncounterWordClassification } from '../src/game/lexicalRules.ts'
import {
  canSpellEncounterWord, getStoredWordMeaning, isEncounterWord,
  MEANING_LEXICON_VERSION, meaningSupply,
} from '../src/game/meaningLexicon.ts'
import type { PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import { findPlayableWords, findValidMoves } from '../src/generator/findMoves.ts'
import { encounterRuleKey, stateKey } from '../src/generator/stateKey.ts'

const meanings: Record<string, PuzzleWordMeaning> = {
  CHEERFUL: meaning('CHEERFUL', 'opposite', 'being full of good spirits', 'Good spirits counter the enemy’s anger.'),
  ANGRY: meaning('ANGRY', 'similar', 'feeling or showing anger', 'Expresses the same feeling as the enemy.'),
  CAREFUL: meaning('CAREFUL', 'related', 'exercising caution or care', 'Caution can accompany anger but does not counter it.'),
  CAT: meaning('CAT', 'unrelated', 'a small domesticated feline', 'This animal sense does not counter or express anger.'),
}

function meaning(word: string, relation: PuzzleWordMeaning['relation'], definition: string, reason: string): PuzzleWordMeaning {
  return { definition, reason, relation, lemma: word.toLowerCase(), senseId: `fixture:${word.toLowerCase()}`,
    partsOfSpeech: word === 'CAT' ? ['noun'] : ['adjective'], source: 'oewn-2025', evidence: 'reviewed-profile' }
}

function encounter({ board = 'CHEERFULANGRYCAT', refill = '', words = meanings }:
  { board?: string; refill?: string; words?: Record<string, PuzzleWordMeaning> } = {}): LetterStrikeEncounter {
  assert.equal(board.length, 16)
  const result: LetterStrikeEncounter = {
    id: 'meaning-runtime-fixture',
    enemy: { word: 'ANGER', definition: 'a feeling of displeasure or hostility', partOfSpeech: 'noun',
      // Deliberately contradict the stored meanings: the frozen table must win.
      semanticRelations: { opposite: ['ANGRY'], similar: ['CHEERFUL'], related: [] } },
    enemyLetters: [...'ANGER'].map((letter, index) => ({ id: `enemy-${index}`, letter, initialHits: 1, hitsRemaining: 1 })),
    startingTiles: [...board].map((letter, id) => ({ id, letter, type: 'normal' })),
    startingResolve: 5, finiteRefills: true, refillQueue: refill, minimumWordLength: 3, grammarModifiers: {},
    tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true } },
  }
  result.meaningLexicon = {
    version: MEANING_LEXICON_VERSION, dictionaryVersion: 'fixture-definitions', profileVersion: 'fixture-anger',
    policy: 'defined-only', enemyWord: 'ANGER', letterSupply: meaningSupply(result), minimumWordLength: 3,
    maximumWordLength: 16, words: structuredClone(words),
  }
  return result
}

function select(state: LetterStrikeState, word: string): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = state.tiles.find(tile => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing ${letter} for ${word}`)
    ids.push(tile.id)
  }
  return ids
}

test('stored definitions and relations control preview and solver instead of the old sparse enemy lists', () => {
  const state = createLetterStrikeGame(encounter())
  const counter = previewLetterStrike(state, select(state, 'CHEERFUL'))
  assert.equal(counter.valid, true)
  assert.equal(counter.semanticLabel, 'COUNTER')
  assert.equal(counter.strikes, 2)
  assert.deepEqual(counter.hits.map(hit => hit.letter), ['E', 'R'])
  assert.equal(counter.grammaticalModifier, 0)
  assert.equal(counter.longWordModifier, 0)
  assert.equal(previewLetterStrike(state, select(state, 'ANGRY')).semanticLabel, 'RESISTED')
  assert.equal(previewLetterStrike(state, select(state, 'ANGRY')).strikes, 0)
  const related = previewLetterStrike(state, select(state, 'CAREFUL'))
  assert.equal(related.semanticLabel, 'NEUTRAL')
  assert.equal(related.strikes, 1)
  assert.equal(related.grammaticalModifier, 0)
  assert.equal(related.longWordModifier, 0)
  const classification = getEncounterWordClassification(state.encounter, 'cheerful')
  assert.equal(classification.definition, meanings.CHEERFUL.definition)
  assert.equal(classification.semanticReason, meanings.CHEERFUL.reason)
  assert.equal(classification.semanticSource, 'compiled')
  assert.equal(getStoredWordMeaning(state.encounter, ' cheerful ')?.relation, 'opposite')
  const solved = findValidMoves(state, { vocabulary: ['CHEERFUL'] })[0]
  assert.equal(solved.semanticLabel, counter.semanticLabel)
  assert.deepEqual(solved.hits, previewLetterStrike(state, solved.tileIds).hits)
  assert.deepEqual(solved.resultingState, submitLetterStrike(state, solved.tileIds))
})

test('a known English spelling absent from the puzzle meanings cannot silently play as neutral', () => {
  const state = createLetterStrikeGame(encounter())
  assert.equal(isEncounterWord(state.encounter, 'CARE'), false)
  const ids = select(state, 'CARE')
  const preview = previewLetterStrike(state, ids)
  assert.equal(preview.valid, false)
  assert.match(preview.error!, /dictionary/)
  assert.deepEqual(preview.hits, [])
  assert.equal(preview.strikes, 0)
  const submitted = submitLetterStrike(state, ids)
  assert.equal(submitted.playerResolve, 5)
  assert.deepEqual(submitted.tiles, state.tiles)
  assert.deepEqual(submitted.playedWords, [])
  assert.deepEqual(findValidMoves(state, { vocabulary: ['CARE'] }), [])
})

test('an empty stored definition and stale meaning metadata are rejected before a game is created', () => {
  const missing = encounter({ words: { CAT: { ...meanings.CAT, definition: '  ' } } })
  assert.equal(isEncounterWord(missing, 'CAT'), false)
  assert.throws(() => createLetterStrikeGame(missing), /Missing definition/)
  for (const mutate of [
    (value: LetterStrikeEncounter) => { value.refillQueue = 'X' },
    (value: LetterStrikeEncounter) => { value.meaningLexicon!.enemyWord = 'FEAR' },
    (value: LetterStrikeEncounter) => { value.meaningLexicon!.minimumWordLength = 4 },
    (value: LetterStrikeEncounter) => { value.meaningLexicon!.maximumWordLength = 12 },
  ]) {
    const stale = encounter(); mutate(stale)
    assert.throws(() => createLetterStrikeGame(stale), /stale/)
  }
})

test('meaning-only puzzles reject word-type and length bonuses even if the board otherwise works', () => {
  assert.throws(() => createLetterStrikeGame({ ...encounter(), grammarModifiers: { adjective: 1 } }), /Meaning-only/)
  assert.throws(() => createLetterStrikeGame({ ...encounter(), longWordRule: { minimumLength: 6, bonusStrikes: 1 } }), /Meaning-only/)
  assert.doesNotThrow(() => createLetterStrikeGame({ ...encounter(), grammarModifiers: { adjective: 0 } }))
})

test('terminal detection uses stored meanings both before a move and after finite refills run out', () => {
  const noOpening = encounter({ board: 'CATXXXXXXXXXXXXX', refill: 'CHEERFUL', words: { CHEERFUL: meanings.CHEERFUL } })
  assert.equal(canSpellEncounterWord(noOpening, [...'CAT']), false)
  assert.equal(createLetterStrikeGame(noOpening).status, 'lost')
  const legacyOpening = { ...noOpening, meaningLexicon: undefined }
  assert.equal(createLetterStrikeGame(legacyOpening).status, 'playing')
  const state = createLetterStrikeGame(encounter({ board: 'CATEELXXXXXXXXXX', words: { CAT: meanings.CAT } }))
  const after = submitLetterStrike(state, select(state, 'CAT'))
  assert.equal(after.status, 'lost')
  assert.equal(after.playerResolve, 4)
  assert.equal(after.tiles.map(tile => tile.letter).join(''), 'EELXXXXXXXXXX')
  assert.equal(canSpellEncounterWord(after.encounter, after.tiles.map(tile => tile.letter)), false)
  assert.equal(canSpellEncounterWord({ ...after.encounter, meaningLexicon: undefined }, after.tiles.map(tile => tile.letter)), true)
})

test('move caches and solver state keys keep old dictionaries and distinct compiled word sets separate', () => {
  const base = encounter()
  const legacy = createLetterStrikeGame({ ...base, meaningLexicon: undefined })
  const full = createLetterStrikeGame(base)
  const onlyCat = createLetterStrikeGame(encounter({ words: { CAT: meanings.CAT } }))
  assert.ok(findPlayableWords(legacy).includes('CARE'))
  assert.deepEqual(findPlayableWords(onlyCat), ['CAT'])
  assert.deepEqual(findPlayableWords(full), Object.keys(meanings).sort())
  // Repeat after every variant warmed the shared letter-multiset cache.
  assert.ok(findPlayableWords(legacy).includes('CARE'))
  assert.deepEqual(findPlayableWords(onlyCat), ['CAT'])
  assert.notEqual(stateKey(legacy), stateKey(full))
  assert.notEqual(stateKey(full), stateKey(onlyCat))
  const changed = encounter({ words: { ...meanings, CHEERFUL: { ...meanings.CHEERFUL, relation: 'similar' } } })
  assert.notEqual(encounterRuleKey(base), encounterRuleKey(changed))
})

test('archived encounters retain old word validity, semantic lists and length/type effects', () => {
  const old = { ...encounter(), meaningLexicon: undefined, grammarModifiers: { adjective: 1 },
    wordPartsOfSpeech: { CAREFUL: ['adjective' as const] }, longWordRule: { minimumLength: 6, bonusStrikes: 1 } }
  const state = createLetterStrikeGame(old)
  assert.equal(previewLetterStrike(state, select(state, 'CARE')).valid, true)
  assert.equal(previewLetterStrike(state, select(state, 'CHEERFUL')).semanticLabel, 'RESISTED')
  assert.equal(previewLetterStrike(state, select(state, 'ANGRY')).semanticLabel, 'COUNTER')
  const careful = previewLetterStrike(state, select(state, 'CAREFUL'))
  assert.equal(careful.grammaticalModifier, 1)
  assert.equal(careful.longWordModifier, 1)
})
