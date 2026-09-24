import type { EnemyLetter } from '../game/letterStrike.ts'
import type { Random } from './random.ts'

export function placeArmour(enemy: string, vocabulary: readonly string[], count: number, random: Random): EnemyLetter[] {
  const eligible = [...enemy].map((letter, index) => ({ index,
    opportunities: vocabulary.filter(word => word.includes(letter)).length,
    tie: random.next(),
  })).filter(item => item.opportunities >= 4).sort((a, b) => b.opportunities - a.opportunities || b.tie - a.tie)
  const armoured = new Set(eligible.slice(0, count).map(item => item.index))
  return [...enemy].map((letter, index) => ({
    id: `enemy-${index}`, letter, initialHits: armoured.has(index) ? 2 : 1, hitsRemaining: armoured.has(index) ? 2 : 1,
  }))
}
