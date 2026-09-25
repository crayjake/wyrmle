export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb',
  'pronoun', 'preposition', 'conjunction', 'determiner', 'article', 'particle'] as const
export type PartOfSpeech = typeof PARTS_OF_SPEECH[number]
export type SemanticRelation = 'opposite' | 'similar' | 'related' | 'unrelated'
export type Gem = 'ward' | 'power'

// Retains bookworm-game's tile-attached gem model and persistent tile IDs.
export type Tile = {
  id: number
  letter: string
  type: 'normal' | 'gem'
  gem?: Gem
}

export type EnemyConcept = {
  word: string
  definition: string
  partOfSpeech: PartOfSpeech
  maxHealth: number
  semanticRelations: {
    similar: readonly string[]
    opposite: readonly string[]
    related: readonly string[]
  }
}

export type SemanticRules = Record<SemanticRelation, number> & { minimumDamage: number }
export type GrammarRules = { enabled: boolean; bonus: number }
export type TileEffectRule = { bonusDamage: number; preventResolveLoss: boolean }

export type GameRules = {
  minimumWordLength: number
  damagePerLetter: number
  semantic: SemanticRules
  grammar: GrammarRules
  tileEffects: Record<Gem, TileEffectRule>
}

export type Encounter = {
  id: string
  enemy: EnemyConcept
  startingResolve: number
  startingTiles: readonly Tile[]
  // Replacements are normal tiles, read from left to right without randomness.
  refillQueue: string
  rules: GameRules
}

export type TileEffect = {
  tileId: number
  gem: Gem
  bonusDamage: number
  preventsResolveLoss: boolean
}

export type AttackBonus = { label: string; value?: number; symbol?: string }

export type DamageResult = {
  baseDamage: number
  semanticRelation: SemanticRelation
  // The applied delta includes the semantic minimum-damage clamp.
  semanticModifier: number
  grammaticalModifier: number
  tileEffects: TileEffect[]
  totalDamage: number
  resolveCost: number
  bonuses: AttackBonus[]
}

export type AttackPreview = DamageResult & {
  word: string
  valid: boolean
  error: string | null
}

export type PlayedWord = {
  word: string
  damage: number
  tiles: Tile[]
  effects: TileEffect[]
  preview: AttackPreview
}

export type GameState = {
  encounter: Encounter
  tiles: Tile[]
  selectedTileIds: number[]
  refillIndex: number
  nextTileId: number
  enemyHp: number
  // Health and remaining turns are this single resource.
  playerResolve: number
  playedWords: PlayedWord[]
  status: 'playing' | 'won' | 'lost'
  error: string | null
}
