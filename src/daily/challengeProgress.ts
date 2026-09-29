import { getDailyPuzzleId, validatePuzzleId } from './date.ts'
import { winStars } from '../game/rating.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import type { StorageLike } from './types.ts'

export const CHALLENGE_PREFIX = 'wyrmle:daily:challenge:v1:'
export type DailyLives = 1 | 2 | 3
export type ChallengeMove = { word: string; ids: number[]; hardGuess?: true }
export type ChallengeRecord = {
  version: 1; date: string; asset: string; revision: number; attempts: number
  bestWords: number | null
  bestSolution?: string[]
  /** UTC date of the first win; absent on older saves with unknown completion time. */
  wonOn?: string
  rules?: 'bingo-hunt'
  // Four/five lives are accepted only to finish a migrated historical attempt.
  run: { lives: DailyLives | 4 | 5; started: boolean; status: LetterStrikeState['status']; moves: ChallengeMove[]; hintStep?: number }
}
export const challengeKey = (date: string) => CHALLENGE_PREFIX + date
// A replacement board must never erase a played revision or inherit its stars.
export const challengeBackupKey = (date: string, asset: string) => `wyrmle:daily:revision:v1:${date}:${asset}`
export const challengeLives = (bestWords: number | null): DailyLives => bestWords === null ? 3 : bestWords <= 2 ? 1 : 2
export const challengeStars = (words: number | null) => words === null ? 0 : winStars(words)
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max

export function readChallenge(date: string, storage: Pick<StorageLike, 'getItem'>): ChallengeRecord | null {
  return parseChallenge(date, storage.getItem(challengeKey(date)))
}

function parseChallenge(date: string, raw: string | null): ChallengeRecord | null {
  if (!raw || raw.length > 32_000) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (!object(v) || v.version !== 1 || v.date !== date || typeof v.asset !== 'string'
      || !integer(v.revision, 0, Number.MAX_SAFE_INTEGER) || !integer(v.attempts, 0, Number.MAX_SAFE_INTEGER)
      || !(v.bestWords === null || integer(v.bestWords, 1, 32)) || !object(v.run)
      || (v.rules !== undefined && v.rules !== 'bingo-hunt')) return null
    const r = v.run
    if (!integer(r.lives, 1, 5) || typeof r.started !== 'boolean' || !['playing', 'won', 'lost'].includes(String(r.status))
      || (r.hintStep !== undefined && !integer(r.hintStep, 1, 4))
      || !Array.isArray(r.moves) || r.moves.length > r.lives || (!r.started && r.moves.length > 0)
      || (r.status === 'won' && r.moves.length === 0)) return null
    if (!r.moves.every(m => object(m) && typeof m.word === 'string' && /^[A-Z]{3,16}$/.test(m.word)
      && (m.hardGuess === undefined || m.hardGuess === true)
      && Array.isArray(m.ids) && m.ids.length === m.word.length && new Set(m.ids).size === m.ids.length
      && m.ids.every(id => integer(id, 0, 10_000)))) return null
    // Older saves contain only the score. A missing/bad optional word list must
    // not discard that score or the current attempt.
    if (v.bestSolution !== undefined && (!Array.isArray(v.bestSolution) || v.bestSolution.length !== v.bestWords
      || !v.bestSolution.every(word => typeof word === 'string' && /^[A-Z]{3,16}$/.test(word)))) delete v.bestSolution
    if (v.wonOn !== undefined) {
      try { if (typeof v.wonOn !== 'string') throw new Error(); validatePuzzleId(v.wonOn) }
      catch { delete v.wonOn }
    }
    return v as ChallengeRecord
  } catch { return null }
}

export function openChallenge(date: string, asset: string, encounter: LetterStrikeEncounter, storage: Pick<StorageLike, 'getItem'>) {
  const saved = readChallenge(date, storage)
  if (!saved && storage.getItem(challengeKey(date))) throw new Error('Saved progress could not be read. It has been kept; reload to try again.')
  const fresh: ChallengeRecord = { version: 1, date, asset, revision: saved?.revision ?? 0, attempts: 0, bestWords: null,
    ...(encounter.bingoHunt ? { rules: 'bingo-hunt' as const } : {}),
    run: { lives: 3, started: false, status: 'playing', moves: [] } }
  const backup = parseChallenge(date, storage.getItem(challengeBackupKey(date, asset)))
  const record = saved?.asset === asset ? saved : backup?.asset === asset
    ? { ...backup, revision: saved?.revision ?? 0 } : fresh
  let game = createLetterStrikeGame({ ...encounter, startingResolve: record.run.lives })
  for (const move of record.run.moves) {
    const next = submitLetterStrike(game, move.ids, { hardGuess: move.hardGuess })
    if (next.error || next.playedWords.length !== game.playedWords.length + 1 || next.playedWords.at(-1)?.word !== move.word) {
      throw new Error('This saved attempt could not be restored. Reload to try again; your saved progress has been kept.')
    }
    game = next
  }
  if (game.status !== record.run.status) throw new Error('This saved attempt is incomplete. Reload to try again; your saved progress has been kept.')
  return { record, game, started: record.run.started, hintStep: record.run.hintStep ?? 1 }
}

