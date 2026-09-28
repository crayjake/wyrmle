import entries from './catalog.json' with { type: 'json' }
import type { PartOfSpeech } from '../../game/types.ts'
import type { BingoGuide } from '../bingo/guides.ts'
import type { LetterStrikeEncounter } from '../../game/letterStrike.ts'
import { createLetterStrikeGame } from '../../game/letterStrike.ts'
import { unpackMeaningLexicon } from '../../game/meaningPacking.ts'

export type ConceptEntry = {
  bingoHunt?: boolean
  // Only a generator-certified compatible revision may retain an older save key.
  progressRevision?: string
  id: string; enemy: string; definition: string; asset: string; revision: string; powers: number; family?: string; partOfSpeech: PartOfSpeech; counterPartOfSpeech: PartOfSpeech; guide: BingoGuide
}
export const conceptPreviews = entries as unknown as readonly ConceptEntry[]
export const conceptProgressKey = (entry: ConceptEntry) => `wyrmle:preview:antonyms:v2:${entry.id}:${entry.progressRevision ?? entry.revision}`
export const conceptPath = (id?: string, hunt = false) => `?preview=concepts${id ? `&puzzle=${encodeURIComponent(id)}` : hunt ? '&mode=hunt' : ''}`

export function decodeConceptPuzzle(value: unknown, entry: ConceptEntry): LetterStrikeEncounter {
  if (!value || typeof value !== 'object') throw new Error('Invalid preview')
  const raw = value as LetterStrikeEncounter
  if (raw.id !== `antonym-preview-v2:${entry.id}` || raw.enemy?.word !== entry.enemy || !raw.counterRules
    || Boolean(raw.bingoHunt) !== Boolean(entry.bingoHunt)
    || raw.enemy.partOfSpeech !== entry.partOfSpeech
    || raw.counterRules.partOfSpeech !== entry.counterPartOfSpeech || raw.counterRules.family !== entry.family
    || raw.counterRules.kind !== (entry.family ? 'family' : 'antonym') || raw.startingResolve !== 3) throw new Error('Wrong preview')
  const encounter = { ...raw, meaningLexicon: unpackMeaningLexicon(raw.meaningLexicon) }
  createLetterStrikeGame(encounter)
  return encounter
}
