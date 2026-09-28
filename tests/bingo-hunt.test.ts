import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { conceptPreviews, conceptProgressKey, decodeConceptPuzzle } from '../src/experimental/concepts/catalog.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { getStrikeSummary } from '../src/components/strikeSummary.ts'
import { readBingoProgress, resumeBingoAttempt, saveBingoAttempt, restartBingoAttempt } from '../src/experimental/bingo/progress.ts'
import { winStars } from '../src/game/rating.ts'

const entries = conceptPreviews.filter(entry => entry.bingoHunt)
const encounter = (id: string) => {
  const entry = entries.find(entry => entry.id === id)!
  return decodeConceptPuzzle(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')), entry)
}
const sorted = (text: string) => [...text].sort().join('')
function play(state: LetterStrikeState, word: string) {
  const ids = selectWordIds(state.tiles, word)
  assert.ok(ids, word)
  const next = submitLetterStrike(state, ids)
  assert.equal(next.error, null, word)
  return next
}

test('hunt wins in 1/2/3 guesses award 3/2/1 stars without damage or refills', () => {
  assert.equal(entries.length, 2)
  for (const [id, helpers] of [['hunt-alert', ['SLOW', 'INERT']], ['hunt-true', ['WRONG', 'UNREAL']]] as const) {
    const initial = createLetterStrikeGame(encounter(id)), answer = initial.encounter.bingoHunt!.answer
    for (let guesses = 1; guesses <= 3; guesses++) {
      let game = initial
      for (const word of [...helpers.slice(0, guesses - 1), answer]) game = play(game, word)
      assert.equal(game.status, 'won')
      assert.equal(game.playedWords.length, guesses)
      assert.equal(winStars(guesses), 4 - guesses)
      assert.equal(game.playerResolve, 3 - guesses)
      assert.equal(game.refillIndex, 0)
      assert.equal(game.nextTileId, initial.nextTileId)
      assert.deepEqual(game.enemyLetters, initial.enemyLetters)
      assert.ok(game.playedWords.every(move => move.strikes === 0 && move.preview.hits.length === 0))
    }
  }
})

test('every accepted helper path preserves all answer copies and leaves its exact anagram on the final life', () => {
  for (const entry of entries) {
    const initial = createLetterStrikeGame(encounter(entry.id)), rule = initial.encounter.bingoHunt!
    const words = Object.keys(initial.encounter.meaningLexicon!.words)
    let checked = 0
    for (const first of words) {
      const ids = selectWordIds(initial.tiles, first)
      if (!ids || !previewLetterStrike(initial, ids).valid) continue
      const after = submitLetterStrike(initial, ids)
      if (after.status === 'won') continue
      assert.equal(after.tiles.filter(tile => !tile.letter).length, Math.ceil(rule.removalOrder.length / 2))
      assert.ok(selectWordIds(after.tiles, rule.answer))
      for (const second of words) {
        const secondIds = selectWordIds(after.tiles, second)
        if (!secondIds || !previewLetterStrike(after, secondIds).valid) continue
        const final = submitLetterStrike(after, secondIds)
        if (final.status === 'won') continue
        checked++
        assert.equal(final.playerResolve, 1)
        assert.equal(sorted(final.tiles.map(tile => tile.letter).join('')), sorted(rule.answer))
        assert.equal(play(final, rule.answer).status, 'won')
      }
    }
    assert.ok(checked > 0, entry.id)
  }
})

test('invalid meanings and repeats spend no lives, reveal no spare tiles, and do not enter the log', () => {
  const initial = createLetterStrikeGame(encounter('hunt-alert'))
  const neutral = Object.keys(initial.encounter.meaningLexicon!.words).find(word => {
    return initial.encounter.meaningLexicon!.words[word].relation !== 'opposite' && selectWordIds(initial.tiles, word)
  })!
  const invalid = submitLetterStrike(initial, selectWordIds(initial.tiles, neutral)!)
  assert.match(invalid.error!, /No life lost/)
  assert.deepEqual({ ...invalid, error: null }, initial)
  const first = play(initial, 'INERT')
  const repeated = submitLetterStrike(first, selectWordIds(first.tiles, 'INERT')!)
  assert.match(repeated.error!, /Already tried/)
  assert.deepEqual({ ...repeated, error: null }, first)
  const ids = selectWordIds(initial.tiles, 'SLOW')!
  assert.equal(previewLetterStrike(initial, [...ids, ids[0]]).valid, false)
  const preview = previewLetterStrike(initial, ids)
  assert.deepEqual(initial.tiles, initial.encounter.startingTiles)
  assert.equal(preview.strikes, 0)
  assert.equal(getStrikeSummary(preview, 3, 'ALERT', initial.encounter.counterRules)?.hits, '4 spare tiles removed')
})

test('hunt saves replay removals exactly, keep their best stars, and remain separate from classic previews', () => {
  const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const entry = entries[0], key = conceptProgressKey(entry), start = createLetterStrikeGame(encounter(entry.id))
  const first = play(start, 'SLOW')
  saveBingoAttempt(key, first, true, 1, storage)
  assert.deepEqual(resumeBingoAttempt(key, start.encounter, storage).game, first)
  const won = play(play(first, 'INERT'), entry.guide.answer)
  saveBingoAttempt(key, won, true, 1, storage)
  restartBingoAttempt(key, 3, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 3)
  saveBingoAttempt(key, play(start, entry.guide.answer), true, 1, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 1)
  assert.notEqual(key, conceptProgressKey(conceptPreviews.find(entry => entry.id === 'alert')!))
  assert.deepEqual([...data.keys()], [key])
})

test('hunt rejects damaged answer copies, duplicate removals, wrong answers and refill rules', () => {
  const initial = encounter('hunt-alert')
  for (const mutate of [
    (e: typeof initial) => { e.bingoHunt!.removalOrder = [0, 0] },
    (e: typeof initial) => { e.bingoHunt!.answer = 'WRONG' },
    (e: typeof initial) => { e.startingResolve = 2 },
    (e: typeof initial) => { e.bingoHunt!.removalOrder = e.startingTiles.slice(0, 7).map(tile => tile.id) },
  ]) {
    const invalid = structuredClone(initial); mutate(invalid)
    assert.throws(() => createLetterStrikeGame(invalid), /Bingo hunt/)
  }
  const entry = entries[0]
  assert.throws(() => decodeConceptPuzzle({ ...initial, bingoHunt: undefined }, entry), /Wrong preview/)
})
