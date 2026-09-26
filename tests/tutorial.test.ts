import assert from 'node:assert/strict'
import test from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import {
  canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds,
  getTutorialMove, tutorialEncounter, tutorialFixtures, tutorialReducer, tutorialSteps,
} from '../src/tutorial/tutorial.ts'
import type { TutorialState } from '../src/tutorial/tutorial.ts'
import { crossedTileIds } from '../src/components/tileSelectionGesture.ts'

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

test('a fast guided swipe validates GLAD in order and never plays it automatically', () => {
  const state = createTutorial('counter')
  const move = getTutorialMove(state)!
  const bounds = state.game.tiles.map((tile, index) => ({
    id: tile.id, left: index % 4 * 50, right: index % 4 * 50 + 44,
    top: Math.floor(index / 4) * 50, bottom: Math.floor(index / 4) * 50 + 44,
  }))
  const centers = move.tileIds.map(id => {
    const tile = bounds.find(tile => tile.id === id)!
    return { x: (tile.left + tile.right) / 2, y: (tile.top + tile.bottom) / 2 }
  })
  // All pointer samples can arrive before one React render. Crossed unrelated
  // tiles and duplicate samples remain subject to the next-letter restriction.
  const crossed = centers.slice(1).flatMap((point, index) => crossedTileIds(centers[index], point, bounds))
  const selected = tutorialReducer(state, { type: 'select-many', tileIds: crossed })
  assert.deepEqual(selected.game.selectedTileIds, move.tileIds)
  assert.equal(previewLetterStrike(selected.game).word, 'GLAD')
  assert.equal(selected.step, 'counter')
  assert.equal(selected.game.playedWords.length, 0)
  assert.equal(canAttackInTutorial(selected), true)
  assert.deepEqual(tutorialReducer(selected, { type: 'select-many', tileIds: crossed }), selected)
})

test('guided swipes reject wrong or premature tiles and can append to tapped letters', () => {
  let state = createTutorial('counter')
  const move = getTutorialMove(state)!
  const wrong = state.game.tiles.find(tile => !move.tileIds.includes(tile.id))!.id
  state = tutorialReducer(state, { type: 'select-many', tileIds: [wrong, move.tileIds[3], move.tileIds[0], move.tileIds[2]] })
  assert.deepEqual(state.game.selectedTileIds, move.tileIds.slice(0, 1))
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[1] })
  state = tutorialReducer(state, { type: 'select-many', tileIds: [move.tileIds[0], ...move.tileIds.slice(2)] })
  assert.deepEqual(state.game.selectedTileIds, move.tileIds)
  state = tutorialReducer(state, { type: 'attack' })
  assert.equal(state.step, 'neutral')
  const sun = getTutorialMove(state)!
  state = tutorialReducer(state, { type: 'select', tileId: sun.tileIds[0] })
  state = tutorialReducer(state, { type: 'select-many', tileIds: sun.tileIds })
  assert.equal(previewLetterStrike(state.game).word, 'SUN')
  assert.deepEqual(state.game.selectedTileIds, sun.tileIds)
  assert.equal(state.step, 'neutral')
  assert.equal(state.game.status, 'playing')
  assert.equal(state.game.playedWords.length, 1)
  assert.equal(canAttackInTutorial(state), true)
})

test('the core demo needs just GLAD and SUN plays after its briefing, with no intermediate Continue', () => {
  const initial = createTutorial()
  assert.equal(initial.step, 'goal')
  assert.deepEqual(initial.game.enemyLetters.map(letter => letter.hitsRemaining), [1, 1, 1])
  assert.equal(initial.game.playerResolve, 3)
  assert.equal(initial.game.tiles.every(tile => tile.type === 'normal'), true)
  assert.equal(initial.game.encounter.grammarModifiers, undefined)
  assert.equal(tutorialReducer(initial, { type: 'attack' }), initial)
  let state = advance(initial)
  assert.equal(state.step, 'counter')
  assert.equal(tutorialReducer(state, { type: 'continue' }), state)
  state = selectGuidedWord(state)
  const preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'COUNTER')
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['A', 'D'])
  assert.equal(preview.resolveCost, 1)
  state = attack(state)
  assert.equal(state.step, 'neutral')
  assert.equal(state.game.playerResolve, 2)
  assert.deepEqual(state.game.enemyLetters.map(letter => letter.hitsRemaining), [1, 0, 0])
  assert.equal(state.game.refillIndex, 4)
  assert.deepEqual(state.game.selectedTileIds, [])
  state = selectGuidedWord(state)
  assert.equal(previewLetterStrike(state.game).semanticLabel, 'NEUTRAL')
  assert.deepEqual(previewLetterStrike(state.game).hits.map(hit => hit.letter), ['S'])
  state = attack(state)
  assert.equal(state.step, 'complete')
  assert.equal(state.game.status, 'won')
  assert.equal(state.game.playerResolve, 1)
  assert.deepEqual(state.game.playedWords.map(move => move.word), ['GLAD', 'SUN'])
  assert.deepEqual(createTutorial('complete'), state)
})

