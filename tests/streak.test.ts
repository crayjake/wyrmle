import assert from 'node:assert/strict'
import test from 'node:test'
import { winStreak } from '../src/daily/streak.ts'
import { openChallenge, saveChallenge } from '../src/daily/challengeProgress.ts'
import type { ChallengeRecord } from '../src/daily/challengeProgress.ts'
import { tutorialEncounter } from '../src/tutorial/tutorial.ts'
import { submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
const record = (date: string, wonOn: string | undefined = date, words = 3): ChallengeRecord => ({
  version: 1, date, wonOn, asset: 'test', revision: 1, attempts: 1, bestWords: words,
  run: { lives: 3, started: true, status: 'won', moves: [] },
})
test('all star ratings earn consecutive daily wins; archives and unknown old dates do not', () => {
  const history = [record('2026-09-27', '2026-09-27', 1), record('2026-09-28', '2026-09-28', 2), record('2026-09-29')]
  assert.deepEqual(winStreak(history, '2026-09-29'), { current: 3, longest: 3, wonToday: true })
  assert.equal(winStreak(history, '2026-09-30').current, 3, 'Today remains open until midnight UTC')
  assert.equal(winStreak(history, '2026-10-01').current, 0)
  assert.equal(winStreak([...history, { ...record('2026-09-30'), bestWords: null, run: { lives: 3, started: true, status: 'lost', moves: [] } }], '2026-09-30').current, 0, 'A finished daily loss ends the streak immediately')
  assert.equal(winStreak([...history, record('2026-09-30', '2026-10-01')], '2026-10-01').current, 0)
  assert.equal(winStreak([{ ...record('2026-09-29'), wonOn: undefined }], '2026-09-29').current, 0)
  assert.equal(winStreak([record('2026-09-29'), record('2026-09-29')], '2026-09-29').current, 1)
})
test('winning records the real completion day once, including a game spanning midnight', () => {
  const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) } }
  const session = openChallenge('2026-09-29', 'practice-fixture', tutorialEncounter, storage)
  const game = submitLetterStrike(session.game, selectWordIds(session.game.tiles, 'HYDRATED')!)
  const saved = saveChallenge(session.record, game, true, storage, 1, new Date('2026-09-30T00:00:01Z'))
  assert.equal(saved.wonOn, '2026-09-30')
  assert.equal(winStreak([saved], '2026-09-30').current, 0)
  const again = saveChallenge(saved, game, true, storage, 1, new Date('2026-10-01T12:00:00Z'))
  assert.equal(again.wonOn, saved.wonOn)
})
