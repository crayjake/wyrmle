import assert from 'node:assert/strict'
import test from 'node:test'
import { ratePuzzleDifficulty } from '../src/generator/difficulty.ts'
import type { PuzzleDifficultyInputs } from '../src/generator/difficulty.ts'
import { getDailyPuzzle } from '../src/daily/puzzle.ts'
import { loadDailySession } from '../src/daily/persistence.ts'
import ratings from '../src/generator/data/daily-difficulty.json' with { type: 'json' }

const easy: PuzzleDifficultyInputs = {
  minimumWordsToWin: 2, bestKnownWordsToWin: 2, startingResolve: 5,
  winningLineCount: 12, viableOpeningCount: 8, requiredWordCommonness: 0.95,
  armourComplexity: 0, specialTileDependence: 0, grammarDependence: 0,
  trapComplexity: 0, clutchOnly: false,
}

test('verified depth is the primary difficulty input and slack uses starting Resolve', () => {
  const low = ratePuzzleDifficulty(easy)
  const high = ratePuzzleDifficulty({ ...easy, minimumWordsToWin: 5, bestKnownWordsToWin: 5 })
  assert.equal(low.label, 'EASY')
  assert.equal(low.resolveSlack, 3)
  assert.equal(high.label, 'EXPERT')
  assert.equal(high.resolveSlack, 0)
  assert.ok(high.score > low.score + 40)
})

test('scarce winning routes, narrow openings and obscure forced words increase difficulty', () => {
  const base = ratePuzzleDifficulty({ ...easy, minimumWordsToWin: 3, bestKnownWordsToWin: 3 })
  const narrow = ratePuzzleDifficulty({ ...base, winningLineCount: 1, viableOpeningCount: 1 })
  const obscure = ratePuzzleDifficulty({ ...narrow, forcedWordCommonness: 0.2 })
  assert.ok(narrow.score > base.score)
  assert.ok(obscure.score > narrow.score)
  assert.ok(obscure.score > ratePuzzleDifficulty({ ...easy, minimumWordsToWin: 4, bestKnownWordsToWin: 4 }).score)
})

test('a bounded winning witness is labelled as an estimate, never a proved minimum', () => {
  const rated = ratePuzzleDifficulty({ ...easy, minimumWordsToWin: null, bestKnownWordsToWin: 3 })
  assert.equal(rated.minimumWordsToWin, null)
  assert.equal(rated.resolveSlack, null)
  assert.equal(rated.estimatedResolveSlack, 2)
  assert.equal(rated.estimated, true)
  assert.throws(() => ratePuzzleDifficulty({ ...easy, minimumWordsToWin: null, bestKnownWordsToWin: null }))
})

test('the same Daily has the same intrinsic difficulty and board in every assistance mode', () => {
  const puzzle = getDailyPuzzle('2026-09-25')
  const storage = { length: 0, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const states = (['normal', 'hard', 'hardcore'] as const).map(mode => loadDailySession(puzzle, storage, mode))
  assert.equal(puzzle.difficulty, 'MEDIUM')
  assert.deepEqual(states[0].game, states[1].game)
  assert.deepEqual(states[1].game, states[2].game)
  const analysis = (ratings as Record<string, { minimumWordsToWin: number | null; label: string }>)[puzzle.encounter.id]
  assert.equal(analysis.minimumWordsToWin, 3)
  assert.equal(analysis.label, puzzle.difficulty)
  assert.equal('minimumWordsToWin' in puzzle, false)
})
