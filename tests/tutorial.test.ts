import assert from 'node:assert/strict'
import test from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import { canAttackInTutorial, createTutorial, getTutorialMove, tutorialEncounter, tutorialReducer } from '../src/tutorial/tutorial.ts'
import type { TutorialState } from '../src/tutorial/tutorial.ts'

function selectGuidedWord(state: TutorialState) {
  const move = getTutorialMove(state)
  assert.ok(move)
  for (const tileId of move.tileIds) state = tutorialReducer(state, { type: 'select', tileId })
  assert.equal(previewLetterStrike(state.game).word, move.word)
  assert.equal(canAttackInTutorial(state), true)
  return state
}

function advance(state: TutorialState) {
  return tutorialReducer(state, { type: 'continue' })
}

test('the COLD tutorial teaches six real attacks and wins without creating any Daily state', () => {
  const untouchedDaily = createLetterStrikeGame()
  const dailySnapshot = structuredClone(untouchedDaily)
  let state = createTutorial()
  assert.equal(state.game.playerResolve, 5)
  assert.deepEqual(Object.keys(state).sort(), ['game', 'step'])
  assert.notEqual(state.game.encounter.id, untouchedDaily.encounter.id)
  assert.deepEqual(state.game.enemyLetters.map(letter => letter.hitsRemaining), [2, 1, 1, 2])

  state = selectGuidedWord(advance(state))
  let preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'COUNTER')
  assert.equal(preview.strikes, 1)
  assert.equal(preview.grammaticalModifier, 0)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['O'])
  const actualHot = submitLetterStrike(state.game)
  state = tutorialReducer(state, { type: 'attack' })
  assert.deepEqual(state.game, actualHot)
  assert.equal(state.step, 'types')
  assert.equal(state.game.playerResolve, 4)

  state = selectGuidedWord(advance(state))
  preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.grammaticalModifier, 0)
  assert.deepEqual(preview.effectLabels, ['STRIKE'])
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['C'])
  assert.equal(preview.hits[0].hitsBefore, 2)
  assert.equal(preview.hits[0].hitsAfter, 1)
  state = tutorialReducer(state, { type: 'attack' })
  assert.equal(state.step, 'grammar')
  assert.equal(state.game.playerResolve, 3)

  state = selectGuidedWord(state)
  preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'RESISTED')
  assert.equal(preview.grammaticalPartOfSpeech, 'adjective')
  assert.equal(preview.grammaticalModifier, 1)
  assert.equal(preview.strikes, 1)
  assert.deepEqual(preview.effectLabels, [])
  assert.equal(state.game.tiles.find(tile => tile.id === preview.hits[0].tileId)?.type, 'normal')
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['C'])
  assert.equal(preview.hits[0].hitsBefore, 1)
  assert.equal(preview.hits[0].hitsAfter, 0)
  state = tutorialReducer(state, { type: 'attack' })
  assert.equal(state.step, 'resolve')
  assert.equal(state.game.playerResolve, 2)

  state = selectGuidedWord(advance(state))
  preview = previewLetterStrike(state.game)
  assert.equal(preview.semanticLabel, 'NEUTRAL')
  assert.deepEqual(preview.effectLabels, ['WARD'])
  assert.equal(preview.resolveCost, 0)
  assert.deepEqual(preview.hits.map(hit => hit.letter), ['L'])
  state = tutorialReducer(state, { type: 'attack' })
  assert.equal(state.step, 'ward-result')
  assert.equal(state.game.playerResolve, 2)

  state = selectGuidedWord(advance(state))
  preview = previewLetterStrike(state.game)
  assert.equal(preview.word, 'DIG')
  assert.equal(preview.word.split('D').length - 1, 1)
  assert.equal(preview.strikes, 1)
  assert.equal(preview.hits[0].letter, 'D')
  assert.equal(preview.hits[0].hitsBefore, 2)
  assert.equal(preview.hits[0].hitsAfter, 1)
  state = tutorialReducer(state, { type: 'attack' })
  assert.equal(state.step, 'armour-break')
  assert.equal(state.game.enemyLetters[3].hitsRemaining, 1)

  state = selectGuidedWord(state)
  preview = previewLetterStrike(state.game)
  assert.equal(preview.word, 'DUO')
  assert.equal(preview.word.split('D').length - 1, 1)
  assert.equal(preview.hits[0].hitsBefore, 1)
  assert.equal(preview.hits[0].hitsAfter, 0)
  state = tutorialReducer(state, { type: 'attack' })
  assert.equal(state.step, 'complete')
  assert.equal(state.game.status, 'won')
  assert.equal(state.game.playerResolve, 0)
  assert.deepEqual(state.game.playedWords.map(move => move.word), ['HOT', 'ICE', 'ICY', 'LAD', 'DIG', 'DUO'])
  assert.equal(state.game.enemyLetters.every(letter => letter.hitsRemaining === 0), true)
  assert.deepEqual(untouchedDaily, dailySnapshot)
  assert.equal(createTutorial().game.playedWords.length, 0)
  assert.equal(tutorialEncounter.enemyLetters[0].hitsRemaining, 2)
  assert.equal(tutorialEncounter.enemyLetters[3].hitsRemaining, 2)
})

