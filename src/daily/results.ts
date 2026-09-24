import type { LetterStrikeState } from '../game/letterStrike.ts'
import type { DailyPuzzleDefinition, DailyResult, DifficultyMode } from './types.ts'

/** Summarize committed turns; transient selections and animation state never enter history. */
export function buildDailyResult(
  puzzle: DailyPuzzleDefinition,
  game: LetterStrikeState,
  completedAt: string,
  mode: DifficultyMode = 'normal',
): DailyResult {
  if (game.status === 'playing') throw new Error('An unfinished run has no daily result.')
  const finishTime = new Date(completedAt)
  if (!Number.isFinite(finishTime.getTime())) throw new Error('A valid completion timestamp is required.')

  const turns = game.playedWords.map((attack) => {
    const hitTileIds = new Set(attack.preview.hits.map((hit) => hit.tileId))
    const specialTiles = attack.tiles.flatMap((tile) => {
      if (tile.type !== 'gem' || !tile.gem) return []
      const effect = puzzle.encounter.tileEffects[tile.gem]
      return effect.preventResolveLoss || (effect.strike && hitTileIds.has(tile.id))
        ? [{ tileId: tile.id, gem: tile.gem }] : []
    })
    const letterOutcomes = attack.preview.letterOutcomes.map((outcome) => ({ ...outcome }))
    if (letterOutcomes.length !== puzzle.encounter.enemyLetters.length
      || letterOutcomes.some((outcome, position) => outcome.position !== position
        || outcome.enemyLetterId !== puzzle.encounter.enemyLetters[position].id)) {
      throw new Error('Turn outcomes must preserve every original enemy-letter position.')
    }
    return {
      strikes: attack.preview.hits.length,
      lettersDestroyed: letterOutcomes.filter((outcome) => outcome.removed).length,
      armourBroken: letterOutcomes.filter((outcome) => outcome.armourBroken).length,
      semanticLabel: attack.semanticLabel,
      letterOutcomes,
      tileIds: attack.tiles.map((tile) => tile.id),
      specialTiles,
      strikeActivations: attack.tiles.filter((tile) => tile.type === 'gem' && tile.gem
        && puzzle.encounter.tileEffects[tile.gem].strike && hitTileIds.has(tile.id)).length,
      resolveProtected: attack.preview.resolveCost === 0,
    }
  })

  return {
    mode,
    puzzleId: puzzle.puzzleId,
    date: puzzle.date,
    gameVersion: puzzle.gameVersion,
    puzzleVersion: puzzle.puzzleVersion,
    enemyWord: puzzle.encounter.enemy.word,
    enemyLetterCount: puzzle.encounter.enemyLetters.length,
    won: game.status === 'won',
    startingResolve: puzzle.encounter.startingResolve,
    resolveRemaining: game.playerResolve,
    attacks: turns.length,
    wordsPlayed: game.playedWords.map((attack) => attack.word),
    totalStrikes: turns.reduce((total, turn) => total + turn.strikes, 0),
    lettersDestroyed: turns.reduce((total, turn) => total + turn.lettersDestroyed, 0),
    armourBroken: turns.reduce((total, turn) => total + turn.armourBroken, 0),
    strongestHit: turns.reduce((strongest, turn) => Math.max(strongest, turn.strikes), 0),
    largestRemoval: turns.reduce((largest, turn) => Math.max(largest, turn.lettersDestroyed), 0),
    counters: turns.filter((turn) => turn.semanticLabel === 'COUNTER').length,
    resisted: turns.filter((turn) => turn.semanticLabel === 'RESISTED').length,
    neutral: turns.filter((turn) => turn.semanticLabel === 'NEUTRAL').length,
    strikeActivations: turns.reduce((total, turn) => total + turn.strikeActivations, 0),
    wardSaves: turns.filter((turn) => turn.resolveProtected).length,
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