function write(record: ChallengeRecord, expectedRevision: number, storage: Pick<StorageLike, 'getItem' | 'setItem'>) {
  const existing = readChallenge(record.date, storage)
  if ((existing?.revision ?? 0) !== expectedRevision) throw new Error('This puzzle changed in another tab. Reload to continue.')
  const next = { ...record, revision: expectedRevision + 1 }
  if (existing && existing.asset !== record.asset) {
    storage.setItem(challengeBackupKey(existing.date, existing.asset), JSON.stringify(existing))
  }
  storage.setItem(challengeBackupKey(next.date, next.asset), JSON.stringify(next))
  storage.setItem(challengeKey(record.date), JSON.stringify(next))
  return next
}

/** Recover older wins while their moves still exist, before a replay replaces them. */
export function challengeBestSolution(record: ChallengeRecord): string[] | undefined {
  return record.bestSolution ?? (record.run.status === 'won' && record.run.moves.length === record.bestWords
    ? record.run.moves.map(move => move.word) : undefined)
}

export function saveChallenge(record: ChallengeRecord, game: LetterStrikeState, started: boolean,
  storage: Pick<StorageLike, 'getItem' | 'setItem'>, hintStep = record.run.hintStep ?? 1, now = new Date()): ChallengeRecord {
  if (game.encounter.startingResolve !== record.run.lives) throw new Error('Attempt lives changed.')
  const moves = game.playedWords.map(move => ({ word: move.word, ids: move.tiles.map(tile => tile.id),
    ...(move.hardGuess ? { hardGuess: true as const } : {}) }))
  if (record.rules === 'bingo-hunt' && (!game.encounter.bingoHunt || record.run.started && !started
    || (record.bestWords !== null || record.run.status !== 'playing') && moves.length !== record.run.moves.length
    || moves.length < record.run.moves.length || record.run.moves.some((move, index) =>
      move.word !== moves[index]?.word || move.hardGuess !== moves[index]?.hardGuess
      || JSON.stringify(move.ids) !== JSON.stringify(moves[index]?.ids)))) {
    throw new Error('Each puzzle has one attempt. Your progress is saved.')
  }
  const previousSolution = challengeBestSolution(record)
  const bestSolution = game.status === 'won' && (moves.length < (record.bestWords ?? Infinity)
    || moves.length === record.bestWords && !previousSolution) ? moves.map(move => move.word) : previousSolution
  return write({ ...record, attempts: record.attempts + Number(started && !record.run.started),
    bestWords: game.status === 'won' ? Math.min(record.bestWords ?? Infinity, moves.length) : record.bestWords,
    bestSolution,
    wonOn: record.wonOn ?? (game.status === 'won' && record.bestWords === null ? getDailyPuzzleId(now) : undefined),
    run: { lives: record.run.lives, started, status: game.status, moves, hintStep } }, record.revision, storage)
}

export function restartChallenge(record: ChallengeRecord, storage: Pick<StorageLike, 'getItem' | 'setItem'>): ChallengeRecord {
  if (record.rules === 'bingo-hunt') throw new Error('Each puzzle has one attempt. Your progress is saved.')
  return write({ ...record, bestSolution: challengeBestSolution(record),
    run: { lives: challengeLives(record.bestWords), started: false, status: 'playing', moves: [] } }, record.revision, storage)
}

/** Count a date once at its best result; replaying never inflates star totals. */
export function challengeHistory(storage: StorageLike) {
  const history: ChallengeRecord[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(CHALLENGE_PREFIX)) continue
    const record = readChallenge(key.slice(CHALLENGE_PREFIX.length), storage)
    if (record?.attempts) history.push(record)
  }
  return history.sort((a, b) => b.date.localeCompare(a.date))
}
