import type { LetterStrikeEncounter, LetterStrikePreview } from '../game/letterStrike.ts'

export type StrikeDetail = { kind: 'hit' | 'life' | 'revive' | 'legacy' | 'legacy-resisted' | 'last-life'; text: string }

const meaningLabels = {
  COUNTER: 'Counter',
  NEUTRAL: 'Neutral meaning',
  RESISTED: 'Similar meaning',
} as const

/** Present the scored move, including rules carried by older saved puzzles. */
export function getStrikeSummary(preview: LetterStrikePreview, lives?: number, enemyWord?: string, counterRules?: LetterStrikeEncounter['counterRules']) {
  const details: StrikeDetail[] = []
  if (!preview.valid) return null
  if (preview.bingoHunt) return {
    meaning: `Opposite of ${enemyWord}`, kind: 'counter',
    hits: preview.bingoHunt.won ? 'Bingo' : `${preview.bingoHunt.removedTileIds.length} spare tiles removed`,
    details: lives === 1 && !preview.bingoHunt.won ? [{ kind: 'last-life' as const, text: 'Uses your last life' }] : [],
  }
  if (preview.longWordModifier) details.push({ kind: 'legacy', text: `Long ${signed(preview.longWordModifier)}` })
  if (preview.grammaticalModifier && preview.grammaticalPartOfSpeech) {
    details.push({ kind: preview.grammaticalModifier > 0 ? 'legacy' : 'legacy-resisted',
      text: `${preview.grammaticalPartOfSpeech} ${signed(preview.grammaticalModifier)}` })
  }
  // A guaranteed hit is not necessarily an extra hit: a counter can already
  // use that tile. Never describe it as +1 without a counterfactual score.
  if (preview.effectLabels.includes('STRIKE')) details.push({ kind: 'hit', text: 'Hit tile' })
  const powerHits = preview.hits.filter(hit => hit.wild)
  if (powerHits.length) details.push({ kind: 'hit', text: `Power hits ${powerHits.map(hit => hit.letter).join(', ')}` })
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
    meaning: counterRules ? preview.semanticLabel === 'COUNTER'
      ? counterRules.kind === 'antonym' ? `Opposite of ${enemyWord}` : `Counters ${enemyWord}`
      : `Not a counter ${counterRules.partOfSpeech}`
      : preview.semanticLabel === 'COUNTER' && enemyWord ? `Counters ${enemyWord}` : meaningLabels[preview.semanticLabel],
    kind: preview.semanticLabel.toLowerCase(),
    hits: `${preview.strikes} ${preview.strikes === 1 ? 'hit' : 'hits'}`,
    details,
  }
}

function signed(value: number) { return `${value > 0 ? '+' : ''}${value}` }
