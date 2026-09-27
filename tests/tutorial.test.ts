import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import {
  canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds,
  getTutorialMove, tutorialEncounter, tutorialFixtures, tutorialReducer, tutorialSteps,
} from '../src/tutorial/tutorial.ts'
import type { TutorialState } from '../src/tutorial/tutorial.ts'
import { crossedTileIds } from '../src/components/tileSelectionGesture.ts'
import { archivedPuzzles, decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { winStars } from '../src/game/rating.ts'

function selectGuidedWord(state: TutorialState) {
  const move = getTutorialMove(state)
  assert.ok(move)
  for (const tileId of move.tileIds.slice(state.game.selectedTileIds.length)) {
    assert.ok(getAllowedTutorialTileIds(state).includes(tileId))
    state = tutorialReducer(state, { type: 'select', tileId })
  }
  assert.equal(previewLetterStrike(state.game).word, move.word)
  return state
}
function advance(state: TutorialState) {
  assert.equal(canContinueInTutorial(state), true)
  return tutorialReducer(state, { type: 'continue' })
}
function attack(state: TutorialState) {
  assert.equal(canAttackInTutorial(state), true)
  const actual = submitLetterStrike(state.game)
  const next = tutorialReducer(state, { type: 'attack' })
  assert.deepEqual(next.game, actual)
  return next
}

test('the tutorial uses the actual archived ARID board, armour, refills and pinned meanings', () => {
  const entry = archivedPuzzles.find(p => p.enemy === 'ARID')!
  const original = decodeScheduledPuzzle(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')), entry)
  for (const field of ['startingTiles', 'enemyLetters', 'refillQueue', 'finiteRefills'] as const) {
    assert.deepEqual(tutorialEncounter[field], original[field], field)
  }
  for (const [word, meaning] of Object.entries(tutorialEncounter.meaningLexicon!.words)) {
    assert.deepEqual(meaning, original.meaningLexicon!.words[word])
  }
})

test('a fast guided swipe validates WATER in order without automatically submitting it', () => {
  const state = createTutorial('water'), move = getTutorialMove(state)!
  const bounds = state.game.tiles.map((tile, index) => ({ id: tile.id,
    left: index % 4 * 50, right: index % 4 * 50 + 44,
    top: Math.floor(index / 4) * 50, bottom: Math.floor(index / 4) * 50 + 44,
  }))
  const centers = move.tileIds.map(id => {
    const tile = bounds.find(tile => tile.id === id)!
    return { x: (tile.left + tile.right) / 2, y: (tile.top + tile.bottom) / 2 }
  })
  const crossed = centers.slice(1).flatMap((point, index) => crossedTileIds(centers[index], point, bounds))
  const selected = tutorialReducer(state, { type: 'select-many', tileIds: crossed })
  assert.deepEqual(selected.game.selectedTileIds, move.tileIds)
  assert.equal(previewLetterStrike(selected.game).word, 'WATER')
  assert.equal(selected.step, 'water')
  assert.equal(selected.game.playedWords.length, 0)
  assert.equal(canAttackInTutorial(selected), true)
  assert.deepEqual(tutorialReducer(selected, { type: 'select-many', tileIds: crossed }), selected)
})

test('guided swipes reject wrong or premature tiles and can append to tapped letters', () => {
  let state = createTutorial('water')
  const move = getTutorialMove(state)!
  const wrong = state.game.tiles.find(tile => !move.tileIds.includes(tile.id))!.id
  state = tutorialReducer(state, { type: 'select-many', tileIds: [wrong, move.tileIds[3], move.tileIds[0], move.tileIds[2]] })
  assert.deepEqual(state.game.selectedTileIds, move.tileIds.slice(0, 1))
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[1] })
  state = tutorialReducer(state, { type: 'select-many', tileIds: [move.tileIds[0], ...move.tileIds.slice(2)] })
  assert.deepEqual(state.game.selectedTileIds, move.tileIds)
  state = attack(state)
  assert.equal(state.step, 'spring')
  const spring = getTutorialMove(state)!
  state = tutorialReducer(state, { type: 'select', tileId: spring.tileIds[0] })
  state = tutorialReducer(state, { type: 'select-many', tileIds: spring.tileIds })
  assert.equal(previewLetterStrike(state.game).word, 'SPRING')
  assert.equal(state.game.playedWords.length, 1)
  assert.equal(canAttackInTutorial(state), true)
})

