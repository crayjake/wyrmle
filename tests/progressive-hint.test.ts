import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { progressiveHint } from '../src/daily/progressiveHint.ts'
import { puzzleSchedule, decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { getPuzzleGuide } from '../src/daily/guides.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { openChallenge, saveChallenge } from '../src/daily/challengeProgress.ts'

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const play = (state: ReturnType<typeof createLetterStrikeGame>, word: string, hardGuess = false) => {
  const ids = selectWordIds(state.tiles, word)
  assert.ok(ids, word)
  return submitLetterStrike(state, ids, { hardGuess })
}

test('every scheduled puzzle reveals its first two clues only after helpers, never on the starting board or a win', () => {
  for (const entry of puzzleSchedule) {
    const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
    const guide = getPuzzleGuide(entry.id)!
    const words = read(entry.report!).witnesses[2]
    const initial = createLetterStrikeGame(encounter)
    assert.equal(progressiveHint(initial, guide.hints, true), null, entry.id)
    const first = play(initial, words[0])
    assert.equal(progressiveHint(first, guide.hints, true), guide.hints[0])
    assert.equal(progressiveHint(first, guide.hints, true, 0), null, 'Wait for removal to resolve')
    const second = play(first, words[1])
    assert.equal(progressiveHint(second, guide.hints, true), guide.hints[1])
    assert.equal(progressiveHint(second, guide.hints, true, 1), guide.hints[0])
    for (const state of [initial, first, second]) assert.equal(progressiveHint(state, guide.hints, false), null)
    assert.equal(progressiveHint(play(second, words[2]), guide.hints, true), null)
    assert.equal(progressiveHint(play(initial, guide.answer), guide.hints, true), null)
  }
})

test('invalid, repeated and Hard wrong guesses unlock no extra clue; saved moves restore earned clues', () => {
  const entry = puzzleSchedule.find(entry => entry.enemy === 'ALERT')!
  const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
  const guide = getPuzzleGuide(entry.id)!
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) } }
  let { record, game } = openChallenge(entry.date, entry.asset, encounter, storage)
  // An old manual reveal must not display a clue before a helper is played.
  record = saveChallenge(record, game, true, storage, 4)
  assert.equal(progressiveHint(openChallenge(entry.date, entry.asset, encounter, storage).game, guide.hints, true), null)
  game = play(game, 'CAT')
  assert.equal(game.playedWords.length, 0)
  assert.equal(progressiveHint(game, guide.hints, true), null)
  game = play(game, 'CAT', true)
  assert.equal(game.playerResolve, 2)
  assert.equal(progressiveHint(game, guide.hints, true), null)
  game = play(game, 'INERT')
  assert.equal(game.playerResolve, 1)
  assert.equal(progressiveHint(game, guide.hints, true), guide.hints[0], 'Spent lives do not advance clues')
  game = play(game, 'INERT')
  assert.equal(game.playedWords.length, 2)
  assert.equal(progressiveHint(game, guide.hints, true), guide.hints[0])
  saveChallenge(record, game, true, storage)
  const restored = openChallenge(entry.date, entry.asset, encounter, storage)
  assert.equal(restored.hintStep, 4, 'Original hint-menu metadata remains intact')
  assert.equal(progressiveHint(restored.game, guide.hints, true), guide.hints[0])
  assert.equal(progressiveHint(restored.game, undefined, true), null)
  const lost = play(game, 'IDLE')
  assert.equal(lost.status, 'lost')
  assert.equal(progressiveHint(lost, guide.hints, true), null)
})
