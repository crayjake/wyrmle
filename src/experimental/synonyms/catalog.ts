import entries from './catalog.json' with { type: 'json' }
import type { BingoGuide } from '../bingo/guides.ts'
import type { LetterStrikeEncounter } from '../../game/letterStrike.ts'
import { createLetterStrikeGame } from '../../game/letterStrike.ts'
import { unpackMeaningLexicon } from '../../game/meaningPacking.ts'

export type ConceptEntry = {
  id: string; enemy: string; definition: string; asset: string; revision: string; powers: number; guide: BingoGuide
}
export const conceptPreviews = entries as unknown as readonly ConceptEntry[]
export const conceptProgressKey = (entry: ConceptEntry) => `wyrmle:preview:synonyms:v1:${entry.id}:${entry.revision}`
export const conceptPath = (id?: string) => `?preview=concepts${id ? `&puzzle=${encodeURIComponent(id)}` : ''}`

export function decodeConceptPuzzle(value: unknown, entry: ConceptEntry): LetterStrikeEncounter {
  if (!value || typeof value !== 'object') throw new Error('Invalid preview')
  const raw = value as LetterStrikeEncounter
  if (raw.id !== `synonym-preview-v1:${entry.id}` || raw.enemy?.word !== entry.enemy || !raw.synonymRules
    || raw.startingResolve !== 3) throw new Error('Wrong preview')
  const encounter = { ...raw, meaningLexicon: unpackMeaningLexicon(raw.meaningLexicon) }
  createLetterStrikeGame(encounter)
  return encounter
}
