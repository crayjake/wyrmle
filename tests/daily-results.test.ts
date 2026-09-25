import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDailyHistory } from '../src/daily/history.ts'
import { getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { buildDailyResult, getCompletedResults } from '../src/daily/results.ts'
import { buildShareText } from '../src/daily/share.ts'
import { calculateStats } from '../src/daily/stats.ts'
import { buildDailyScoreSubmission } from '../src/daily/submission.ts'
import type { DailyPuzzleDefinition, DailyResult } from '../src/daily/types.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'

function puzzle(date = '2026-09-24'): DailyPuzzleDefinition {
  // Historical result/stat fixtures keep their authored route across new releases.
  return date < '2026-09-25' ? getDailyPuzzleForVersion(date, 'letter-strike-1', 1)
    : getDailyPuzzleForVersion(date, 'letter-strike-3', 3)
}

function playWord(game: LetterStrikeState, word: string): LetterStrikeState {
  const ids: number[] = []
  for (const letter of word) {
    const tile = game.tiles.find((tile) => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing tile for ${letter} in ${word}`)
    ids.push(tile.id)
  }
  const next = submitLetterStrike(game, ids)
  assert.equal(next.error, null)
  return next
}

function wonGame(definition = puzzle()): LetterStrikeState {
  let game = createLetterStrikeGame(definition.encounter)
  for (const word of ['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG']) game = playWord(game, word)
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

test('completion records true letter strikes, unique armour breaks and turn evidence without mutation', () => {
  const definition = puzzle()
  const game = wonGame(definition)
  const before = structuredClone(game)
  const completed = buildDailyResult(definition, game, '2026-09-24T13:00:00+01:00')
  assert.equal(completed.won, true)
  assert.equal(completed.startingResolve, 5)
  assert.equal(completed.resolveRemaining, 0)
  assert.equal(completed.attacks, 6)
  assert.equal(completed.totalStrikes, 12)
  assert.equal(completed.lettersDestroyed, 10)
  assert.equal(completed.armourBroken, 2)
  assert.equal(completed.strongestHit, 3)
  assert.equal(completed.largestRemoval, 2)
  assert.equal(completed.enemyLetterCount, 10)
  assert.equal(completed.counters, 4)
  assert.equal(completed.neutral, 2)
  assert.equal(completed.resisted, 0)
  assert.equal(completed.strikeActivations, 1)
  assert.equal(completed.wardSaves, 1)
  assert.deepEqual(completed.wordsPlayed, ['JOY', 'MERRY', 'CHEER', 'ELATED', 'MOLD', 'NAG'])
  assert.deepEqual(completed.turns[0], {
    strikes: 2, lettersDestroyed: 1, armourBroken: 1, semanticLabel: 'COUNTER',
    letterOutcomes: game.playedWords[0].preview.letterOutcomes,
    tileIds: [0, 1, 2], specialTiles: [{ tileId: 2, gem: 'ward' }],
    strikeActivations: 0, resolveProtected: true,
  })
  assert.equal(completed.completedAt, '2026-09-24T12:00:00.000Z')
  assert.equal('totalDamage' in completed, false)
  completed.turns[0].tileIds.push(999)
  completed.turns[0].specialTiles[0].tileId = 999
  completed.turns[0].letterOutcomes[0].hitsAfter = 999
  completed.wordsPlayed[0] = 'CHANGED'
  assert.deepEqual(game, before)
})

test('related words count as neutral, while resisted words can trigger real Strike hits', () => {
  for (const [word, neutral, resisted, strikeActivations] of [
    ['MOOD', 1, 0, 0], ['GLOOM', 0, 1, 1], ['SAD', 0, 1, 0],
  ] as const) {
    const definition = { ...puzzle(), encounter: { ...puzzle().encounter, startingResolve: 1 } }
    const game = playWord(createLetterStrikeGame(definition.encounter), word)
    assert.equal(game.status, 'lost')
    const completed = buildDailyResult(definition, game, '2026-09-24T12:00:00Z')
    assert.equal(completed.neutral, neutral)
    assert.equal(completed.resisted, resisted)
    assert.equal(completed.strikeActivations, strikeActivations)
  }
})

test('selected Strike tiles with no living matching target are not counted as activations', () => {
  const definition = {
    ...puzzle(), encounter: {
      ...puzzle().encounter, startingResolve: 1,
      enemyLetters: [{ id: 'm', letter: 'M', hitsRemaining: 2, initialHits: 2 }],
    },
  }
  const completed = buildDailyResult(definition,
    playWord(createLetterStrikeGame(definition.encounter), 'GLOOM'), '2026-09-24T12:00:00Z')
  assert.equal(completed.totalStrikes, 0)
  assert.equal(completed.strikeActivations, 0)
  assert.deepEqual(completed.turns[0].specialTiles, [])
})

test('additive Strike in LAD records both removals and one tile activation in its share row', () => {
  const base = puzzle('2026-09-25')
  const definition = { ...base, encounter: { ...base.encounter, strikeConsumesAllowance: false, startingResolve: 1 } }
  const game = playWord(createLetterStrikeGame(definition.encounter), 'LAD')
  const completed = buildDailyResult(definition, game, '2026-09-25T12:00:00Z')
  assert.equal(completed.totalStrikes, 2)
  assert.equal(completed.lettersDestroyed, 2)
  assert.equal(completed.neutral, 1)
  assert.equal(completed.strikeActivations, 1)
  assert.deepEqual(completed.turns[0].letterOutcomes.filter(event => event.removed).map(event => event.position), [2, 3])
  assert.match(buildShareText(completed), /^N  ··■■······ ◆$/m)
})

test('a v4 LONG neutral move records both actual removals in result and positional share data', () => {
  const base = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-4', 4)
  const definition = { ...base, encounter: { ...base.encounter, startingResolve: 1 } }
  const game = playWord(createLetterStrikeGame(definition.encounter), 'THREAD')
  assert.equal(game.status, 'lost')
  assert.equal(game.playedWords[0].preview.longWordModifier, 1)
  const completed = buildDailyResult(definition, game, '2026-09-25T12:00:00Z')
  assert.equal(completed.gameVersion, 'letter-strike-4')
  assert.equal(completed.neutral, 1)
  assert.equal(completed.totalStrikes, 2)
  assert.equal(completed.lettersDestroyed, 2)
  assert.equal(completed.largestRemoval, 2)
  assert.deepEqual(completed.turns[0].letterOutcomes.filter((event) => event.removed).map((event) => event.position), [1, 6])
  assert.match(buildShareText(completed), /^N  ·■····■···$/m)
})

test('a Strike and neutral hit on one armoured letter share as a single break-and-remove event', () => {
  const base = puzzle('2026-09-25')
  const definition = { ...base, encounter: {
    ...base.encounter, strikeConsumesAllowance: false,
    enemyLetters: [{ id: 'e', letter: 'E', hitsRemaining: 2, initialHits: 2 }],
    startingTiles: base.encounter.startingTiles.map(tile => tile.id === 5 ? { ...tile, type: 'gem' as const, gem: 'strike' as const } : tile),
  } }
  const game = submitLetterStrike(createLetterStrikeGame(definition.encounter), [5, 6, 9])
  const completed = buildDailyResult(definition, game, '2026-09-25T12:00:00Z')
  assert.equal(completed.won, true)
  assert.equal(completed.totalStrikes, 2)
  assert.equal(completed.strikeActivations, 1)
  assert.equal(completed.armourBroken, 1)
  assert.equal(completed.lettersDestroyed, 1)
  assert.match(buildShareText(completed), /^N  ▣ ◆$/m)
})

test('two hits to one armoured letter in a turn count one break and one destroyed letter', () => {
  const definition = {
    ...puzzle(), encounter: {
      ...puzzle().encounter,
      enemyLetters: [{ id: 'e', letter: 'E', hitsRemaining: 2, initialHits: 2 }],
    },
  }
  const completed = buildDailyResult(definition,
    playWord(createLetterStrikeGame(definition.encounter), 'CHEER'), '2026-09-24T12:00:00Z')
  assert.equal(completed.won, true)
  assert.equal(completed.totalStrikes, 2)
  assert.equal(completed.armourBroken, 1)
  assert.equal(completed.lettersDestroyed, 1)
  assert.deepEqual(completed.turns[0].letterOutcomes, [{
    enemyLetterId: 'e', position: 0, hitsBefore: 2, hitsAfter: 0, armourBroken: true, removed: true,
  }])
  assert.match(buildShareText(completed), /^C  ▣$/m)
})

test('separate armour-break and removal turns stay distinct even after the letter is dead', () => {
  const definition = {
    ...puzzle(), encounter: {
      ...puzzle().encounter,
      enemyLetters: [{ id: 'y', letter: 'Y', hitsRemaining: 2, initialHits: 2 }],
    },
  }
  let game = createLetterStrikeGame(definition.encounter)
  game = playWord(game, 'JOY')
  game = playWord(game, 'MERRY')
  const completed = buildDailyResult(definition, game, '2026-09-24T12:00:00Z')
  assert.equal(game.enemyLetters[0].hitsRemaining, 0)
  assert.equal(completed.turns[0].letterOutcomes[0].armourBroken, true)
  assert.equal(completed.turns[0].letterOutcomes[0].removed, false)
  assert.equal(completed.turns[1].letterOutcomes[0].armourBroken, false)
  assert.equal(completed.turns[1].letterOutcomes[0].removed, true)
  assert.match(buildShareText(completed), /^C  ◐ ▪\nC  ■$/m)
})

test('multiple Ward tiles protect one turn and count as one Ward save', () => {
  const base = puzzle()
  const definition = {
    ...base, encounter: {
      ...base.encounter,
      startingTiles: base.encounter.startingTiles.map((tile) => tile.id === 1
        ? { ...tile, type: 'gem' as const, gem: 'ward' as const } : tile),
      enemyLetters: [{ id: 'o', letter: 'O', hitsRemaining: 1, initialHits: 1 }],
    },
  }
  const completed = buildDailyResult(definition,
    playWord(createLetterStrikeGame(definition.encounter), 'JOY'), '2026-09-24T12:00:00Z')
  assert.equal(completed.wardSaves, 1)
  assert.equal(completed.resolveRemaining, 5)
  assert.equal(completed.turns[0].specialTiles.length, 2)
})

test('ongoing runs and invalid completion timestamps cannot become results', () => {
  assert.throws(() => buildDailyResult(puzzle(), createLetterStrikeGame(puzzle().encounter), '2026-09-24T12:00:00Z'))
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
    averageResolveRemaining: 0,
    averageWordLength: 0,
    longestWord: null,
    totalCounters: 0,
    totalNeutral: 0,
    totalResisted: 0,
    totalLettersDestroyed: 0,
    totalStrikes: 0,
    totalArmourBroken: 0,
    totalStrikeActivations: 0,
    totalWardSaves: 0,
    uniqueEnemyDefeats: 0,
    bestResolveRemaining: 0,
    largestSingleTurnStrikes: 0,
  })
})

test('stats derive totals, word lengths, win-only Resolve and distinct defeated concepts', () => {
  const history = [
    result('2026-09-22', { resolveRemaining: 3, wordsPlayed: ['JOY', 'CHEER'], counters: 2, strikeActivations: 2 }),
    result('2026-09-23', {
      won: false, resolveRemaining: 0, wordsPlayed: ['GLOOM', 'CRY'],
      counters: 0, resisted: 2, strikeActivations: 1, wardSaves: 0, enemyWord: 'FEAR',
      lettersDestroyed: 4, totalStrikes: 5, armourBroken: 1,
    }),
    result('2026-09-24', {
      resolveRemaining: 1, wordsPlayed: ['DELIGHT', 'SAD'],
      counters: 1, resisted: 1, strikeActivations: 0, enemyWord: 'RAGE',
    }),
  ]
  assert.deepEqual(calculateStats(history.reverse(), '2026-09-24'), {
    gamesPlayed: 3,
    wins: 2,
    winRate: 2 / 3 * 100,
    currentStreak: 1,
    longestStreak: 1,
    averageResolveOnWins: 2,
    averageResolveRemaining: 4 / 3,
    averageWordLength: 26 / 6,
    longestWord: 'DELIGHT',
    totalCounters: 3,
    totalNeutral: 6,
    totalResisted: 3,
    totalLettersDestroyed: 24,
    totalStrikes: 29,
    totalArmourBroken: 5,
    totalStrikeActivations: 3,
    totalWardSaves: 2,
    uniqueEnemyDefeats: 2,
    bestResolveRemaining: 3,
    largestSingleTurnStrikes: 3,
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
  assert.deepEqual(history[3].quality, { resolveRemaining: 0, startingResolve: 5, fraction: 0 })
  assert.equal(history[3].attacks, 6)
})

test('share text includes the public game URL and outcomes without words or enemy information', () => {
  const completed = result()
  const share = buildShareText(completed)
  assert.equal(share, [
    'WYRMLE 2026-09-24 · NORMAL · VICTORY', '', 'LIVES', '□□□□□ 0/5', '',
    'C  ·······■·◐ ▪', 'C  ◐■·······■', 'C  ·····■■···',
    'C  ··■■······', 'N  ■·······■· ◆', 'N  ····■·····',
    '', 'https://crayjake.github.io/wyrmle/',
  ].join('\n'))
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
  assert.match(buildShareText({ ...completed, won: false }), /DEFEAT/)
  const rows = share.split('\n').filter((line) => /^[CNR]  /.test(line))
  assert.equal(rows.length, completed.attacks)
  assert.ok(rows.every((row) => row.split('  ')[1].split(' ')[0].length === completed.enemyLetterCount))
  assert.doesNotMatch(share, /words|attacks/i)
})

test('Resolve share segments match the canonical resource and missing positional evidence is rejected', () => {
  const completed = result()
  for (let remaining = 0; remaining <= 5; remaining += 1) {
    const text = buildShareText({ ...completed, resolveRemaining: remaining })
    assert.equal(text.split('\n')[3], `${'■'.repeat(remaining)}${'□'.repeat(5 - remaining)} ${remaining}/5`)
  }
  const malformed = structuredClone(completed)
  malformed.turns[0].letterOutcomes.pop()
  assert.throws(() => buildShareText(malformed), /every original enemy position/)
  assert.throws(() => buildShareText({ ...completed, enemyLetterCount: 9 }), /every original enemy position/)
})

test('future submission is a deterministic compact summary without local display data', () => {
  const completed = result()
  const before = structuredClone(completed)
  const submission = buildDailyScoreSubmission(completed)
  assert.deepEqual(submission, {
    mode: 'normal',
    puzzleDifficulty: completed.puzzleDifficulty,
    undosUsed: 0,
    undosRemaining: 3,
    puzzleId: completed.puzzleId,
    gameVersion: completed.gameVersion,
    puzzleVersion: completed.puzzleVersion,
    won: true,
    resolveRemaining: 0,
    turnsUsed: 6,
    totalStrikes: completed.totalStrikes,
    lettersDestroyed: 10,
    armourBroken: 2,
    tileIdsByTurn: completed.turns.map((turn) => turn.tileIds),
    semanticSequence: completed.turns.map((turn) => turn.semanticLabel),
    letterOutcomesByTurn: completed.turns.map((turn) => turn.letterOutcomes),
    wardSaves: 1,
    strikeActivations: 1,
    completedAt: completed.completedAt,
  })
  assert.deepEqual(buildDailyScoreSubmission(structuredClone(completed)), submission)
  const definition = getDailyPuzzleForVersion(submission.puzzleId, submission.gameVersion, submission.puzzleVersion)
  let replay = createLetterStrikeGame(definition.encounter)
  for (const ids of submission.tileIdsByTurn) replay = submitLetterStrike(replay, ids)
  assert.deepEqual(buildDailyScoreSubmission(buildDailyResult(
    definition, replay, submission.completedAt,
  )), submission)
  submission.tileIdsByTurn[0].push(999)
  submission.letterOutcomesByTurn[0][0].hitsAfter = 999
  assert.deepEqual(completed, before)
  for (const displayOnly of ['enemyWord', 'wordsPlayed', 'strongestHit', 'turns', 'score', 'stars']) {
    assert.equal(displayOnly in submission, false)
  }
})

test('mode is explicit in completed results, sharing and future submissions without changing outcome notation', () => {
  const definition = puzzle()
  const game = wonGame(definition)
  const normal = buildDailyResult(definition, game, '2026-09-24T12:00:00Z')
  const hard = buildDailyResult(definition, game, '2026-09-24T12:00:00Z', 'hard')
  assert.equal(normal.mode, 'normal')
  assert.equal(hard.mode, 'hard')
  const [normalHeader, ...normalBody] = buildShareText(normal).split('\n')
  const [hardHeader, ...hardBody] = buildShareText(hard).split('\n')
  assert.equal(normalHeader, 'WYRMLE 2026-09-24 · NORMAL · VICTORY')
  assert.equal(hardHeader, 'WYRMLE 2026-09-24 · HARD · VICTORY')
  assert.deepEqual(hardBody, normalBody)
  assert.deepEqual(buildDailyScoreSubmission(hard), { ...buildDailyScoreSubmission(normal), mode: 'hard', undosRemaining: 1 })
  assert.deepEqual(hard.turns, normal.turns)
})
