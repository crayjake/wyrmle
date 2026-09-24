import { getPartsOfSpeech } from './dictionary.ts'
import { getGrammaticalModifier } from './grammar.ts'
import { applySemanticModifier, getSemanticRelation } from './semantic.ts'
import { applyTileEffects } from './tiles.ts'
import type { AttackBonus, DamageResult, Encounter, Tile } from './types.ts'

export function calculateBaseDamage(word: string, damagePerLetter: number): number {
  return word.length * damagePerLetter
}

// Refactors bookworm-game's pure damage calculation and shared preview pipeline.
// Meaning is scored separately from length, grammar, and the actual chosen gems.
export function calculateDamage(word: string, tiles: readonly Tile[], encounter: Encounter): DamageResult {
  const { rules, enemy } = encounter
  const baseDamage = calculateBaseDamage(word, rules.damagePerLetter)
  const semanticRelation = getSemanticRelation(word, enemy)
  const semantic = applySemanticModifier(baseDamage, semanticRelation, rules.semantic)
  const partsOfSpeech = getPartsOfSpeech(word)
  const grammaticalModifier = getGrammaticalModifier(partsOfSpeech, enemy.partOfSpeech, rules.grammar)
  const tilesResult = applyTileEffects(tiles, semantic.damage + grammaticalModifier, 1, rules.tileEffects)

  const bonuses: AttackBonus[] = []
  if (semantic.modifier !== 0) {
    const labels = { opposite: 'COUNTER', similar: 'SIMILAR', related: 'RELATED', unrelated: 'NEUTRAL' }
    bonuses.push({ label: labels[semanticRelation], value: semantic.modifier })
  }
  if (grammaticalModifier !== 0 && partsOfSpeech?.length === 1) {
    bonuses.push({ label: partsOfSpeech[0].toUpperCase(), value: grammaticalModifier })
  }
  for (const gem of ['power', 'ward'] as const) {
    const effects = tilesResult.effects.filter((effect) => effect.gem === gem)
    if (effects.length === 0) continue
    const bonusDamage = effects.reduce((sum, effect) => sum + effect.bonusDamage, 0)
    bonuses.push({ label: gem.toUpperCase(), ...(bonusDamage !== 0 ? { value: bonusDamage } : {}) })
  }

  return {
    baseDamage,
    semanticRelation,
    semanticModifier: semantic.modifier,
    grammaticalModifier,
    tileEffects: tilesResult.effects,
    totalDamage: Math.max(0, tilesResult.damage),
    resolveCost: tilesResult.resolveCost,
    bonuses,
  }
}
