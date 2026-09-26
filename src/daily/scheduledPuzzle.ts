import schedule from './schedule.json' with { type: 'json' }
import { createLetterStrikeGame } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import { unpackMeaningLexicon } from '../game/meaningPacking.ts'

export type ScheduledPuzzle = { date: string; id: string; enemy: string; asset: string; method: string }
export const dailySchedule: readonly ScheduledPuzzle[] = schedule
export function scheduledPuzzle(date: string) { return dailySchedule.find(entry => entry.date === date) }
export function latestScheduledPuzzle(today: string) { return dailySchedule.filter(entry => entry.date <= today).at(-1) }

export function decodeScheduledPuzzle(value: unknown, entry: ScheduledPuzzle): LetterStrikeEncounter {
  if (!value || typeof value !== 'object') throw new Error('Invalid puzzle file.')
  const data = value as { version?: number; id?: string; method?: string; encounter?: LetterStrikeEncounter }
  if (data.version !== 1 || data.id !== entry.id || data.method !== 'bingo-first' || !data.encounter
    || data.encounter.enemy.word !== entry.enemy || data.encounter.startingTiles.some(tile => tile.type !== 'normal')
    || !data.encounter.finiteRefills) throw new Error('Puzzle does not match the schedule.')
  const encounter = { ...data.encounter, startingResolve: 3, meaningLexicon: unpackMeaningLexicon(data.encounter.meaningLexicon) }
  createLetterStrikeGame(encounter)
  return encounter
}
