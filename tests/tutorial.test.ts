import assert from 'node:assert/strict'
import test from 'node:test'
import { previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import { canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds, getTutorialMove, tutorialEncounter, tutorialReducer, tutorialSteps } from '../src/tutorial/tutorial.ts'

test('practice follows the real three-life engine, protecting the bingo and spending no saved attempt', () => {
  assert.equal(tutorialEncounter.enemy.word, 'DRY')
  assert.equal(tutorialEncounter.refillQueue, '')
  assert.equal(tutorialEncounter.enemyLetters[0].initialHits, 2)
  let state = createTutorial()
  for (const step of tutorialSteps) {
    assert.equal(state.step, step.id)
    const move = getTutorialMove(state)
    if (move) {
      assert.equal(canAttackInTutorial(state), false)
      assert.equal(canContinueInTutorial(state), false)
      state = tutorialReducer(state, { type: 'select-many', tileIds: move.tileIds })
      assert.equal(previewLetterStrike(state.game).word, move.word)
      assert.equal(canAttackInTutorial(state), true)
      const actual = submitLetterStrike(state.game)
      state = tutorialReducer(state, { type: 'attack' })
      assert.deepEqual(state.game, actual)
    } else if (step.id !== 'complete') state = tutorialReducer(state, { type: 'continue' })
  }
  assert.equal(state.game.status, 'won')
  assert.deepEqual(state.game.playedWords.map(move => move.word), ['DAMP', 'WET', 'HYDRATED'])
  assert.equal(createTutorial('bingo').game.tiles.filter(tile => tile.letter).length, 8)
  assert.equal(createTutorial('goal').game.playedWords.length, 0)
})

test('guided taps ignore out-of-order tiles and allow clearing a partial word', () => {
  let state = createTutorial('damp')
  const move = getTutorialMove(state)!
  assert.deepEqual(getAllowedTutorialTileIds(state), [move.tileIds[0]])
  assert.equal(tutorialReducer(state, { type: 'select', tileId: move.tileIds[1] }), state)
  state = tutorialReducer(state, { type: 'select', tileId: move.tileIds[0] })
  state = tutorialReducer(state, { type: 'clear' })
  assert.deepEqual(state.game.selectedTileIds, [])
  assert.equal(state.game.playerResolve, 3)
  const chosen = tutorialReducer(state, { type: 'select-many', tileIds: move.tileIds })
  assert.equal(chosen.game.playedWords.length, 0)
  assert.equal(previewLetterStrike(chosen.game).bingoHunt?.won, false)
})

test('the final word lights every enemy copy, including both Ds', () => {
  let state = createTutorial('bingo')
  state = tutorialReducer(state, { type: 'select-many', tileIds: getTutorialMove(state)!.tileIds })
  const preview = previewLetterStrike(state.game)
  assert.equal(preview.bingoHunt?.won, true)
  assert.equal(state.game.playerResolve, 1)
  assert.equal(tutorialReducer(state, { type: 'attack' }).game.status, 'won')
})
