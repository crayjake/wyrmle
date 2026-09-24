import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { createCandidate } from '../src/generator/generate.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'
import type { SolverMoveSummary } from '../src/generator/findMoves.ts'
import { mutateCandidate } from '../src/generator/mutate.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { validatePuzzle } from '../src/generator/validate.ts'

const saved: RankedCandidate[] = JSON.parse(readFileSync(new URL('../src/generator/data/melancholy.json', import.meta.url), 'utf8'))
const jsonValue = <T>(value: T): T => JSON.parse(JSON.stringify(value))

function replayMove(state: LetterStrikeState, move: SolverMoveSummary): LetterStrikeState {
  const preview = previewLetterStrike(state, move.tileIds)
  assert.equal(preview.valid, true, `${move.word}: ${preview.error}`)
  assert.equal(preview.word, move.word)
  assert.equal(preview.strikes, move.strikes)
  assert.equal(preview.semanticLabel, move.semanticLabel)
  assert.equal(preview.grammaticalModifier, move.grammarModifier)
  assert.equal(preview.longWordModifier, move.longWordModifier)
  assert.equal(preview.resolveCost, move.resolveCost)
  assert.deepEqual(preview.hits, move.hits)
  assert.deepEqual(preview.letterOutcomes, move.letterOutcomes)
  return submitLetterStrike(state, move.tileIds)
}

test('five shipped MELANCHOLY review candidates pass current default gates and have distinct construction families', () => {
  assert.equal(saved.length, 5)
  assert.equal(new Set(saved.map(item => item.candidate.provenance.rootId ?? item.candidate.id)).size, 5)
  for (const item of saved) {
    assert.equal(item.candidate.enemyWord, 'MELANCHOLY')
    assert.equal(item.validation.accepted, true)
    assert.deepEqual(validatePuzzle(item.candidate, item.analysis), item.validation)
    assert.deepEqual(jsonValue(scorePuzzle(item.candidate, item.analysis)), item.quality)
    assert.equal(item.candidate.encounter.startingTiles.length, 16)
    assert.doesNotThrow(() => createLetterStrikeGame(item.candidate.encounter))
  }
  for (let index = 1; index < saved.length; index += 1) assert.ok(saved[index - 1].quality.total >= saved[index].quality.total)
})

test('every saved generated board reproduces from its seed, including selected refinements', () => {
  for (const { candidate } of saved) {
    if (!candidate.provenance.parentId) {
      assert.deepEqual(jsonValue(createCandidate(candidate.enemyWord, candidate.seed)), candidate)
      continue
    }
    const rootId = candidate.provenance.rootId!
    assert.equal(candidate.provenance.parentId, rootId, 'This shipped batch contains one refinement generation.')
    const prefix = `generated-${candidate.enemyWord.toLowerCase()}-`
    assert.ok(rootId.startsWith(prefix))
    const rootSeed = decodeURIComponent(rootId.slice(prefix.length))
    const original = createCandidate(candidate.enemyWord, rootSeed)
    assert.deepEqual(jsonValue(mutateCandidate(original, candidate.seed)), candidate)
  }
})

test('every shipped winning line exactly reproduces its predictions in the real game', () => {
  for (const { candidate, analysis } of saved) {
    assert.ok(analysis.winningLines.length > 0)
    for (const line of analysis.winningLines) {
      let state = createLetterStrikeGame(candidate.encounter)
      for (const move of line.moves) state = replayMove(state, move)
      assert.equal(state.status, 'won', candidate.id)
      assert.equal(state.playedWords.length, line.turns)
      assert.equal(state.playerResolve, line.resolveRemaining)
      assert.ok(state.enemyLetters.every(letter => letter.hitsRemaining === 0))
    }
  }
})

test('every shipped clutch continuation wins from its recorded final-Resolve position', () => {
  let rescueMoves = 0
  for (const { candidate, analysis } of saved) {
    for (const clutch of analysis.clutchLines) {
      let state = createLetterStrikeGame(candidate.encounter)
      for (const move of clutch.prefix) state = replayMove(state, move)
      assert.equal(state.status, 'playing')
      assert.equal(state.playerResolve, 1)
      assert.equal(state.enemyLetters.filter(letter => letter.hitsRemaining > 0).map(letter => letter.letter).join(''), clutch.remainingLetters)
      assert.ok(clutch.winningMoves.length > 0)
      for (const rescue of clutch.winningMoves) {
        assert.equal(replayMove(state, rescue).status, 'won', `${candidate.id}: ${rescue.word}`)
        rescueMoves += 1
      }
    }
  }
  assert.ok(rescueMoves > 0, 'The review set includes witnessed late-game rescue opportunities.')
})