test('three real wins progress through three, two and one lives on exactly the same starting board', () => {
  let state = createTutorial()
  assert.equal(tutorialReducer(state, { type: 'attack' }), state)
  state = advance(state)
  assert.equal(state.step, 'board')
  assert.equal(state.game.playedWords.length, 0)
  state = advance(state)
  assert.equal(state.step, 'word-types')
  state = advance(state)
  for (const [index, words] of [['WATER', 'SPRING', 'DIP'], ['RAIN', 'MUDDIER'], ['IRRIGATED']].entries()) {
    const lives = 3 - index
    assert.equal(state.game.playerResolve, lives)
    assert.deepEqual(state.game.tiles, tutorialEncounter.startingTiles)
    assert.equal(state.game.refillIndex, 0)
    assert.deepEqual(state.game.enemyLetters.map(l => l.hitsRemaining), [1, 2, 2, 1])
    for (const word of words) {
      assert.equal(tutorialReducer(state, { type: 'continue' }), state)
      assert.equal(getTutorialMove(state)?.word, word)
      state = selectGuidedWord(state)
      assert.equal(previewLetterStrike(state.game).semanticLabel, 'COUNTER')
      state = attack(state)
    }
    assert.equal(state.game.status, 'won')
    assert.equal(state.game.playerResolve, 0)
    assert.equal(winStars(state.game.playedWords.length), index + 1)
    assert.deepEqual(state.game.playedWords.map(m => m.word), words)
    if (lives > 1) state = advance(state)
  }
  assert.equal(state.step, 'complete')
  assert.deepEqual(createTutorial('complete'), state)
})

test('guidance supports real deselection and Clear, without spending lives or submitting an unrelated word', () => {
  let state = createTutorial('water')
  const move = getTutorialMove(state)!
  assert.deepEqual(getAllowedTutorialTileIds(state), [move.tileIds[0]])
  assert.equal(tutorialReducer(state, { type: 'select', tileId: move.tileIds[1] }), state)
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[0] })
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[0] })
  assert.deepEqual(state.game.selectedTileIds, [])
  state = selectGuidedWord(state)
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[1] })
  assert.deepEqual(state.game.selectedTileIds, move.tileIds.filter((_, i) => i !== 1))
  assert.equal(canAttackInTutorial(state), false)
  assert.equal(canContinueInTutorial(state), false)
  state = tutorialReducer(state, { type: 'clear' })
  assert.deepEqual(state.game.selectedTileIds, [])
  assert.equal(state.game.playedWords.length, 0)
  assert.equal(state.game.playerResolve, 3)
})

test('optional neutral and similar examples demonstrate one hit and no hits, then reset practice', () => {
  for (const step of ['neutral', 'resisted'] as const) {
    const selected = selectGuidedWord(createTutorial(step))
    const preview = previewLetterStrike(selected.game)
    assert.equal(preview.semanticLabel, step === 'neutral' ? 'NEUTRAL' : 'RESISTED')
    assert.equal(preview.strikes, step === 'neutral' ? 1 : 0)
    const state = attack(selected)
    assert.equal(state.game.playerResolve, 2)
    assert.deepEqual(state.game.enemyLetters.map(l => l.hitsRemaining), step === 'neutral' ? [1, 1, 2, 1] : [1, 2, 2, 1])
    const returned = advance(state)
    assert.equal(returned.step, 'word-types')
    assert.equal(returned.game.playerResolve, 3)
    assert.deepEqual(returned.game.tiles, tutorialEncounter.startingTiles)
    assert.equal(returned.game.refillIndex, 0)
    assert.equal(returned.game.playedWords.length, 0)
    assert.equal(advance(returned).step, 'water')
  }
})

test('the bingo uses repeated Rs and Is to break armour with one life', () => {
  const selected = selectGuidedWord(createTutorial('bingo'))
  const preview = previewLetterStrike(selected.game)
  assert.equal(preview.word, 'IRRIGATED')
  assert.equal(preview.semanticLabel, 'COUNTER')
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['I', 'R', 'R', 'I', 'A', 'D'])
  assert.equal(attack(selected).game.status, 'won')
})

test('every practice jump replays the actual engine, without mutating fixtures or Daily', () => {
  const daily = createLetterStrikeGame(), beforeDaily = structuredClone(daily)
  const beforeFixtures = structuredClone(tutorialFixtures)
  for (const { id } of tutorialSteps) {
    const state = createTutorial(id)
    assert.equal(state.step, id)
    assert.ok(state.game.tiles.every(t => t.type === 'normal' && !t.gem))
    let replay = createLetterStrikeGame(state.game.encounter)
    for (const move of state.game.playedWords) replay = submitLetterStrike(replay, move.tiles.map(t => t.id))
    assert.deepEqual(state.game, { ...replay, selectedTileIds: state.game.selectedTileIds })
  }
  assert.deepEqual(daily, beforeDaily)
  assert.deepEqual(tutorialFixtures, beforeFixtures)
  const replayed = tutorialReducer(createTutorial('complete'), { type: 'jump', step: 'water' })
  assert.equal(replayed.game.playedWords.length, 0)
  assert.equal(replayed.game.playerResolve, 3)
})
