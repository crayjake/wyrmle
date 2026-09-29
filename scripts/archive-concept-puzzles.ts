/** Move the reviewed reusable-tile boards into dated play, preserving physical IDs. */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { conceptPreviews, conceptProgressKey } from '../src/experimental/concepts/catalog.ts'
import { shiftPuzzleId } from '../src/daily/date.ts'
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import type { ScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'

const directory = 'artifacts/calendar-transition-2026-09-29'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
mkdirSync(directory, { recursive: true })
for (const name of ['archive', 'schedule']) {
  if (!existsSync(`${directory}/previous-${name}.json`)) write(`${directory}/previous-${name}.json`, read(`src/daily/${name}.json`))
}
const concepts = conceptPreviews.filter(entry => entry.bingoHunt && !/LESS(?:NESS(?:ES)?|LY)?$/.test(entry.guide.answer))
const guides = read('src/daily/guides.json')
const proofs = read('artifacts/antonym-previews-2026-09-28/hunt-proofs.json')
const archive = concepts.map((source, index) => {
  const date = shiftPuzzleId('2026-09-28', index - concepts.length + 1)
  const id = `archive-${source.id}`
  const payload = { version: 1, id, method: 'bingo-first', encounter: read(`public/${source.asset}`) }
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
  const entry: ScheduledPuzzle = { date, id, enemy: source.enemy, asset: `puzzles/${id}-${digest}.json`,
    method: 'bingo-first', bingoHunt: true, legacyConceptId: source.id, legacyProgressKey: conceptProgressKey(source),
    report: `${directory}/${id}.json` }
  decodeScheduledPuzzle(payload, entry)
  write(`public/${entry.asset}`, payload)
  const proof = proofs.find((proof: { id: string }) => proof.id === source.id)
  write(entry.report!, { accepted: true, asset: entry.asset, answer: source.guide.answer,
    witnesses: proof.witnesses, startingBingos: proof.startingBingos, helperEffort: proof.helperEffort,
    removalProof: proof, review: proof.semanticReview })
  guides[id] = source.guide
  return entry
})
const retained = read('src/daily/archive.json').filter((entry: ScheduledPuzzle) => !entry.legacyConceptId && entry.bingoHunt)
write('src/daily/archive.json', [...retained, ...archive].sort((a, b) => a.date.localeCompare(b.date)))
write('src/daily/schedule.json', read('src/daily/schedule.json').filter((entry: ScheduledPuzzle) => entry.bingoHunt))
write('src/daily/guides.json', guides)
console.log(`Archived ${archive.length} puzzles, ${archive[0].date}–${archive.at(-1)!.date}; old manifests and saves retained.`)