test('tutorial gates attacks and Continue while allowing selection errors to be cleared', () => {
  const initial = createTutorial()
  assert.equal(tutorialReducer(initial, { type: 'attack' }), initial)
  assert.equal(tutorialReducer(initial, { type: 'select', tileId: 0 }), initial)
  let state = advance(initial)
  assert.equal(advance(state), state)
  state = tutorialReducer(state, { type: 'select', tileId: 3 })
  state = tutorialReducer(state, { type: 'select', tileId: 7 })
  state = tutorialReducer(state, { type: 'select', tileId: 8 })
  state = tutorialReducer(state, { type: 'select', tileId: 9 })
  assert.equal(previewLetterStrike(state.game).word, 'WARM')
  assert.equal(previewLetterStrike(state.game).valid, true)
  assert.equal(canAttackInTutorial(state), false)
  assert.equal(tutorialReducer(state, { type: 'attack' }), state)
  state = tutorialReducer(state, { type: 'clear' })
  assert.deepEqual(state.game.selectedTileIds, [])
  assert.equal(state.game.playerResolve, 5)
  assert.equal(state.game.playedWords.length, 0)
  assert.equal(canAttackInTutorial(selectGuidedWord(state)), true)
})

test('Ward lesson requires its actual special tile and supports alternate identical letters', () => {
  let state = advance(createTutorial())
  state = advance(tutorialReducer(selectGuidedWord(state), { type: 'attack' }))
  state = advance(tutorialReducer(selectGuidedWord(state), { type: 'attack' }))
  state = advance(tutorialReducer(selectGuidedWord(state), { type: 'attack' }))
  const wardStart = state
  const normalA = state.game.tiles.find(tile => tile.letter === 'A' && tile.type === 'normal')!
  const guided = getTutorialMove(state)!
  for (const tileId of [guided.tileIds[0], normalA.id, guided.tileIds[2]]) {
    state = tutorialReducer(state, { type: 'select', tileId })
  }
  assert.equal(previewLetterStrike(state.game).word, 'LAD')
  assert.equal(canAttackInTutorial(state), false)
  assert.equal(tutorialReducer(state, { type: 'attack' }), state)

  for (const alternativeD of wardStart.game.tiles.filter(tile => tile.letter === 'D')) {
    state = wardStart
    for (const tileId of [guided.tileIds[0], guided.tileIds[1], alternativeD.id]) {
      state = tutorialReducer(state, { type: 'select', tileId })
    }
    assert.equal(canAttackInTutorial(state), true)
    state = advance(tutorialReducer(state, { type: 'attack' }))
    state = tutorialReducer(selectGuidedWord(state), { type: 'attack' })
    state = tutorialReducer(selectGuidedWord(state), { type: 'attack' })
    assert.equal(state.game.status, 'won')
  }
})

