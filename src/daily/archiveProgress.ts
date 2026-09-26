import { bingoProgressKey, readBingoProgress } from '../experimental/bingo/progress.ts'
import { archivedPuzzles } from './scheduledPuzzle.ts'
import { challengeKey } from './challengeProgress.ts'
import type { ChallengeRecord } from './challengeProgress.ts'
import type { StorageLike } from './types.ts'

/** Copy once, keep original saves intact, and never replace newer daily progress.
 * Moves are replay-validated by openChallenge against the unchanged asset on load.
 */
export function migrateArchiveProgress(storage: Pick<StorageLike, 'getItem' | 'setItem'>) {
  for (const entry of archivedPuzzles) {
    if (!entry.legacyBetaId || storage.getItem(challengeKey(entry.date)) !== null) continue
    const old = readBingoProgress(bingoProgressKey(entry), storage)
    const lives = ([3, 4, 5] as const).find(value => old.runs[value]?.started)
      ?? ([3, 4, 5] as const).find(value => old.runs[value]) ?? 3
    const run = old.runs[lives]
    if (!run && old.bestWords === null) continue
    const record: ChallengeRecord = { version: 1, date: entry.date, asset: entry.asset, revision: 1,
      attempts: Math.max(old.bestWords === null ? 0 : 1, Object.values(old.runs).filter(run => run?.started).length),
      bestWords: old.bestWords,
      run: run ? { lives, started: run.started, status: run.status, moves: run.moves, hintStep: run.hintStep }
        : { lives: 3, started: false, status: 'playing', moves: [] } }
    storage.setItem(challengeKey(entry.date), JSON.stringify(record))
  }
}