test('the script only enables the next letter, supports real deselection/Clear, and never submits an unrelated word', () => {
  let state = createTutorial('counter')
  const move = getTutorialMove(state)!
  assert.deepEqual(getAllowedTutorialTileIds(state), [move.tileIds[0]])
  assert.equal(tutorialReducer(state, { type: 'select', tileId: move.tileIds[1] }), state)
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[0] })
  assert.deepEqual(state.game.selectedTileIds, [move.tileIds[0]])
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[0] })
  assert.deepEqual(state.game.selectedTileIds, [])
  state = selectGuidedWord(state)
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[1] })
  assert.deepEqual(state.game.selectedTileIds, [move.tileIds[0], move.tileIds[2], move.tileIds[3]])
  assert.equal(canContinueInTutorial(state), false)
  state = tutorialReducer(state, { type: 'clear' })
  assert.deepEqual(state.game.selectedTileIds, [])
  assert.equal(state.game.playedWords.length, 0)
  assert.equal(state.game.playerResolve, 3)
})

test('optional armour example shows its two real hits without an intervening Continue', () => {
  let state = selectGuidedWord(createTutorial('armour'))
  assert.equal(state.game.enemyLetters[0].hitsRemaining, 2)
  assert.equal(state.game.playedWords.length, 0)
  let preview = previewLetterStrike(state.game)
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.hits.map(hit => [hit.letter, hit.hitsBefore, hit.hitsAfter]), [['S', 2, 1]])
  state = attack(state)
  assert.equal(state.step, 'armour-finish')
  assert.equal(state.game.enemyLetters[0].hitsRemaining, 1)
  state = selectGuidedWord(state)
  preview = previewLetterStrike(state.game)
  assert.deepEqual(preview.hits.map(hit => [hit.letter, hit.hitsBefore, hit.hitsAfter]), [['S', 1, 0]])
  state = attack(state)
  assert.equal(state.step, 'armour-complete')
  assert.equal(state.game.enemyLetters[0].hitsRemaining, 0)
})

test('resisted words cost a life and never hit, even with every enemy letter', () => {
  let state = selectGuidedWord(createTutorial('resisted'))
  const preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.strikes, 0)
  assert.equal(preview.resolveCost, 1)
  assert.deepEqual(preview.effectLabels, [])
  state = attack(state)
  assert.equal(state.step, 'resisted-result')
  assert.equal(state.game.playerResolve, 2)
  assert.deepEqual(state.game.enemyLetters.map(letter => letter.hitsRemaining), [1, 1, 1])
})

test('the bingo lesson wins in one counter using repeated letters to break armour', () => {
  let state = selectGuidedWord(createTutorial('bingo'))
  const preview = previewLetterStrike(state.game)
  assert.equal(preview.word, 'GLADDENS')
  assert.equal(preview.semanticLabel, 'COUNTER')
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['A', 'D', 'D', 'S'])
  state = attack(state)
  assert.equal(state.step, 'bingo-result')
  assert.equal(state.game.status, 'won')
  assert.equal(state.game.playedWords.length, 1)
  assert.equal(state.game.playerResolve, 2)
})

test('every optional and DEV jump uses isolated real-engine state and leaves Daily untouched', () => {
  const daily = createLetterStrikeGame()
  const beforeDaily = structuredClone(daily)
  const beforeFixtures = structuredClone(tutorialFixtures)
  for (const encounter of Object.values(tutorialFixtures)) {
    assert.ok(encounter.startingTiles.every(tile => tile.type === 'normal' && !tile.gem))
    assert.equal(encounter.finiteRefills, true)
    assert.equal(encounter.longWordRule, undefined)
    assert.equal(encounter.grammarModifiers, undefined)
  }
  for (const { id } of tutorialSteps) {
    let state = createTutorial(id)
    assert.equal(state.step, id)
    let replay = createLetterStrikeGame(state.game.encounter)
    for (const move of state.game.playedWords) {
      replay = submitLetterStrike({ ...replay, selectedTileIds: move.tiles.map(tile => tile.id) })
    }
    assert.deepEqual(state.game, { ...replay, selectedTileIds: state.game.selectedTileIds })
    let transitions = 0
    while (state.step !== 'complete') {
      const move = getTutorialMove(state)
      if (move) state = selectGuidedWord(state)
      state = move?.action === 'attack' ? attack(state) : advance(state)
      assert.ok(++transitions <= 4, `${id} should be a short independent example`)
    }
  }
  assert.deepEqual(daily, beforeDaily)
  assert.deepEqual(tutorialFixtures, beforeFixtures)
  assert.equal(createTutorial().game.encounter.id, tutorialEncounter.id)
  assert.equal(createTutorial().game.playedWords.length, 0)
  const replayed = tutorialReducer(createTutorial('complete'), { type: 'jump', step: 'counter' })
  assert.equal(replayed.game.playedWords.length, 0)
  assert.equal(replayed.game.playerResolve, 3)
})
