import type { LetterStrikeEncounter } from '../game/letterStrike.ts'

export type Archetype = 'semantic-contrast' | 'greedy-trap' | 'ward-timing' | 'strike-override'
  | 'armour-break' | 'grammar-twist' | 'refill-planning' | 'clutch-finish' | 'multiple-routes'
export type WordRole = 'counter' | 'resisted' | 'neutral' | 'grammar' | 'ward' | 'strike' | 'clutch' | 'decoy'
export type AnchorWord = { word: string; roles: WordRole[]; expected: 'opening' | 'refill'; commonness: number | null }
export type GenerationGoal = { archetypes: Archetype[]; description: string }
/** The only generated encounter format. JSON carries all runtime semantic/rule data. */
export type CandidatePuzzle = {
  id: string
  seed: string
  enemyWord: string
  encounter: LetterStrikeEncounter
  goal: GenerationGoal
  anchors: AnchorWord[]
  construction: {
    design?: 'sustained-discovery'
    method: 'overlapping-multisets-and-lookahead'
    plannedWords: string[]
    plannedTileIds: number[][]
    refillBlocks: { offset: number; letters: string; supports: string }[]
    mutations: string[]
  }
  provenance: { generatorVersion: string; lexicalProvider: string; parentId?: string; rootId?: string }
}