test('ICY teaches a real adjective allowance, separate from resistance and the consumed STRIKE tile', () => {
  let state = advance(createTutorial())
  state = advance(tutorialReducer(selectGuidedWord(state), { type: 'attack' }))
  state = tutorialReducer(selectGuidedWord(state), { type: 'attack' })
  assert.equal(state.step, 'grammar')
  assert.equal(state.game.tiles.some(tile => tile.gem === 'strike'), false)

  const grammarStart = state
  for (const letter of 'DIG') {
    const tile = state.game.tiles.find(tile => tile.letter === letter && !state.game.selectedTileIds.includes(tile.id))!
    state = tutorialReducer(state, { type: 'select', tileId: tile.id })
  }
  assert.equal(previewLetterStrike(state.game).valid, true)
  assert.equal(canAttackInTutorial(state), false)
  assert.equal(tutorialReducer(state, { type: 'attack' }), state)

  state = selectGuidedWord(grammarStart)
  const resistedWithoutGrammar = previewLetterStrike({
    ...state.game,
    encounter: { ...state.game.encounter, grammarModifiers: {} },
  })
  const adjective = previewLetterStrike(state.game)
  assert.equal(resistedWithoutGrammar.semanticLabel, 'RESISTED')
  assert.equal(resistedWithoutGrammar.strikes, 0)
  assert.equal(adjective.semanticLabel, 'RESISTED')
  assert.equal(adjective.grammaticalPartOfSpeech, 'adjective')
  assert.equal(adjective.grammaticalModifier, 1)
  assert.equal(adjective.strikes, 1)
  assert.deepEqual(adjective.effectLabels, [])
  assert.equal(adjective.hits[0].letter, 'C')
  assert.equal(canAttackInTutorial(state), true)
})

test('every accepted choice of duplicate tutorial letters preserves the hints and a winning route', () => {
  let victories = 0
  const branchesByWord = new Map<string, number>()

  function walk(state: TutorialState) {
    if (state.step === 'complete') {
      assert.equal(state.game.status, 'won')
      assert.equal(state.game.playerResolve, 0)
      assert.equal(state.game.playedWords.length, 6)
      victories += 1
      return
    }
    const move = getTutorialMove(state)
    if (!move) {
      const next = advance(state)
      assert.notEqual(next, state)
      walk(next)
      return
    }
    assert.equal(move.tileIds.map(id => state.game.tiles.find(tile => tile.id === id)!.letter).join(''), move.word)

    function choose(selected: number[]) {
      if (selected.length < move!.word.length) {
        const letter = move!.word[selected.length]
        for (const tile of state.game.tiles) {
          if (tile.letter === letter && !selected.includes(tile.id)) choose([...selected, tile.id])
        }
        return
      }
      const selection = { ...state, game: { ...state.game, selectedTileIds: selected } }
      if (!canAttackInTutorial(selection)) return
      branchesByWord.set(move!.word, (branchesByWord.get(move!.word) ?? 0) + 1)
      const preview = previewLetterStrike(selection.game)
      assert.equal(preview.strikes, 1)
      if (state.step === 'grammar') {
        assert.equal(preview.grammaticalModifier, 1)
        assert.deepEqual(preview.effectLabels, [])
      }
      const next = tutorialReducer(selection, { type: 'attack' })
      assert.deepEqual(next.game, submitLetterStrike(selection.game))
      walk(next)
    }
    choose([])
  }

  walk(createTutorial())
  assert.ok(victories > 50)
  assert.ok(branchesByWord.get('ICY')! > 1)
  assert.ok(branchesByWord.get('LAD')! > branchesByWord.get('ICY')!)
  assert.ok(branchesByWord.get('DIG')! > branchesByWord.get('LAD')!)
})
