import type { DailyResult, ResultTurn } from './types.ts'

const semanticPrefix: Record<ResultTurn['semanticLabel'], string> = {
  COUNTER: 'C',
  NEUTRAL: 'N',
  RESISTED: 'R',
}

/** Each row tells that turn's positional story, never reconstructed from final state. */
export function buildShareText(result: DailyResult): string {
  const rows = result.turns.map((turn) => {
    if (turn.letterOutcomes.length !== result.enemyLetterCount
      || turn.letterOutcomes.some((outcome, position) => outcome.position !== position)) {
      throw new Error('Share rows require an outcome for every original enemy position.')
    }
    const positions = turn.letterOutcomes.map((outcome) => {
      if (outcome.armourBroken && outcome.removed) return '▣'
      if (outcome.removed) return '■'
      if (outcome.armourBroken) return '◐'
      return '·'
    }).join('')
    const effects = (turn.resolveProtected ? '◇' : '') + (turn.strikeActivations > 0 ? '◆' : '')
    return `${semanticPrefix[turn.semanticLabel]}  ${positions}${effects ? ` ${effects}` : ''}`
  })
  const resolve = '■'.repeat(result.resolveRemaining) + '□'.repeat(result.startingResolve - result.resolveRemaining)
  return [
    `WYRMLE ${result.date} · ${result.won ? 'VICTORY' : 'DEFEAT'}`,
    '',
    'RESOLVE',
    `${resolve} ${result.resolveRemaining}/${result.startingResolve}`,
    '',
    ...rows,
  ].join('\n')
}
