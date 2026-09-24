import type { DailyResult, DailyScoreSubmission } from './types.ts'

/**
 * Future submitResult(...) can accept this summary and its ordered tile-ID
 * evidence. A server must replay that evidence against the
 * versioned canonical puzzle and assign its own receipt/completion timestamp;
 * neither this client summary nor the client clock is trusted ranking proof.
 * This builder is deterministic and performs no networking or clock reads.
 */
export function buildDailyScoreSubmission(result: DailyResult): DailyScoreSubmission {
  return {
    puzzleId: result.puzzleId,
    gameVersion: result.gameVersion,
    puzzleVersion: result.puzzleVersion,
    won: result.won,
    resolveRemaining: result.resolveRemaining,
    turnsUsed: result.attacks,
    totalStrikes: result.totalStrikes,
    lettersDestroyed: result.lettersDestroyed,
    armourBroken: result.armourBroken,
    tileIdsByTurn: result.turns.map((turn) => [...turn.tileIds]),
    semanticSequence: result.turns.map((turn) => turn.semanticLabel),
    letterOutcomesByTurn: result.turns.map((turn) => turn.letterOutcomes.map((outcome) => ({ ...outcome }))),
    wardSaves: result.wardSaves,
    strikeActivations: result.strikeActivations,
    completedAt: result.completedAt,
  }
}
