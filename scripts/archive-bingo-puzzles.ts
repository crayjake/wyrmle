import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { bingoPreviews } from '../src/experimental/bingo/catalog.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'
import { dailySchedule, archivedPuzzles } from '../src/daily/scheduledPuzzle.ts'
import { shiftPuzzleId, validatePuzzleId } from '../src/daily/date.ts'

const { values } = parseArgs({ options: { start: { type: 'string' } } })
const existing = new Map(archivedPuzzles.map(entry => [entry.id, entry]))
const additions = bingoPreviews.filter(entry => !existing.has(entry.id))
const first = [...dailySchedule, ...archivedPuzzles].map(entry => entry.date).sort()[0]
const start = values.start ? validatePuzzleId(values.start) : shiftPuzzleId(first, -additions.length)
for (const [index, entry] of additions.entries()) {
  const date = shiftPuzzleId(start, index)
  assert.ok(![...dailySchedule, ...existing.values()].some(item => item.date === date), `Date already occupied: ${date}`)
  const data = JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8'))
  const encounter = decodeBingoPreview(data, entry, 3)
  assert.ok(encounter.startingTiles.every(tile => tile.type === 'normal' && !tile.gem))
  // Asset paths and physical tile IDs stay unchanged for local save migration.
  existing.set(entry.id, { date, id: entry.id, enemy: entry.enemy, asset: entry.asset,
    method: 'bingo-first', legacyBetaId: entry.id })
}
writeFileSync('src/daily/archive.json', JSON.stringify([...existing.values()].sort((a, b) => a.date.localeCompare(b.date)), null, 2) + '\n')
console.log(`Archived ${additions.length} puzzles; preserved ${archivedPuzzles.length} existing dates.`)
