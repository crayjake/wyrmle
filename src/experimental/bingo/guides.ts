import guides from './guides.json' with { type: 'json' }

export type BingoGuide = { hints: readonly [string, string, string]; answer: string; explanation: string }
export function getBingoGuide(id: string): BingoGuide | undefined {
  return (guides as unknown as Readonly<Record<string, BingoGuide>>)[id]
}
