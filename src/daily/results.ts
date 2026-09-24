import type { GameState } from '../game/types.ts'
import type { DailyPuzzleDefinition, DailyResult } from './types.ts'

/** Summarize committed turns; transient selections and animation state never enter history. */
export function buildDailyResult(
  puzzle: DailyPuzzleDefinition,
  game: GameState,
  completedAt: string,
): DailyResult {
  if (game.status === 'playing') throw new Error('An unfinished run has no daily result.')
  const finishTime = new Date(completedAt)
  if (!Number.isFinite(finishTime.getTime())) throw new Error('A valid completion timestamp is required.')

  const turns = game.playedWords.map((attack) => ({
    damage: attack.damage,
    relation: attack.preview.semanticRelation,
    tileIds: attack.tiles.map((tile) => tile.id),
    specialTiles: attack.effects.map(({ tileId, gem }) => ({ tileId, gem })),
    resolveProtected: attack.effects.some((effect) => effect.preventsResolveLoss),
  }))

  return {
    puzzleId: puzzle.puzzleId,
    date: puzzle.date,
    gameVersion: puzzle.gameVersion,
    puzzleVersion: puzzle.puzzleVersion,
    enemyWord: puzzle.encounter.enemy.word,
    won: game.status === 'won',
    startingResolve: puzzle.encounter.startingResolve,
    resolveRemaining: game.playerResolve,
    attacks: turns.length,
    wordsPlayed: game.playedWords.map((attack) => attack.word),
    // Damage is the sum of scored hits, including damage beyond the enemy's last HP.
    totalDamage: turns.reduce((total, turn) => total + turn.damage, 0),
    strongestHit: turns.reduce((strongest, turn) => Math.max(strongest, turn.damage), 0),
    counters: turns.filter((turn) => turn.relation === 'opposite').length,
    resisted: turns.filter((turn) => turn.relation === 'similar' || turn.relation === 'related').length,
    neutral: turns.filter((turn) => turn.relation === 'unrelated').length,
    specialTilesTriggered: turns.reduce((total, turn) => total + turn.specialTiles.length, 0),
    turns,
    completedAt: finishTime.toISOString(),
  }
}

/**
 * One result per puzzle, oldest day first. The earliest completion wins even if
 * imported history arrives out of order. Exact timestamp ties have a stable
 * content tie-breaker, so duplicates cannot change stats by being reordered.
 */
export function getCompletedResults(results: readonly DailyResult[]): DailyResult[] {
  const byPuzzle = new Map<string, DailyResult>()
  const completionOrder = [...results].sort((left, right) => (
    new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime()
    || compareText(JSON.stringify(left), JSON.stringify(right))
  ))
  for (const result of completionOrder) {
    if (!byPuzzle.has(result.puzzleId)) byPuzzle.set(result.puzzleId, result)
  }
  return [...byPuzzle.values()].sort((left, right) => (
    compareText(left.date, right.date) || compareText(left.puzzleId, right.puzzleId)
  ))
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
