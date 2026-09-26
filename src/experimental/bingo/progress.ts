import { createLetterStrikeGame, submitLetterStrike } from '../../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../../game/letterStrike.ts'
import type { BingoPreviewEntry, PreviewLives } from './catalog.ts'

export const BINGO_PROGRESS_PREFIX = 'wyrmle:beta:bingo:v1:'
type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>
type SavedMove = { word: string; ids: number[] }
type SavedAttempt = {
  started: boolean
  status: LetterStrikeState['status']
  moves: SavedMove[]
  hintStep: number
}
export type BingoProgress = {
  version: 1
  bestWords: number | null
  runs: Partial<Record<PreviewLives, SavedAttempt>>
}

/** A replacement board/meaning asset gets fresh progress, even if its name stays the same. */
export function bingoProgressKey(entry?: Pick<BingoPreviewEntry, 'asset'>): string {
  return BINGO_PROGRESS_PREFIX + (entry?.asset ?? 'original-chaos-orchestrates-1')
}

function browserStorage(): ProgressStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined }
}
const empty = (): BingoProgress => ({ version: 1, bestWords: null, runs: {} })
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max

export function readBingoProgress(key: string, storage = browserStorage()): BingoProgress {
  try {
    const raw = storage?.getItem(key)
    if (!raw || raw.length > 64_000) return empty()
    const value: unknown = JSON.parse(raw)
    if (!object(value) || value.version !== 1 || !object(value.runs)) return empty()
    const result = empty()
    if (integer(value.bestWords, 1, 32)) result.bestWords = value.bestWords
    for (const lives of [3, 4, 5] as const) {
      const run = value.runs[lives]
      if (!object(run) || typeof run.started !== 'boolean' || !['playing', 'won', 'lost'].includes(String(run.status))
        || !integer(run.hintStep, 1, 4) || !Array.isArray(run.moves) || run.moves.length > 32) continue
      if (!run.moves.every(move => object(move) && typeof move.word === 'string' && /^[A-Z]{3,16}$/.test(move.word)
        && Array.isArray(move.ids) && move.ids.length === move.word.length && new Set(move.ids).size === move.ids.length
        && move.ids.every(id => integer(id, 0, 10_000)))) continue
      if ((!run.started && run.moves.length > 0) || (run.status === 'won' && run.moves.length === 0)) continue
      result.runs[lives] = run as SavedAttempt
    }
    return result
  } catch { return empty() }
}

function write(key: string, progress: BingoProgress, storage?: ProgressStorage): boolean {
  if (!storage) return false
  try {
    const raw = JSON.stringify(progress)
    if (storage.getItem(key) !== raw) storage.setItem(key, raw)
    return true
  } catch { return false }
}

/** Store the tiny move log, never the board's multi-megabyte meaning table. */
export function saveBingoAttempt(key: string, game: LetterStrikeState, started: boolean, hintStep: number,
  storage = browserStorage()): boolean {
  if (!started && hintStep === 1 && game.playedWords.length === 0) return true
  const progress = readBingoProgress(key, storage)
  const moves = game.playedWords.map(move => ({ word: move.word, ids: move.tiles.map(tile => tile.id) }))
  progress.runs[game.encounter.startingResolve as PreviewLives] = { started, status: game.status, moves, hintStep }
  if (game.status === 'won' && moves.length > 0) progress.bestWords = Math.min(progress.bestWords ?? Infinity, moves.length)
  return write(key, progress, storage)
}

export function restartBingoAttempt(key: string, lives: PreviewLives, storage = browserStorage()): boolean {
  const progress = readBingoProgress(key, storage)
  delete progress.runs[lives]
  return write(key, progress, storage)
}

/** Rebuild accepted moves through the engine, rejecting a corrupt or stale attempt as a whole. */
export function resumeBingoAttempt(key: string, encounter: LetterStrikeEncounter, storage = browserStorage()) {
  const initial = createLetterStrikeGame(encounter)
  const fresh = { game: initial, started: false, hintStep: 1 }
  const saved = readBingoProgress(key, storage).runs[encounter.startingResolve as PreviewLives]
  if (!saved) return fresh
  let game = initial
  for (const move of saved.moves) {
    const next = submitLetterStrike(game, move.ids)
    if (next.error || next.playedWords.length !== game.playedWords.length + 1
      || next.playedWords.at(-1)?.word !== move.word) return fresh
    game = next
  }
  if (game.status !== saved.status) return fresh
  return { game, started: saved.started, hintStep: saved.hintStep }
}

export function describeBingoProgress(progress: BingoProgress, lives: PreviewLives) {
  if (progress.bestWords !== null) {
    const words = progress.bestWords
    const stars = words === 1 ? 3 : words === 2 ? 2 : 1
    return { status: words === 1 ? 'bingo' : 'completed', stars,
      label: words === 1 ? 'Bingo' : `${words} words`,
      accessible: words === 1 ? 'Bingo, completed in one word, 3 stars' : `Completed, best ${words} words, ${stars} of 3 stars` }
  }
  const run = progress.runs[lives]
  if (run?.started) return run.status === 'lost'
    ? { status: 'lost', stars: 0, label: 'Try again', accessible: 'Not completed, last attempt lost' }
    : { status: 'ongoing', stars: 0, label: 'In progress', accessible: `In progress, resume ${lives}-life attempt` }
  return { status: 'new', stars: 0, label: 'Not started', accessible: 'Not started' }
}
