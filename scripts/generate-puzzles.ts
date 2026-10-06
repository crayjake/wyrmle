/** Publish a reviewed calendar batch through exactly the single-puzzle validator. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { puzzleProfiles } from './puzzles/profiles.ts'
import { preparePuzzle, publicationContext, checkPublicationDates, publishPreparedPuzzles } from './puzzles/publish.ts'
import { shiftPuzzleId, validatePuzzleId } from '../src/daily/date.ts'

const args = process.argv.slice(2)
const planIndex = args.indexOf('--plan')
assert.ok(planIndex >= 0 && args[planIndex + 1], 'Usage: npm run generate:puzzles -- --plan PATH.json [--dry-run]')
const plan = JSON.parse(readFileSync(args[planIndex + 1], 'utf8')) as { startDate: string; profiles: string[] }
validatePuzzleId(plan.startDate)
assert.ok(Array.isArray(plan.profiles) && plan.profiles.length > 0 && plan.profiles.every(id => typeof id === 'string'), 'The plan needs reviewed profile IDs')
assert.equal(new Set(plan.profiles).size, plan.profiles.length, 'A batch must not repeat profiles')
const context = publicationContext()
const dates = plan.profiles.map((_, index) => shiftPuzzleId(plan.startDate, index))
checkPublicationDates(dates, context)
const pairs = new Set(context.allEntries.map(entry => `${entry.enemy}:${context.guides[entry.id]?.answer}`))
const answers = new Set(context.allEntries.map(entry => context.guides[entry.id]?.answer))
const selected = plan.profiles.map(id => {
  const candidate = puzzleProfiles.find(item => item.profile.id === id)
  assert.ok(candidate, `Unknown reviewed profile: ${id}`)
  const pair = `${candidate.profile.enemy}:${candidate.profile.bingo}`
  assert.ok(!pairs.has(pair), `Enemy and answer already published: ${pair}`)
  assert.ok(!answers.has(candidate.profile.bingo), `Answer already published: ${candidate.profile.bingo}`)
  pairs.add(pair); answers.add(candidate.profile.bingo)
  return candidate
})
const puzzles = selected.map((candidate, index) => {
  const prepared = preparePuzzle(candidate, dates[index])
  const { removalProof, startingBingos } = prepared.report
  console.log(`${dates[index]} ${candidate.profile.enemy}: ${candidate.profile.bingo}; ${removalProof.pathsChecked} paths; bingos ${startingBingos.map(b => b.word).join(', ')}`)
  console.log(`  Counters: ${prepared.counters.join(', ')}`)
  return prepared
})
const boards = new Set(context.allEntries.map(entry => {
  const payload = JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8'))
  return payload.encounter.startingTiles.map((tile: { letter: string }) => tile.letter).sort().join('')
}))
for (const puzzle of puzzles) {
  assert.ok(!boards.has(puzzle.report.identity.board), `Starting letter pool already published: ${puzzle.entry.id}`)
  boards.add(puzzle.report.identity.board)
}
const dryRun = args.includes('--dry-run')
publishPreparedPuzzles(puzzles, { dryRun })
console.log(`${dryRun ? 'Validated' : 'Published'} ${puzzles.length} puzzles, ${dates[0]} through ${dates.at(-1)}. All prior dates preserved.`)
