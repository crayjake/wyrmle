import { getGrammaticalModifier } from './grammar.ts'
import type { GameState, Gem, PartOfSpeech, SemanticRelation } from './types.ts'

export type GrammarModifier = { id: string; label: string; value: number }
export type TileSummary = {
  id: Gem
  label: string
  symbol: string
  count: number
  bonusDamage: number
  preventsResolveLoss: boolean
  detail: string
}
export type BattleEvent = {
  id: number
  word: string
  damage: number
  semanticLabel: string
  effectLabels: string[]
}

const partsOfSpeech: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
const gemOrder: readonly Gem[] = ['power', 'ward']
const gemLabels: Record<Gem, { label: string; symbol: string }> = {
  power: { label: 'POWER', symbol: '◆' },
  ward: { label: 'WARD', symbol: '◇' },
}
const semanticLabels: Record<SemanticRelation, string> = {
  opposite: 'COUNTER',
  similar: 'RESISTED',
  related: 'RELATED',
  unrelated: 'NEUTRAL',
}

// Ask the scoring rule which unambiguous word types affect this enemy.
export function getActiveGrammarModifiers(state: GameState): GrammarModifier[] {
  const { enemy, rules } = state.encounter
  return partsOfSpeech.map((partOfSpeech) => ({
    id: partOfSpeech,
    label: partOfSpeech.toUpperCase(),
    value: getGrammaticalModifier([partOfSpeech], enemy.partOfSpeech, rules.grammar),
  })).filter((modifier) => modifier.value !== 0)
}

// Counts actual remaining tiles, while the short effect description comes from
// the encounter's current rules. Bonus damage is per tile, not per group.
export function getCurrentTileSummary(state: GameState): TileSummary[] {
  return gemOrder.flatMap((gem) => {
    const count = state.tiles.filter((tile) => tile.type === 'gem' && tile.gem === gem).length
    if (count === 0) return []

    const rule = state.encounter.rules.tileEffects[gem]
    const detail = [
      ...(rule.bonusDamage !== 0 ? [`${rule.bonusDamage > 0 ? '+' : ''}${rule.bonusDamage}`] : []),
      ...(rule.preventResolveLoss ? ['SAVE TURN'] : []),
    ].join(' ')
    return [{
      id: gem,
      ...gemLabels[gem],
      count,
      bonusDamage: rule.bonusDamage,
      preventsResolveLoss: rule.preventResolveLoss,
      detail,
    }]
  })
}

// History describes what happened at submission time; changing encounter rules
// must not rewrite recorded damage, semantic results, or triggered effects.
export function getRecentBattleEvents(state: GameState, limit = state.playedWords.length): BattleEvent[] {
  const count = Math.min(state.playedWords.length, Math.max(0, Math.trunc(limit) || 0))
  const start = Math.max(0, state.playedWords.length - count)
  return state.playedWords.slice(start).map((attack, index) => ({
    id: start + index,
    word: attack.word,
    damage: attack.damage,
    semanticLabel: semanticLabels[attack.preview.semanticRelation],
    effectLabels: gemOrder.filter((gem) => attack.effects.some((effect) => (
      effect.gem === gem && (effect.bonusDamage !== 0 || effect.preventsResolveLoss)
    ))).map((gem) => gemLabels[gem].label),
  })).reverse()
}
