import dailyGuides from './guides.json' with { type: 'json' }
import type { BingoGuide } from '../experimental/bingo/guides.ts'

export function getPuzzleGuide(id: string): BingoGuide | undefined {
  return (dailyGuides as unknown as Readonly<Record<string, BingoGuide>>)[id]
}
