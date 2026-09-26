import { winStars } from '../game/rating.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import type { StorageLike } from './types.ts'

export const CHALLENGE_PREFIX = 'wyrmle:daily:challenge:v1:'
export type DailyLives = 1 | 2 | 3
export type ChallengeMove = { word: string; ids: number[] }
export type ChallengeRecord = {
  version: 1; date: string; asset: string; revision: number; attempts: number
  bestWords: number | null
  run: { lives: DailyLives; started: boolean; status: LetterStrikeState['status']; moves: ChallengeMove[] }
}
export const challengeKey = (date: string) => CHALLENGE_PREFIX + date
export const challengeLives = (bestWords: number | null): DailyLives => bestWords === null ? 3 : bestWords <= 2 ? 1 : 2
export const challengeStars = (words: number | null) => words === null ? 0 : winStars(words)
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max

export function readChallenge(date: string, storage: Pick<StorageLike, 'getItem'>): ChallengeRecord | null {
  const raw = storage.getItem(challengeKey(date))
  if (!raw || raw.length > 32_000) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (!object(v) || v.version !== 1 || v.date !== date || typeof v.asset !== 'string'
      || !integer(v.revision, 0, Number.MAX_SAFE_INTEGER) || !integer(v.attempts, 0, Number.MAX_SAFE_INTEGER)
      || !(v.bestWords === null || integer(v.bestWords, 1, 3)) || !object(v.run)) return null
    const r = v.run
    if (!integer(r.lives, 1, 3) || typeof r.started !== 'boolean' || !['playing', 'won', 'lost'].includes(String(r.status))
      || !Array.isArray(r.moves) || r.moves.length > r.lives || (!r.started && r.moves.length > 0)
      || (r.status === 'won' && r.moves.length === 0)) return null
    if (!r.moves.every(m => object(m) && typeof m.word === 'string' && /^[A-Z]{3,16}$/.test(m.word)
      && Array.isArray(m.ids) && m.ids.length === m.word.length && new Set(m.ids).size === m.ids.length
      && m.ids.every(id => integer(id, 0, 10_000)))) return null
    return v as ChallengeRecord
  } catch { return null }
}

export function openChallenge(date: string, asset: string, encounter: LetterStrikeEncounter, storage: Pick<StorageLike, 'getItem'>) {
  const saved = readChallenge(date, storage)
  const fresh: ChallengeRecord = { version: 1, date, asset, revision: saved?.revision ?? 0, attempts: 0, bestWords: null,
    run: { lives: 3, started: false, status: 'playing', moves: [] } }
  const record = saved?.asset === asset ? saved : fresh
  let game = createLetterStrikeGame({ ...encounter, startingResolve: record.run.lives })
  for (const move of record.run.moves) {
    const next = submitLetterStrike(game, move.ids)
    if (next.error || next.playedWords.length !== game.playedWords.length + 1 || next.playedWords.at(-1)?.word !== move.word) {
      throw new Error('This saved attempt cannot be restored. Restart this puzzle to try again.')
    }
    game = next
  }
  if (game.status !== record.run.status) throw new Error('This saved attempt is incomplete. Restart this puzzle to try again.')
  return { record, game, started: record.run.started }
}

function write(record: ChallengeRecord, expectedRevision: number, storage: Pick<StorageLike, 'getItem' | 'setItem'>) {
  const existing = readChallenge(record.date, storage)
  if ((existing?.revision ?? 0) !== expectedRevision) throw new Error('This puzzle changed in another tab. Reload to continue.')
  const next = { ...record, revision: expectedRevision + 1 }
  storage.setItem(challengeKey(record.date), JSON.stringify(next))
  return next
}

export function saveChallenge(record: ChallengeRecord, game: LetterStrikeState, started: boolean,
  storage: Pick<StorageLike, 'getItem' | 'setItem'>): ChallengeRecord {
  if (game.encounter.startingResolve !== record.run.lives) throw new Error('Attempt lives changed.')
  const moves = game.playedWords.map(move => ({ word: move.word, ids: move.tiles.map(tile => tile.id) }))
  return write({ ...record, attempts: record.attempts + Number(started && !record.run.started),
    bestWords: game.status === 'won' ? Math.min(record.bestWords ?? Infinity, moves.length) : record.bestWords,
    run: { lives: record.run.lives, started, status: game.status, moves } }, record.revision, storage)
}

export function restartChallenge(record: ChallengeRecord, storage: Pick<StorageLike, 'getItem' | 'setItem'>): ChallengeRecord {
  return write({ ...record, run: { lives: challengeLives(record.bestWords), started: false, status: 'playing', moves: [] } }, record.revision, storage)
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
