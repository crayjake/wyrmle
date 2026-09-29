import { readBingoProgress } from '../experimental/bingo/progress.ts'
import { archivedPuzzles } from './scheduledPuzzle.ts'
import { challengeBackupKey, challengeKey, readChallenge } from './challengeProgress.ts'
import type { ChallengeRecord } from './challengeProgress.ts'
import type { StorageLike } from './types.ts'

/** Copy once, keep original saves intact, and never replace newer daily progress.
 * Moves are replay-validated by openChallenge against the unchanged asset on load.
 */
export function migrateArchiveProgress(storage: Pick<StorageLike, 'getItem' | 'setItem'>) {
  for (const entry of archivedPuzzles) {
    if (!entry.legacyProgressKey) continue
    const existing = readChallenge(entry.date, storage)
    if (existing?.asset === entry.asset) continue
    const backup = readChallenge(entry.date, { getItem: () => storage.getItem(challengeBackupKey(entry.date, entry.asset)) })
    const old = readBingoProgress(entry.legacyProgressKey, storage)
    const run = old.runs[3]
    if (!run && old.bestWords === null) continue
    const record: ChallengeRecord = { version: 1, date: entry.date, asset: entry.asset, revision: (existing?.revision ?? 0) + 1,
      rules: 'bingo-hunt', attempts: Number(Boolean(run?.started || old.bestWords !== null)),
      bestWords: old.bestWords,
      bestSolution: run?.status === 'won' && run.moves.length === old.bestWords ? run.moves.map(move => move.word) : undefined,
      run: run ? { lives: 3, started: run.started, status: run.status, moves: run.moves, hintStep: run.hintStep }
        : { lives: 3, started: false, status: 'playing', moves: [] } }
    const next = backup?.asset === entry.asset ? { ...backup, revision: record.revision } : record
    if (existing) storage.setItem(challengeBackupKey(existing.date, existing.asset), JSON.stringify(existing))
    storage.setItem(challengeBackupKey(entry.date, entry.asset), JSON.stringify(next))
    storage.setItem(challengeKey(entry.date), JSON.stringify(next))
  }
}
