import type { GenerationGoal } from './types.ts'
import type { Random } from './random.ts'

export const generationGoals: readonly GenerationGoal[] = [
  { archetypes: ['semantic-contrast', 'multiple-routes'], description: 'Shared letters offer counters, resisted bait and ordinary alternatives.' },
  { archetypes: ['ward-timing', 'refill-planning'], description: 'Ordinary and Ward copies compete while refills open the next word.' },
  { archetypes: ['strike-override', 'grammar-twist'], description: 'Strike and adjective weakness give resisted words a useful exception.' },
  { archetypes: ['armour-break', 'multiple-routes'], description: 'Common armoured letters reward multiple matching routes.' },
  { archetypes: ['clutch-finish', 'refill-planning'], description: 'Later lexical blocks supply familiar rescue vocabulary.' },
  { archetypes: ['greedy-trap', 'semantic-contrast'], description: 'A strong immediate attack competes with preserving shared letters.' },
]

export function chooseGenerationGoal(random: Random, archivedSpecialTiles = false): GenerationGoal {
  return structuredClone(random.pick(archivedSpecialTiles ? generationGoals : generationGoals.filter(goal =>
    !goal.archetypes.includes('ward-timing') && !goal.archetypes.includes('strike-override'))))
}
