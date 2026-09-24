import assert from 'node:assert/strict'
import test from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import {
  canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds,
  getTutorialMove, tutorialEncounter, tutorialFixtures, tutorialReducer, tutorialSteps,
} from '../src/tutorial/tutorial.ts'
import type { TutorialState, TutorialStep } from '../src/tutorial/tutorial.ts'

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

test('SAD basics teach Resolve and matching before committing GLAD, then finish with neutral SUN', () => {
  let state = createTutorial()
  assert.deepEqual(state.game.enemyLetters.map(letter => letter.hitsRemaining), [1, 1, 1])
  assert.equal(state.game.playerResolve, 5)
  assert.equal(state.game.tiles.every(tile => tile.type === 'normal'), true)
  assert.equal(state.game.encounter.grammarModifiers, undefined)
  assert.equal(state.game.encounter.longWordRule, undefined)
  assert.equal(tutorialReducer(state, { type: 'attack' }), state)
  state = advance(state)
  assert.equal(state.step, 'resolve')
  assert.equal(tutorialReducer(state, { type: 'select', tileId: 0 }), state)
  state = advance(state)
  assert.equal(state.step, 'build')
  assert.equal(tutorialReducer(state, { type: 'continue' }), state)
  state = selectGuidedWord(state)
  assert.equal(canAttackInTutorial(state), false)
  state = advance(state)
  assert.equal(state.step, 'matching')
  assert.equal(canAttackInTutorial(state), false)
  assert.equal(state.game.playedWords.length, 0)
  assert.deepEqual(getAllowedTutorialTileIds(state), [])
  state = advance(state)
  assert.equal(state.step, 'counter')
  const preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'COUNTER')
  assert.equal(preview.strikes, 2)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['A', 'D'])
  assert.equal(preview.resolveCost, 1)
  state = attack(state)
  assert.equal(state.step, 'counter-result')
  assert.equal(state.game.playerResolve, 4)
  assert.deepEqual(state.game.enemyLetters.map(letter => letter.hitsRemaining), [1, 0, 0])
  assert.equal(state.game.refillIndex, 4)
  assert.equal(tutorialReducer(state, { type: 'attack' }), state)
  state = selectGuidedWord(advance(state))
  assert.equal(previewLetterStrike(state.game).semanticLabel, 'NEUTRAL')
  assert.deepEqual(previewLetterStrike(state.game).hits.map(hit => hit.letter), ['S'])
  state = attack(state)
  assert.equal(state.step, 'basic-complete')
  assert.equal(state.game.status, 'won')
  assert.equal(state.game.playerResolve, 3)
})

test('the script only enables the next letter, supports real deselection/Clear, and never submits an unrelated word', () => {
  let state = createTutorial('build')
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

test('armour is introduced before its first strike, and acknowledged between 2→1 and 1→0', () => {
  let state = selectGuidedWord(createTutorial('armour'))
  assert.equal(state.game.enemyLetters[0].hitsRemaining, 2)
  assert.equal(state.game.playedWords.length, 0)
  let preview = previewLetterStrike(state.game)
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.hits.map(hit => [hit.letter, hit.hitsBefore, hit.hitsAfter]), [['S', 2, 1]])
  state = attack(state)
  assert.equal(state.step, 'armour-result')
  assert.equal(state.game.enemyLetters[0].hitsRemaining, 1)
  assert.equal(tutorialReducer(state, { type: 'select', tileId: state.game.tiles[0].id }), state)
  state = selectGuidedWord(advance(state))
  preview = previewLetterStrike(state.game)
  assert.deepEqual(preview.hits.map(hit => [hit.letter, hit.hitsBefore, hit.hitsAfter]), [['S', 1, 0]])
  state = attack(state)
  assert.equal(state.step, 'armour-complete')
  assert.equal(state.game.enemyLetters[0].hitsRemaining, 0)
})

test('resistance has a safe zero-strike inspection before STRIKE overrides it', () => {
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

test('Ward fixture reaches 3/5 via real preparation, then preserves 3/5 through its move', () => {
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
  state = selectGuidedWord(advance(state))
  preview = previewLetterStrike(state.game)
  assert.equal(preview.word, 'STREAM')
  assert.equal(preview.semanticLabel, 'NEUTRAL')
  assert.equal(preview.grammaticalModifier, 0)
  assert.equal(preview.longWordModifier, 1)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['S', 'T'])
  assert.equal(attack(state).step, 'long-result')
})

test('every DEV jump equals the complete sequential tutorial, without mutating encounters or Daily', () => {
  const daily = createLetterStrikeGame()
  const beforeDaily = structuredClone(daily)
  const beforeFixtures = structuredClone(tutorialFixtures)
  let state = createTutorial()
  const visited: TutorialStep[] = []
  for (const expected of tutorialSteps) {
    assert.equal(state.step, expected.id)
    assert.deepEqual(createTutorial(expected.id), state)
    visited.push(state.step)
    const move = getTutorialMove(state)
    if (move) state = selectGuidedWord(state)
    if (state.step !== 'complete') {
      state = move?.action === 'attack' ? attack(state) : advance(state)
    }
  }
  assert.equal(visited.length, tutorialSteps.length)
  assert.equal(state.step, 'complete')
  assert.deepEqual(daily, beforeDaily)
  assert.deepEqual(tutorialFixtures, beforeFixtures)
  assert.equal(createTutorial().game.encounter.id, tutorialEncounter.id)
  assert.equal(createTutorial().game.playedWords.length, 0)
})
