import type { BattleEvent, GrammarModifier } from './hud.ts'
import type { LetterStrikeGem, LetterStrikePreview, LetterStrikeState } from './letterStrike.ts'
import type { AttackBonus, PartOfSpeech } from './types.ts'

export type LetterStrikeTileSummary = {
  id: LetterStrikeGem
  label: string
  symbol: string
  detail: string
}

const gemPresentation: Record<LetterStrikeGem, { label: string; symbol: string }> = {
  strike: { label: 'STRIKE', symbol: '◆' },
  ward: { label: 'WARD', symbol: '◇' },
  regen: { label: 'REGEN', symbol: '+' },
}

export function getLetterStrikeGrammarModifiers(state: Pick<LetterStrikeState, 'encounter'>): GrammarModifier[] {
  const partsOfSpeech: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
  return partsOfSpeech.flatMap(partOfSpeech => {
    const value = state.encounter.grammarModifiers?.[partOfSpeech] ?? 0
    return value === 0 ? [] : [{ id: partOfSpeech, label: partOfSpeech.toUpperCase(), value }]
  })
}

export function getLetterStrikeBonuses(preview: LetterStrikePreview): AttackBonus[] {
  if (!preview.valid) return []
  return [
    { label: preview.semanticLabel },
    { label: `${preview.strikes} ${preview.strikes === 1 ? 'STRIKE' : 'STRIKES'}` },
    ...(preview.longWordModifier !== 0 ? [{ label: 'LONG', value: preview.longWordModifier }] : []),
    ...(preview.grammaticalModifier !== 0 && preview.grammaticalPartOfSpeech
      ? [{ label: preview.grammaticalPartOfSpeech.toUpperCase(), value: preview.grammaticalModifier }] : []),
    ...preview.effectLabels.map(label => ({ label })),
  ]
}

// Identity belongs to each actual tile; explanations follow its current rules.
export function getLetterStrikeTileSummary(
  state: Pick<LetterStrikeState, 'tiles' | 'encounter'>,
): readonly LetterStrikeTileSummary[] {
  return (['strike', 'ward', 'regen'] as const).flatMap(gem => {
    if (!state.tiles.some(tile => tile.type === 'gem' && tile.gem === gem)) return []
    const rule = state.encounter.tileEffects[gem]
    if (!rule) return []
    return [{
      id: gem,
      ...gemPresentation[gem],
      detail: [
        ...(rule.strike ? ['STRIKES MATCHING LETTER'] : []),
        ...(rule.preventResolveLoss ? ['SAVE TURN'] : []),
        ...(rule.regenerate ? ['MATCHING ENEMY LETTER RECOVERS AFTER STRIKES'] : []),
      ].join(' · '),
    }]
  })
}

// Retain the shared log's amount field while displaying strikes in the UI.
// Events use the recorded preview so later rule changes cannot rewrite history.
export function getLetterStrikeBattleEvents(
  state: Pick<LetterStrikeState, 'playedWords'>,
  limit = state.playedWords.length,
): BattleEvent[] {
  const count = Math.min(state.playedWords.length, Math.max(0, Math.trunc(limit) || 0))
  const start = state.playedWords.length - count
  return state.playedWords.slice(start).map((move, index) => ({
    id: start + index,
    word: move.word,
    damage: move.strikes,
    semanticLabel: move.semanticLabel,
    effectLabels: [
      ...(move.preview.longWordModifier !== 0 ? [`LONG +${move.preview.longWordModifier}`] : []),
      ...(move.preview.grammaticalModifier !== 0 && move.preview.grammaticalPartOfSpeech
        ? [`${move.preview.grammaticalPartOfSpeech.toUpperCase()} ${move.preview.grammaticalModifier > 0 ? '+' : ''}${move.preview.grammaticalModifier}`] : []),
      ...move.effectLabels,
    ],
  })).reverse()
}
