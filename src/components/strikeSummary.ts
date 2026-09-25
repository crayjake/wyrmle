import type { LetterStrikePreview } from '../game/letterStrike.ts'

export type StrikeDetail = { kind: 'hit' | 'life' | 'revive' | 'legacy' | 'legacy-resisted' | 'last-life'; text: string }

const meaningLabels = {
  COUNTER: 'Counter',
  NEUTRAL: 'Neutral meaning',
  RESISTED: 'Similar meaning',
} as const

/** Present the scored move, including rules carried by older saved puzzles. */
export function getStrikeSummary(preview: LetterStrikePreview, lives?: number, enemyWord?: string) {
  const details: StrikeDetail[] = []
  if (!preview.valid) return null
  if (preview.longWordModifier) details.push({ kind: 'legacy', text: `Long ${signed(preview.longWordModifier)}` })
  if (preview.grammaticalModifier && preview.grammaticalPartOfSpeech) {
    details.push({ kind: preview.grammaticalModifier > 0 ? 'legacy' : 'legacy-resisted',
      text: `${preview.grammaticalPartOfSpeech} ${signed(preview.grammaticalModifier)}` })
  }
  // A guaranteed hit is not necessarily an extra hit: a counter can already
  // use that tile. Never describe it as +1 without a counterfactual score.
  if (preview.effectLabels.includes('STRIKE')) details.push({ kind: 'hit', text: 'Hit tile' })
  if (preview.resolveCost === 0) details.push({ kind: 'life', text: 'Life saved' })
  else if (lives !== undefined && lives <= preview.resolveCost && preview.enemyLetters.some(letter => letter.hitsRemaining > 0)) {
    details.push({ kind: 'last-life', text: 'Uses your last life' })
  }
  const recoveries = preview.recoveries ?? []
  if (recoveries.length) {
    details.push({ kind: 'revive', text: `Revive: ${recoveries.map(recovery =>
      `${recovery.letter} ${recovery.hitsBefore === 0 ? 'returns' : 'gains armour'}`).join(', ')}` })
  }
  return {
    meaning: preview.semanticLabel === 'COUNTER' && enemyWord ? `Counters ${enemyWord}` : meaningLabels[preview.semanticLabel],
    kind: preview.semanticLabel.toLowerCase(),
    hits: `${preview.strikes} ${preview.strikes === 1 ? 'hit' : 'hits'}`,
    details,
  }
}

function signed(value: number) { return `${value > 0 ? '+' : ''}${value}` }
