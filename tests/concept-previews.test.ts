import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { conceptPreviews, conceptProgressKey, decodeConceptPuzzle } from '../src/experimental/concepts/catalog.ts'
import { readBingoProgress, restartBingoAttempt, resumeBingoAttempt, saveBingoAttempt, describeBingoProgress } from '../src/experimental/bingo/progress.ts'
import { createLetterStrikeGame, evaluateLetterStrike, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { isEncounterWord } from '../src/game/meaningLexicon.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { getStrikeSummary } from '../src/components/strikeSummary.ts'
import { certifyProgression, physicalChoices } from '../scripts/antonyms/progression.ts'
import { antonymProfiles } from '../scripts/antonyms/profiles.ts'

const encounters = new Map(conceptPreviews.map(entry => [entry.id,
  decodeConceptPuzzle(JSON.parse(readFileSync(new URL(`../public/${entry.asset}`, import.meta.url), 'utf8')), entry)]))
const routes: Record<string, string[][]> = {
  ...Object.fromEntries(antonymProfiles.map(profile => [profile.id, profile.routes])),
  dry: [['HYDRATED'], ['DAMP', 'WATERY'], ['DAMP', 'SOGGY', 'RAINY']],
  mean: [['COMPASSIONATE'], ['KIND', 'AMIABLE'], ['KIND', 'NICE', 'WARM']],
  'dread-power': [['FEARLESSNESS'], ['BOLDNESS', 'DARING'], ['EASE', 'NERVE', 'RELIEF']],
  'eternal-power': [['IMPERMANENT'], ['TEMPORAL', 'FINITE'], ['BRIEF', 'FINITE', 'MORTAL']],
  'sear-family': [['IRRIGATES'], ['SPRINKLE', 'WATERS'], ['MIST', 'SOAK', 'WATER']],
  'dirt-family': [['STERILISED'], ['DUST', 'RINSE'], ['DUST', 'WIPE', 'SCRUB']],
}
const initial = (id: string) => createLetterStrikeGame(encounters.get(id)!)
function play(game: LetterStrikeState, word: string) {
  const ids = selectWordIds(game.tiles, word)
  assert.ok(ids, `${word} on ${game.encounter.enemy.word}`)
  const next = submitLetterStrike(game, ids)
  assert.equal(next.error, null)
  assert.equal(next.playedWords.at(-1)?.word, word)
  return next
}

test('all downloadable boards have working one-, two- and three-word wins', () => {
  assert.equal(encounters.size, 21)
  for (const [id, paths] of Object.entries(routes)) for (const path of paths) {
    let game = initial(id)
    for (const word of path) {
      assert.equal(game.status, 'playing', `${id}: route must need every word`)
      game = play(game, word)
      assert.ok(game.playedWords.at(-1)!.strikes > 0)
    }
    assert.equal(game.status, 'won', `${id}: ${path}`)
    assert.equal(game.playerResolve, 3 - path.length)
  }
})

test('all boards pass exhaustive two-word difficulty checks, including neutral setups and POWER selections', () => {
  for (const [id, paths] of Object.entries(routes)) {
    const report = certifyProgression(encounters.get(id)!, paths)
    assert.equal(report.searchComplete, true)
    assert.deepEqual(report.issues, [], id)
    assert.equal(report.passed, true, id)
  }
})

test('the difficulty gate rejects a cheap neutral refill setup, not just easy counter pairs', () => {
  const encounter = structuredClone(encounters.get('sear-family')!)
  encounter.enemy.word = 'SEAR'
  encounter.meaningLexicon!.enemyWord = 'SEAR'
  encounter.enemyLetters = encounter.enemyLetters!.slice(0, -1)
  const report = certifyProgression(encounter, [['IRRIGATES'], ['SPRINKLE', 'WATER'], ['MIST', 'SOAK', 'WATER']])
  assert.equal(report.passed, false)
  assert.ok(report.issues.includes('Three-word route must be easier than the cheapest two-word win'))
  assert.equal(report.cheapestTwo.hits[0], 0)
})

test('strict previews require matching word types; the family pair deliberately tests one of each', () => {
  for (const encounter of encounters.values()) {
    const rule = encounter.counterRules!
    if (rule.kind === 'antonym') assert.equal(rule.partOfSpeech, encounter.enemy.partOfSpeech)
    for (const meaning of Object.values(encounter.meaningLexicon!.words)) {
      if (meaning.relation === 'opposite') assert.deepEqual(meaning.partsOfSpeech, [rule.partOfSpeech])
    }
  }
  const sear = encounters.get('sear-family')!, dirt = encounters.get('dirt-family')!
  assert.equal(sear.enemy.partOfSpeech, 'verb'); assert.equal(sear.counterRules?.partOfSpeech, 'verb')
  assert.equal(dirt.enemy.partOfSpeech, 'noun'); assert.equal(dirt.counterRules?.partOfSpeech, 'verb')
  for (const [id, words] of Object.entries({ dry: ['HYDRATE', 'WATER'], mean: ['COMPASSION'],
    'dread-power': ['FEARLESS', 'NERVES'], 'eternal-power': ['BRIEFLY'],
    'sear-family': ['SHADE', 'MEND'], 'dirt-family': ['STERILE', 'PRETTIER'] })) {
    const game = initial(id)
    for (const word of words) {
      // Evaluate actual word types even when this spelling needs future refills.
      const tiles = [...word].map((letter, id) => ({ letter, id, type: 'normal' as const }))
      assert.equal(evaluateLetterStrike(game, tiles).strikes, 0, `${id}/${word}`)
    }
  }
  for (const [id, words] of Object.entries({ dry: ['HYDRATED', 'SATURATED', 'SODDEN', 'WATERLOGGED'],
    alert: ['DISTRACTED', 'WEARY'], hostile: ['PEACEFUL', 'PEACEABLE'], rude: ['TACTFUL', 'SOFT'],
    mean: ['POLITE', 'WARMHEARTED'], 'sear-family': ['DAMP', 'DAMPS', 'DAMPING', 'SATURATE', 'SATURATES'], 'dread-power': ['EASE', 'RELIEF'] })) {
    for (const word of words) assert.equal(encounters.get(id)!.meaningLexicon!.words[word]?.relation, 'opposite', `${id}/${word}`)
  }
  assert.equal(encounters.get('dry')!.meaningLexicon!.words.HYDRATED.source, 'wiktionary-en')
  assert.equal(encounters.get('dread-power')!.meaningLexicon!.words.NERVES.relation, 'similar')
  assert.equal(encounters.get('sear-family')!.meaningLexicon!.words.WATER.partsOfSpeech[0], 'verb')
  assert.equal(encounters.get('dirt-family')!.meaningLexicon!.words.DUST.partsOfSpeech[0], 'verb')
  const wrong = structuredClone(sear)
  wrong.counterRules!.kind = 'antonym'
  wrong.enemy.partOfSpeech = 'noun'
  assert.throws(() => createLetterStrikeGame(wrong), /Antonym previews/)
  const wrongSense = structuredClone(sear)
  wrongSense.meaningLexicon!.words.IRRIGATES.partsOfSpeech = ['noun']
  assert.throws(() => createLetterStrikeGame(wrongSense), /part of speech/)
})

test('POWER enables bingos that are impossible on the unpowered starting boards', () => {
  for (const id of ['dread-power', 'eternal-power', 'sear-family']) {
    const state = initial(id)
    const plain = createLetterStrikeGame({ ...state.encounter,
      startingTiles: state.tiles.map(tile => ({ id: tile.id, letter: tile.letter, type: 'normal' })) })
    for (const word of Object.keys(plain.encounter.meaningLexicon!.words)) {
      const ids = selectWordIds(plain.tiles, word)
      if (ids) assert.notEqual(submitLetterStrike(plain, ids).status, 'won', `${id}: unexpected unpowered ${word}`)
    }
    const word = routes[id][0][0]
    const preview = previewLetterStrike(state, selectWordIds(state.tiles, word)!)
    assert.equal(preview.hits.filter(hit => hit.wild).length, id === 'dread-power' ? 2 : 1)
    assert.deepEqual(play(state, word).enemyLetters, preview.enemyLetters)
    const summary = getStrikeSummary(preview, 3, state.encounter.enemy.word, state.encounter.counterRules)
    assert.equal(summary?.meaning, `${state.encounter.counterRules!.kind === 'family' ? 'Counters' : 'Opposite of'} ${state.encounter.enemy.word}`)
    assert.ok(summary?.details.some(detail => detail.text.startsWith('Power hits ')))
  }
})

test('non-counters spend a life and refill but cannot get normal or POWER hits', () => {
  const game = initial('eternal-power')
  const ids = selectWordIds(game.tiles, 'PAINT')!
  assert.ok(ids.some(id => game.tiles.find(tile => tile.id === id)?.gem === 'power'))
  const next = play(game, 'PAINT')
  assert.equal(next.playedWords[0].strikes, 0)
  assert.equal(next.playerResolve, 2)
  assert.equal(next.refillIndex, 5)
  assert.equal(next.tiles.some(tile => tile.gem === 'power'), false)
  assert.deepEqual(next.enemyLetters, game.enemyLetters)
})

test('physical POWER choices include saving a duplicate; Daily still permits neutral chip damage', () => {
  const game = initial('dread-power')
  const power = game.tiles.find(t => t.gem === 'power' && t.letter === 'L')!
  const variant = { ...game, tiles: [...game.tiles, { id: 99, letter: 'L', type: 'normal' as const }] }
  const choices = physicalChoices(variant, 'FEARLESS')
  assert.ok(choices.some(ids => ids.includes(power.id)))
  assert.ok(choices.some(ids => !ids.includes(power.id)))
  const ids = selectWordIds(game.tiles, 'BOLDNESS')!
  assert.equal(previewLetterStrike(game, [...ids, ids[0]]).valid, false)
  assert.equal(submitLetterStrike(game, [...ids, ids[0]]).playedWords.length, 0)
  const dry = initial('dry'), neutralIds = selectWordIds(dry.tiles, 'DAY')!
  assert.equal(previewLetterStrike(dry, neutralIds).strikes, 0)
  const daily = { ...dry, encounter: { ...dry.encounter, counterRules: undefined } }
  assert.equal(previewLetterStrike(daily, neutralIds).strikes, 1)
  assert.equal(previewLetterStrike(daily, neutralIds).semanticLabel, 'NEUTRAL')
})

test('enemy forms are excluded while ordinary counter inflections survive', () => {
  for (const encounter of encounters.values()) {
    assert.equal(isEncounterWord(encounter, encounter.enemy.word), false)
  }
  const game = initial('mean')
  for (const word of ['KIND', 'KINDER', 'KINDEST']) {
    assert.equal(previewLetterStrike(game, selectWordIds(game.tiles, word)!).semanticLabel, 'COUNTER')
    assert.equal(game.encounter.meaningLexicon!.words[word].relation, 'opposite')
  }
})

test('preview progress resumes actual moves, keeps best stars on retry and does not touch Daily', () => {
  const data = new Map([['wyrmle:daily:sentinel', 'unchanged']])
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const entry = conceptPreviews.find(entry => entry.id === 'dry')!, key = conceptProgressKey(entry), start = initial(entry.id)
  const first = play(start, 'DAMP')
  assert.equal(saveBingoAttempt(key, first, true, 2, storage), true)
  assert.deepEqual(resumeBingoAttempt(key, start.encounter, storage).game, first)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).status, 'ongoing')
  const won = play(play(first, 'SOGGY'), 'RAINY')
  saveBingoAttempt(key, won, true, 2, storage)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).stars, 1)
  restartBingoAttempt(key, 3, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 3)
  saveBingoAttempt(key, play(start, 'HYDRATED'), true, 1, storage)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).stars, 3)
  saveBingoAttempt(key, won, true, 1, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 1)
  assert.deepEqual([...data.keys()], ['wyrmle:daily:sentinel', key])
  assert.equal(data.get('wyrmle:daily:sentinel'), 'unchanged')
  assert.equal(readBingoProgress(conceptProgressKey(conceptPreviews[1]), storage).bestWords, null)
  assert.notEqual(conceptProgressKey({ ...entry, revision: 'replacement' }), key)
})

test('mismatched and obsolete preview downloads fail explicitly', () => {
  assert.throws(() => decodeConceptPuzzle(null, conceptPreviews[0]))
  assert.throws(() => decodeConceptPuzzle(encounters.get('dry'), conceptPreviews[1]), /Wrong preview/)
  const obsolete = { ...encounters.get('dry'), id: 'synonym-preview-v1:dry' }
  assert.throws(() => decodeConceptPuzzle(obsolete, conceptPreviews[0]), /Wrong preview/)
})
