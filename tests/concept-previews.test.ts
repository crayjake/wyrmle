import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { conceptPreviews, conceptProgressKey, decodeConceptPuzzle } from '../src/experimental/synonyms/catalog.ts'
import { readBingoProgress, restartBingoAttempt, resumeBingoAttempt, saveBingoAttempt, describeBingoProgress } from '../src/experimental/bingo/progress.ts'
import { createLetterStrikeGame, evaluateLetterStrike, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { isEncounterWord } from '../src/game/meaningLexicon.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { getStrikeSummary } from '../src/components/strikeSummary.ts'

const encounters = new Map(conceptPreviews.map(entry => [entry.id,
  decodeConceptPuzzle(JSON.parse(readFileSync(new URL(`../public/${entry.asset}`, import.meta.url), 'utf8')), entry)]))
const routes: Record<string, string[][]> = {
  fiction: [['FABRICATION'], ['FALSITY', 'DECEPTION'], ['FANCY', 'LIE', 'INVENTION']],
  eternal: [['INTERMINABLE'], ['ENDLESS', 'IMMORTAL'], ['ENDLESS', 'LASTING', 'FOREVER']],
  'calm-power': [['PEACEFUL'], ['PEACE', 'MILD'], ['MILD', 'EASE', 'PEACE']],
  'gloom-power': [['MELANCHOLY'], ['MOROSE', 'LOW'], ['LOW', 'MISERY', 'SORROW']],
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

test('all four downloadable boards have working one-, two- and three-word wins', () => {
  assert.equal(encounters.size, 4)
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

test('POWER enables bingos that are impossible anywhere on the unpowered starting boards', () => {
  for (const id of ['calm-power', 'gloom-power']) {
    const state = initial(id)
    const plain = createLetterStrikeGame({ ...state.encounter,
      startingTiles: state.tiles.map(tile => ({ id: tile.id, letter: tile.letter, type: 'normal' })) })
    for (const word of Object.keys(plain.encounter.meaningLexicon!.words)) {
      const ids = selectWordIds(plain.tiles, word)
      if (ids) assert.notEqual(submitLetterStrike(plain, ids).status, 'won', `${id}: unexpected unpowered ${word}`)
    }
    const word = routes[id][0][0]
    const preview = previewLetterStrike(state, selectWordIds(state.tiles, word)!)
    assert.equal(preview.hits.filter(hit => hit.wild).length, id === 'calm-power' ? 1 : 2)
    assert.deepEqual(play(state, word).enemyLetters, preview.enemyLetters)
    const summary = getStrikeSummary(preview, 3, state.encounter.enemy.word, true)
    assert.equal(summary?.meaning, `Synonym of ${state.encounter.enemy.word}`)
    assert.ok(summary?.details.some(detail => detail.text.startsWith('Power hits ')))
  }
})

test('non-synonyms spend a life and refill but cannot get normal or POWER hits', () => {
  const game = initial('calm-power')
  const ids = selectWordIds(game.tiles, 'FLAME')!
  assert.ok(ids.some(id => game.tiles.find(tile => tile.id === id)?.gem === 'power'))
  const next = play(game, 'FLAME')
  assert.equal(next.playedWords[0].strikes, 0)
  assert.equal(next.playerResolve, 2)
  assert.equal(next.refillIndex, 5)
  assert.equal(next.tiles.some(tile => tile.gem === 'power'), false)
  assert.deepEqual(next.enemyLetters, game.enemyLetters)
})

test('synonyms hit normally, physical POWER tiles trigger once, and legacy rules stay counter based', () => {
  const game = initial('gloom-power')
  const ids = selectWordIds(game.tiles, 'MOROSE')!
  const tiles = ids.map(id => game.tiles.find(tile => tile.id === id)!)
  const preview = evaluateLetterStrike(game, tiles)
  assert.equal(preview.strikes, 4)
  assert.equal(preview.hits.filter(hit => hit.wild).length, 1)
  assert.equal(previewLetterStrike(game, [...ids, ids[0]]).valid, false)
  assert.equal(submitLetterStrike(game, [...ids, ids[0]]).playedWords.length, 0)
  const armoured = { ...game, enemyLetters: game.enemyLetters.map((letter, index) => index === 0
    ? { ...letter, initialHits: 2, hitsRemaining: 2 } : letter) }
  assert.equal(evaluateLetterStrike(armoured, tiles).enemyLetters[0].hitsRemaining, 1)
  const next = play(game, 'MOROSE')
  assert.equal(next.tiles.filter(tile => tile.gem === 'power').length, 1)
  assert.equal(next.tiles.find(tile => tile.gem === 'power')!.letter, 'C')
  const legacy = { ...game, encounter: { ...game.encounter, synonymRules: undefined } }
  assert.equal(previewLetterStrike(legacy, ids).strikes, 0)
  assert.equal(previewLetterStrike(legacy, ids).semanticLabel, 'RESISTED')
})

test('enemy words and their own forms are excluded, ordinary synonym inflections survive', () => {
  for (const [id, words] of Object.entries({ fiction: ['FICTION', 'FICTIONS'], eternal: ['ETERNAL', 'ETERNALLY'],
    'calm-power': ['CALM', 'CALMS', 'CALMER'], 'gloom-power': ['GLOOM', 'GLOOMS', 'GLOOMY'] })) {
    const game = initial(id)
    for (const word of words) assert.equal(isEncounterWord(game.encounter, word), false)
    const ids = selectWordIds(game.tiles, game.encounter.enemy.word)
    if (ids) {
      const next = submitLetterStrike(game, ids)
      assert.equal(next.error, 'Use a different word from the enemy')
      assert.equal(next.playerResolve, 3)
      assert.deepEqual(next.tiles, game.tiles)
      assert.equal(next.playedWords.length, 0)
    }
  }
  const fiction = initial('fiction')
  for (const word of ['LIE', 'LIES', 'FABLE', 'FABLES']) {
    assert.equal(previewLetterStrike(fiction, selectWordIds(fiction.tiles, word)!).semanticLabel, 'COUNTER')
    assert.equal(fiction.encounter.meaningLexicon!.words[word].relation, 'similar')
  }
})

test('preview progress resumes actual moves, keeps best stars on retry and does not touch Daily', () => {
  const data = new Map([['wyrmle:daily:sentinel', 'unchanged']])
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const entry = conceptPreviews[0]
  const key = conceptProgressKey(entry)
  const start = initial(entry.id)
  const first = play(start, 'FANCY')
  assert.equal(saveBingoAttempt(key, first, true, 2, storage), true)
  assert.deepEqual(resumeBingoAttempt(key, start.encounter, storage).game, first)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).status, 'ongoing')
  const won = play(play(first, 'LIE'), 'INVENTION')
  saveBingoAttempt(key, won, true, 2, storage)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).stars, 1)
  restartBingoAttempt(key, 3, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 3)
  saveBingoAttempt(key, play(start, 'FABRICATION'), true, 1, storage)
  assert.equal(describeBingoProgress(readBingoProgress(key, storage), 3).stars, 3)
  saveBingoAttempt(key, won, true, 1, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 1)
  assert.deepEqual([...data.keys()], ['wyrmle:daily:sentinel', key])
  assert.equal(data.get('wyrmle:daily:sentinel'), 'unchanged')
  assert.equal(readBingoProgress(conceptProgressKey(conceptPreviews[1]), storage).bestWords, null)
  assert.notEqual(conceptProgressKey({ ...entry, revision: 'replacement' }), key)
})

test('mismatched preview downloads fail explicitly', () => {
  assert.throws(() => decodeConceptPuzzle(null, conceptPreviews[0]))
  assert.throws(() => decodeConceptPuzzle(encounters.get('fiction'), conceptPreviews[1]), /Wrong preview/)
})
