import { createLetterStrikeGame, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../../src/game/letterStrike.ts'
import type { DailyPuzzleDefinition, DifficultyMode, StorageLike } from '../../src/daily/types.ts'
import { getRunStorageKey } from '../../src/daily/persistence.ts'
import { captureUndoSnapshot } from '../../src/daily/undo.ts'

/** A previously committed save: fresh attempts intentionally use today's rules. */
export function seedArchivedRun(storage: StorageLike, puzzle: DailyPuzzleDefinition, game: LetterStrikeState,
  mode: DifficultyMode = 'normal', completedAt = '2026-09-28T12:00:00.000Z') {
  let replay = createLetterStrikeGame(puzzle.encounter)
  const undoHistory = game.playedWords.map(move => {
    const snapshot = captureUndoSnapshot(replay)
    replay = submitLetterStrike(replay, move.tiles.map(tile => tile.id))
    if (!snapshot.encounter.meaningLexicon) return snapshot
    const { encounter: _encounter, ...position } = snapshot
    return position
  })
  storage.setItem(getRunStorageKey(puzzle.puzzleId), JSON.stringify({
    saveVersion: 5, mode, puzzleId: puzzle.puzzleId, gameVersion: puzzle.gameVersion, puzzleVersion: puzzle.puzzleVersion,
    enemyLetters: game.enemyLetters, playerResolve: game.playerResolve, tiles: game.tiles,
    refillIndex: game.refillIndex, nextTileId: game.nextTileId, playedWords: game.playedWords,
    status: game.status, completedAt: game.status === 'playing' ? null : completedAt,
    revision: game.playedWords.length + 1, undosUsed: 0, undoHistory,
  }))
}
