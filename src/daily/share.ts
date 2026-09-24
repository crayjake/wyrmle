import type { DailyResult, ResultTurn } from './types.ts'

const relationSymbol: Record<ResultTurn['relation'], string> = {
  opposite: '🟩',
  unrelated: '⬜',
  similar: '🟨',
  related: '🟨',
}

/** Public share text deliberately omits enemy, words, tile identities and damage. */
export function buildShareText(result: DailyResult): string {
  const turns = result.turns.map((turn) => (
    relationSymbol[turn.relation]
    + '✦'.repeat(turn.specialTiles.length)
    + (turn.resolveProtected ? '◇' : '')
  )).join(' ')
  return [
    `WYRMLE ${result.date} · ${result.won ? 'Victory' : 'Defeat'}`,
    `Resolve ${result.resolveRemaining}/${result.startingResolve} · ${result.attacks} ${result.attacks === 1 ? 'attack' : 'attacks'}`,
    turns,
  ].filter(Boolean).join('\n')
}
