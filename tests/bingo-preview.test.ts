import assert from 'node:assert/strict'
import { test } from 'node:test'
import report from '../artifacts/bingo-preview-2026-09-26/review.json' with { type: 'json' }
import { bingoEncounter } from '../src/experimental/bingo/puzzle.ts'
import { getDailyPuzzle } from '../src/daily/puzzle.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { discoverValidMoves } from '../src/generator/findMoves.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { isMeaningPublicationReady } from '../src/generator/meaningCompiler.ts'

function play(state: LetterStrikeState, word: string) {
  const ids = selectWordIds(state.tiles, word)
  assert.ok(ids, `Cannot spell ${word}`)
  const next = submitLetterStrike(state, ids)
  assert.equal(next.error, null)
  return next
}

test('beta bingo is the sole one-word win across every legal physical opening selection', () => {
  const before = JSON.stringify(bingoEncounter)
  const start = createLetterStrikeGame(bingoEncounter)
  const discovery = discoverValidMoves(start)
  assert.equal(discovery.complete, true)
  assert.equal(discovery.vocabularyComplete, true)
  const wins = discovery.moves.filter(move => move.resultingState.status === 'won')
  assert.deepEqual([...new Set(wins.map(move => move.word))], ['ORCHESTRATES'])
  assert.ok(wins.length > 0)
  for (const win of wins) {
    assert.equal(win.strikes, 6)
    assert.equal(win.semanticLabel, 'COUNTER')
    assert.equal(win.resultingState.playerResolve, 2)
  }
  assert.equal(JSON.stringify(bingoEncounter), before)
})

test('the bingo needs both S tiles to remove the armour using ordinary counter rules', () => {
  const state = play(createLetterStrikeGame(bingoEncounter), 'ORCHESTRATE')
  assert.equal(state.status, 'playing')
  assert.equal(state.playerResolve, 2)
  assert.deepEqual(state.enemyLetters.filter(letter => letter.hitsRemaining > 0)
    .map(letter => [letter.letter, letter.hitsRemaining]), [['S', 1]])
  assert.equal(bingoEncounter.longWordRule, undefined)
  assert.deepEqual(bingoEncounter.grammarModifiers, {})
  assert.ok(bingoEncounter.startingTiles.every(tile => tile.type === 'normal'))
})

test('all twelve tested counter and resisted openings retain actual wins within three lives', () => {
  assert.equal(report.routes.length, 12)
  for (const route of report.routes) {
    let state = createLetterStrikeGame(bingoEncounter)
    for (const [index, ids] of route.tileIds.entries()) {
      state = submitLetterStrike(state, ids)
      assert.equal(state.error, null)
      assert.equal(state.playedWords.at(-1)?.word, route.words[index])
    }
    assert.equal(state.status, 'won', route.opening)
    assert.ok(state.playedWords.length >= 2 && state.playedWords.length <= 3)
    assert.equal(state.playerResolve, 3 - state.playedWords.length)
  }
})

test('three lives stop the same one-counter neutral cleanup that succeeds with five', () => {
  for (const lives of [3, 5]) {
    let state = createLetterStrikeGame({ ...bingoEncounter, startingResolve: lives })
    for (const word of ['CALMS', 'HEN', 'OAR']) state = play(state, word)
    assert.deepEqual(state.playedWords.map(move => move.semanticLabel), ['COUNTER', 'NEUTRAL', 'NEUTRAL'])
    if (lives === 3) {
      assert.equal(state.status, 'lost')
      assert.equal(state.playerResolve, 0)
      assert.ok(state.enemyLetters.some(letter => letter.hitsRemaining > 0))
    } else {
      state = play(state, 'SEA')
      assert.equal(state.playedWords.at(-1)?.semanticLabel, 'NEUTRAL')
      assert.equal(state.status, 'won')
    }
  }
})

test('beta word families keep their checked meanings and do not gain a publication certificate', () => {
  for (const word of ['ORCHESTRATE', 'ORCHESTRATES', 'HALCYON', 'HALCYONS', 'CALMS', 'CALMNESS', 'SCHEMA', 'SCHEMAS']) {
    assert.equal(bingoEncounter.meaningLexicon!.words[word].relation, 'opposite', word)
  }
  for (const word of ['ROAR', 'STORM', 'CHAOS', 'MESS', 'CLATTER', 'CLATTERS', 'SCATTER', 'SCATTERS']) {
    assert.equal(bingoEncounter.meaningLexicon!.words[word].relation, 'similar', word)
  }
  assert.equal(isMeaningPublicationReady(bingoEncounter), false)
  for (const date of ['2026-09-26', '2026-09-27']) {
    const daily = getDailyPuzzle(date)
    assert.equal(daily.puzzleVersion, 14)
    assert.equal(daily.encounter.startingResolve, 5)
    assert.notEqual(daily.encounter.id, bingoEncounter.id)
  }
})
