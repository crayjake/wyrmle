import { normalizeWord } from './dictionary.ts'
import type { EnemyConcept, SemanticRelation, SemanticRules } from './types.ts'

const frozenRelationIndices = new WeakMap<readonly string[], ReadonlySet<string>>()

function containsWord(entries: readonly string[], word: string): boolean {
  // Mutable editor/fixture lists must reflect changes immediately. Only an
  // immutable list can safely reuse its normalized index between previews.
  if (!Object.isFrozen(entries)) return entries.some(entry => normalizeWord(entry) === word)
  let index = frozenRelationIndices.get(entries)
  if (!index) {
    index = new Set(entries.map(normalizeWord))
    frozenRelationIndices.set(entries, index)
  }
  return index.has(word)
}

export function getSemanticRelation(word: string, enemy: Pick<EnemyConcept, 'semanticRelations'>): SemanticRelation {
  const normalized = normalizeWord(word)
  // Explicit precedence also makes accidentally overlapping groups deterministic.
  for (const relation of ['opposite', 'similar', 'related'] as const) {
    if (containsWord(enemy.semanticRelations[relation], normalized)) {
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
