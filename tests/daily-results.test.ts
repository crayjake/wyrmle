import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDailyHistory } from '../src/daily/history.ts'
import { buildDailyResult, getCompletedResults } from '../src/daily/results.ts'
import { buildShareText } from '../src/daily/share.ts'
import { calculateStats } from '../src/daily/stats.ts'
import { buildDailyScoreSubmission } from '../src/daily/submission.ts'
import type { DailyPuzzleDefinition, DailyResult } from '../src/daily/types.ts'
import { melancholyEncounter } from '../src/game/encounters.ts'
import { createGame, submitWord } from '../src/game/game.ts'
import type { GameState } from '../src/game/types.ts'

function puzzle(date = '2026-09-24'): DailyPuzzleDefinition {
  return {
    puzzleId: date,
    date,
    gameVersion: '1',
    puzzleVersion: 1,
    encounter: melancholyEncounter,
  }
}

function playWord(game: GameState, word: string): GameState {
  const ids: number[] = []
  for (const letter of word) {
    const tile = game.tiles.find((tile) => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing tile for ${letter} in ${word}`)
    ids.push(tile.id)
  }
  const next = submitWord(game, ids)
  assert.equal(next.error, null)
  return next
}

function wonGame(definition = puzzle()): GameState {
  let game = createGame(definition.encounter)
  for (const word of ['JOY', 'CHEER', 'HAPPY']) game = playWord(game, word)
  assert.equal(game.status, 'won')
  return game
}

function result(date = '2026-09-24', overrides: Partial<DailyResult> = {}): DailyResult {
  const definition = puzzle(date)
  return {
    ...buildDailyResult(definition, wonGame(definition), `${date}T12:00:00.000Z`),
    ...overrides,
  }
}

test('completion captures turns, effects, Resolve and full scored damage without mutating the run', () => {
  const definition = puzzle()
  const game = wonGame(definition)
  const before = structuredClone(game)
  const completed = buildDailyResult(definition, game, '2026-09-24T13:00:00+01:00')
  assert.equal(completed.puzzleId, definition.puzzleId)
  assert.equal(completed.date, definition.date)
  assert.equal(completed.gameVersion, definition.gameVersion)
  assert.equal(completed.puzzleVersion, definition.puzzleVersion)
  assert.equal(completed.enemyWord, definition.encounter.enemy.word)
  assert.equal(completed.won, true)
  assert.equal(completed.startingResolve, 5)
  assert.equal(completed.resolveRemaining, 3)
  assert.equal(completed.attacks, 3)
  assert.deepEqual(completed.wordsPlayed, ['JOY', 'CHEER', 'HAPPY'])
  assert.equal(completed.totalDamage, game.playedWords.reduce((sum, attack) => sum + attack.damage, 0))
  assert.ok(completed.totalDamage >= definition.encounter.enemy.maxHealth)
  assert.equal(completed.strongestHit, Math.max(...game.playedWords.map((attack) => attack.damage)))
  assert.equal(completed.counters, 3)
  assert.equal(completed.resisted, 0)
  assert.equal(completed.neutral, 0)
  assert.equal(completed.specialTilesTriggered, 2)
  assert.deepEqual(completed.turns[0], {
    damage: 8,
    relation: 'opposite',
    tileIds: [0, 1, 2],
    specialTiles: [{ tileId: 2, gem: 'ward' }],
    resolveProtected: true,
  })
  assert.equal(completed.completedAt, '2026-09-24T12:00:00.000Z')
  completed.turns[0].tileIds.push(999)
  completed.turns[0].specialTiles[0].tileId = 999
  completed.wordsPlayed[0] = 'CHANGED'
  assert.deepEqual(game, before)
})

test('similar and related words are both resisted; unrelated words are neutral', () => {
  for (const [word, expected] of [
    ['GLOOM', { resisted: 1, neutral: 0 }],
    ['MOOD', { resisted: 1, neutral: 0 }],
    ['DASH', { resisted: 0, neutral: 1 }],
  ] as const) {
    const definition = { ...puzzle(), encounter: { ...melancholyEncounter, startingResolve: 1 } }
    const game = playWord(createGame(definition.encounter), word)
    assert.equal(game.status, 'lost')
    const completed = buildDailyResult(definition, game, '2026-09-24T12:00:00.000Z')
    assert.equal(completed.won, false)
    assert.equal(completed.resolveRemaining, 0)
    assert.equal(completed.resisted, expected.resisted)
    assert.equal(completed.neutral, expected.neutral)
    assert.equal(completed.counters, 0)
  }
})

test('total damage includes overkill and last-Resolve victories still count as wins', () => {
  const definition = {
    ...puzzle(),
    encounter: {
      ...melancholyEncounter,
      startingResolve: 1,
      enemy: { ...melancholyEncounter.enemy, maxHealth: 1 },
    },
  }
  const completed = buildDailyResult(
    definition, playWord(createGame(definition.encounter), 'DASH'), '2026-09-24T12:00:00Z',
  )
  assert.equal(completed.totalDamage, 4)
  assert.equal(completed.resolveRemaining, 0)
  assert.equal(completed.won, true)
})

test('ongoing runs and invalid completion timestamps cannot become results', () => {
  assert.throws(() => buildDailyResult(puzzle(), createGame(melancholyEncounter), '2026-09-24T12:00:00Z'))
  assert.throws(() => buildDailyResult(puzzle(), wonGame(), 'not a timestamp'))
})

test('empty history has explicit zero statistics and no longest word', () => {
  assert.deepEqual(calculateStats([], '2026-09-24'), {
    gamesPlayed: 0,
    wins: 0,
    winRate: 0,
    currentStreak: 0,
    longestStreak: 0,
    averageResolveOnWins: 0,
    averageWordLength: 0,
    longestWord: null,
    totalCounters: 0,
    totalResisted: 0,
    specialTilesUsed: 0,
    uniqueEnemyDefeats: 0,
  })
})

test('stats derive totals, word lengths, win-only Resolve and distinct defeated concepts', () => {
  const history = [
    result('2026-09-22', { wordsPlayed: ['JOY', 'CHEER'], counters: 2, specialTilesTriggered: 2 }),
    result('2026-09-23', {
      won: false, resolveRemaining: 0, wordsPlayed: ['GLOOM', 'CRY'],
      counters: 0, resisted: 2, specialTilesTriggered: 1, enemyWord: 'FEAR',
    }),
    result('2026-09-24', {
      resolveRemaining: 1, wordsPlayed: ['DELIGHT', 'SAD'],
      counters: 1, resisted: 1, specialTilesTriggered: 0, enemyWord: 'RAGE',
    }),
  ]
  assert.deepEqual(calculateStats(history.reverse(), '2026-09-24'), {
    gamesPlayed: 3,
    wins: 2,
    winRate: 2 / 3 * 100,
    currentStreak: 1,
    longestStreak: 1,
    averageResolveOnWins: 2,
    averageWordLength: 26 / 6,
    longestWord: 'DELIGHT',
    totalCounters: 3,
    totalResisted: 3,
    specialTilesUsed: 3,
    uniqueEnemyDefeats: 2,
  })
})

test('streaks use consecutive UTC dates and keep yesterday alive while today is unplayed', () => {
  const history = [result('2026-09-21'), result('2026-09-22'), result('2026-09-23')]
  const stats = calculateStats(history, '2026-09-24')
  assert.equal(stats.currentStreak, 3)
  assert.equal(stats.longestStreak, 3)
  assert.equal(calculateStats([...history, result('2026-09-24')], '2026-09-24').currentStreak, 4)
  assert.equal(calculateStats(history, '2026-09-25').currentStreak, 0)
})

test('a loss today breaks the current streak while longest retains prior consecutive wins', () => {
  const history = [result('2026-09-21'), result('2026-09-22'), result('2026-09-23')]
  const stats = calculateStats([...history, result('2026-09-24', { won: false })], '2026-09-24')
  assert.equal(stats.currentStreak, 0)
  assert.equal(stats.longestStreak, 3)
})

test('missing days and losses break longest streak even in a compact history array', () => {
  const history = [
    result('2026-09-16'), result('2026-09-17'),
    result('2026-09-19'), result('2026-09-20', { won: false }),
    result('2026-09-21'), result('2026-09-22'), result('2026-09-23'),
  ]
  const stats = calculateStats(history.reverse(), '2026-09-24')
  assert.equal(stats.currentStreak, 3)
  assert.equal(stats.longestStreak, 3)
})

test('UTC streaks cross year, leap-day, and daylight-saving boundaries', () => {
  for (const dates of [
    ['2025-12-31', '2026-01-01', '2026-01-02'],
    ['2024-02-28', '2024-02-29', '2024-03-01'],
    ['2026-03-28', '2026-03-29', '2026-03-30'],
  ]) {
    const stats = calculateStats(dates.map((date) => result(date)), dates[2])
    assert.equal(stats.currentStreak, 3)
    assert.equal(stats.longestStreak, 3)
  }
  assert.throws(() => calculateStats([], '2026-02-30'))
  assert.throws(() => calculateStats([], '2026-09-24T01:00:00+01:00'))
})

test('future development results affect neither totals nor streaks', () => {
  const today = result('2026-09-24')
  assert.deepEqual(calculateStats([
    today, result('2026-09-25'), result('2026-09-26'), result('2026-09-27'),
  ], today.date), calculateStats([today], today.date))
})

test('a run finished after midnight belongs to its puzzle day rather than its completion date', () => {
  const yesterday = result('2026-09-23', { completedAt: '2026-09-24T00:05:00.000Z' })
  const today = result('2026-09-24', { completedAt: '2026-09-24T00:10:00.000Z' })
  assert.equal(calculateStats([yesterday], '2026-09-24').currentStreak, 1)
  const stats = calculateStats([yesterday, today], '2026-09-24')
  assert.equal(stats.gamesPlayed, 2)
  assert.equal(stats.currentStreak, 2)
  assert.equal(stats.longestStreak, 2)
  assert.match(buildShareText(yesterday), /^WYRMLE 2026-09-23/)
})

test('duplicate puzzle results keep the first completion regardless of input ordering', () => {
  const first = result('2026-09-24', { won: false, completedAt: '2026-09-24T10:00:00.000Z' })
  const replay = result('2026-09-24', { completedAt: '2026-09-24T11:00:00.000Z' })
  const prior = result('2026-09-23')
  assert.deepEqual(getCompletedResults([replay, first, prior]), [prior, first])
  assert.deepEqual(calculateStats([first, replay, prior], first.date), calculateStats([replay, prior, first], first.date))
  assert.equal(calculateStats([replay, first], first.date).gamesPlayed, 1)
  assert.equal(calculateStats([replay, first], first.date).currentStreak, 0)
  const sameTime = { ...replay, completedAt: first.completedAt }
  assert.deepEqual(getCompletedResults([first, sameTime]), getCompletedResults([sameTime, first]))
})

test('history distinguishes unplayed, in-progress, wins and losses without exposing unplayed enemies', () => {
  const puzzles = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'].map(puzzle)
  const history = getDailyHistory(puzzles, [
    result('2026-09-21', { enemyWord: 'DISPLAY NAME FROM A DIFFERENT VERSION' }),
    result('2026-09-22', { won: false, resolveRemaining: 0 }),
  ], ['2026-09-21', '2026-09-23'])
  assert.deepEqual(history.map((day) => day.status), ['unplayed', 'in-progress', 'lost', 'won'])
  assert.deepEqual(history.map((day) => day.played), [false, true, true, true])
  assert.equal(history[0].enemyWord, null)
  assert.equal(history[0].won, null)
  assert.equal(history[0].quality, null)
  assert.equal(history[0].attacks, null)
  assert.equal(history[1].enemyWord, 'MELANCHOLY')
  assert.equal(history[1].quality, null)
  assert.equal(history[2].won, false)
  assert.equal(history[2].quality?.fraction, 0)
  assert.equal(history[3].enemyWord, 'MELANCHOLY')
  assert.deepEqual(history[3].quality, { resolveRemaining: 3, startingResolve: 5, fraction: 3 / 5 })
  assert.equal(history[3].attacks, 3)
})

test('share text encodes outcomes and turn effects but never words or enemy information', () => {
  const completed = result()
  const share = buildShareText(completed)
  assert.equal(share, 'WYRMLE 2026-09-24 · Victory\nResolve 3/5 · 3 attacks\n🟩✦◇ 🟩✦ 🟩')
  for (const secret of [...completed.wordsPlayed, completed.enemyWord]) {
    assert.equal(share.toUpperCase().includes(secret.toUpperCase()), false)
  }
  const abstractOnly = {
    ...completed,
    wordsPlayed: ['SECRETWORD'],
    enemyWord: 'SECRETENEMY',
    turns: completed.turns.map((turn) => ({ ...turn, tileIds: [983746] })),
  }
  assert.equal(buildShareText(abstractOnly), share)
  assert.equal(share.includes('983746'), false)
  assert.match(buildShareText({ ...completed, won: false }), /Defeat/)
})

test('future submission is a deterministic compact summary without local display data', () => {
  const completed = result()
  const before = structuredClone(completed)
  const submission = buildDailyScoreSubmission(completed)
  assert.deepEqual(submission, {
    puzzleId: completed.puzzleId,
    gameVersion: completed.gameVersion,
    puzzleVersion: completed.puzzleVersion,
    won: true,
    resolveRemaining: 3,
    turnsUsed: 3,
    totalDamage: completed.totalDamage,
    completedAt: completed.completedAt,
  })
  assert.deepEqual(buildDailyScoreSubmission(structuredClone(completed)), submission)
  assert.deepEqual(completed, before)
  for (const displayOnly of ['enemyWord', 'wordsPlayed', 'strongestHit', 'turns', 'score', 'stars']) {
    assert.equal(displayOnly in submission, false)
  }
})
