import { normalizeWord } from './dictionary.ts'
import type { EnemyConcept, SemanticRelation, SemanticRules } from './types.ts'

export function getSemanticRelation(word: string, enemy: EnemyConcept): SemanticRelation {
  const normalized = normalizeWord(word)
  // Explicit precedence also makes accidentally overlapping groups deterministic.
  for (const relation of ['opposite', 'similar', 'related'] as const) {
    if (enemy.semanticRelations[relation].some((entry) => normalizeWord(entry) === normalized)) {
      return relation
    }
  }
  return 'unrelated'
}

export function applySemanticModifier(
  baseDamage: number,
  relation: SemanticRelation,
  rules: SemanticRules,
): { damage: number; modifier: number } {
  const modifier = rules[relation]
  const damage = modifier < 0
    ? Math.max(rules.minimumDamage, baseDamage + modifier)
    : baseDamage + modifier
  return { damage, modifier: damage - baseDamage }
}
