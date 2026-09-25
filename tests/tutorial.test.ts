import assert from 'node:assert/strict'
import test from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import {
  canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds,
  getTutorialMove, tutorialEncounter, tutorialFixtures, tutorialReducer, tutorialSteps,
} from '../src/tutorial/tutorial.ts'
import type { TutorialState } from '../src/tutorial/tutorial.ts'

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

test('the core demo needs just GLAD and SUN plays after its briefing, with no intermediate Continue', () => {
  const initial = createTutorial()
  assert.equal(initial.step, 'goal')
  assert.deepEqual(initial.game.enemyLetters.map(letter => letter.hitsRemaining), [1, 1, 1])
  assert.equal(initial.game.playerResolve, 5)
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
  assert.equal(state.game.playerResolve, 4)
  assert.deepEqual(state.game.enemyLetters.map(letter => letter.hitsRemaining), [1, 0, 0])
  assert.equal(state.game.refillIndex, 4)
  assert.deepEqual(state.game.selectedTileIds, [])
  state = selectGuidedWord(state)
  assert.equal(previewLetterStrike(state.game).semanticLabel, 'NEUTRAL')
  assert.deepEqual(previewLetterStrike(state.game).hits.map(hit => hit.letter), ['S'])
  state = attack(state)
  assert.equal(state.step, 'complete')
  assert.equal(state.game.status, 'won')
  assert.equal(state.game.playerResolve, 3)
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
  assert.equal(state.game.playerResolve, 5)
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

test('resistance has a safe zero-hit inspection before a hit tile overrides it', () => {
  let state = selectGuidedWord(createTutorial('resisted'))
  let preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.strikes, 0)
  assert.equal(canAttackInTutorial(state), false)
  assert.equal(state.game.playerResolve, 5)
  state = selectGuidedWord(advance(state))
  assert.equal(state.step, 'strike')
  preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.effectLabels, ['STRIKE'])
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['S'])
  state = attack(state)
  assert.equal(state.game.enemyLetters[0].hitsRemaining, 0)
  assert.equal(state.game.playerResolve, 4)
})

test('heart tile fixture reaches 3/5 lives via real preparation, then preserves 3/5 through its move', () => {
  const prepared = createTutorial('ward')
  let replay = createLetterStrikeGame(tutorialFixtures.ward)
  for (const move of prepared.game.playedWords) {
    replay = submitLetterStrike({ ...replay, selectedTileIds: move.tiles.map(tile => tile.id) })
  }
  assert.deepEqual(prepared.game, replay)
  assert.equal(prepared.game.playerResolve, 3)
  let state = selectGuidedWord(prepared)
  const preview = previewLetterStrike(state.game)
  assert.equal(preview.resolveCost, 0)
  assert.deepEqual(preview.effectLabels, ['WARD'])
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['D'])
  state = attack(state)
  assert.equal(state.step, 'ward-result')
  assert.equal(state.game.playerResolve, 3)
  assert.equal(state.game.status, 'won')
})

test('Regen previews real dead revival and living armour, then guides a safe tile choice', () => {
  let state = selectGuidedWord(createTutorial('regen-dead'))
  let preview = previewLetterStrike(state.game)
  assert.equal(state.game.enemyLetters[1].hitsRemaining, 0)
  assert.deepEqual(state.game.playedWords.map(move => move.word), ['ELF'])
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['R'])
  assert.deepEqual(preview.recoveries?.map(recovery => [recovery.letter, recovery.hitsBefore, recovery.hitsAfter]), [['E', 0, 1]])
  assert.equal(canAttackInTutorial(state), false)
  const revived = submitLetterStrike(state.game)
  assert.deepEqual(revived.enemyLetters, preview.enemyLetters)
  state = selectGuidedWord(advance(state))
  assert.equal(state.step, 'regen-alive')
  preview = previewLetterStrike(state.game)
  assert.deepEqual(preview.recoveries?.map(recovery => [recovery.letter, recovery.hitsBefore, recovery.hitsAfter]), [['E', 1, 2]])
  assert.equal(canAttackInTutorial(state), false)
  assert.deepEqual(submitLetterStrike(state.game).enemyLetters, preview.enemyLetters)
  state = advance(state)
  assert.equal(state.step, 'regen-safe')
  assert.deepEqual(state.game.selectedTileIds, [])
  const regenE = state.game.tiles.find(tile => tile.gem === 'regen')!
  state = tutorialReducer(state, { type: 'select', tileId: getTutorialMove(state)!.tileIds[0] })
  assert.equal(getAllowedTutorialTileIds(state).includes(regenE.id), false)
  assert.equal(tutorialReducer(state, { type: 'select', tileId: regenE.id }), state)
  state = selectGuidedWord(state)
  preview = previewLetterStrike(state.game)
  assert.equal(preview.effectLabels.includes('REGEN'), false)
  assert.deepEqual(preview.recoveries ?? [], [])
  state = attack(state)
  assert.equal(state.step, 'regen-result')
  assert.equal(state.game.enemyLetters[1].hitsRemaining, 1)
  assert.equal(state.game.enemyLetters[3].hitsRemaining, 0)
})

test('grammar and LONG have separate familiar examples with exact word-order targets', () => {
  let state = selectGuidedWord(createTutorial('grammar'))
  let preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'NEUTRAL')
  assert.equal(preview.grammaticalPartOfSpeech, 'adjective')
  assert.equal(preview.grammaticalModifier, 1)
  assert.equal(preview.longWordModifier, 0)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['D', 'A'])
  state = attack(state)
  assert.equal(state.step, 'grammar-result')
  assert.equal(advance(state).step, 'complete')
  state = selectGuidedWord(createTutorial('long'))
  preview = previewLetterStrike(state.game)
  assert.equal(preview.word, 'STREAM')
  assert.equal(preview.semanticLabel, 'NEUTRAL')
  assert.equal(preview.grammaticalModifier, 0)
  assert.equal(preview.longWordModifier, 1)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['S', 'T'])
  assert.equal(attack(state).step, 'long-result')
})

test('every optional and DEV jump uses isolated real-engine state and leaves Daily untouched', () => {
  const daily = createLetterStrikeGame()
  const beforeDaily = structuredClone(daily)
  const beforeFixtures = structuredClone(tutorialFixtures)
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
  assert.equal(replayed.game.playerResolve, 5)
})
