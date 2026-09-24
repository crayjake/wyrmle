import type { GameRules } from './types.ts'

// These numbers and the optional grammar experiment are encounter configuration.
export const defaultRules: GameRules = {
  minimumWordLength: 3,
  damagePerLetter: 1,
  semantic: { opposite: 5, similar: -3, related: -1, unrelated: 0, minimumDamage: 1 },
  grammar: { enabled: true, bonus: 2 },
  tileEffects: {
    ward: { bonusDamage: 0, preventResolveLoss: true },
    power: { bonusDamage: 3, preventResolveLoss: false },
  },
}
