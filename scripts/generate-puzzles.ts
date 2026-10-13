/** Publish a reviewed calendar batch through exactly the single-puzzle validator. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { puzzleProfiles } from './puzzles/profiles.ts'
import { preparePuzzle, publicationContext, checkPublicationDates, publishPreparedPuzzles } from './puzzles/publish.ts'
import { shiftPuzzleId, validatePuzzleId } from '../src/daily/date.ts'

const args = process.argv.slice(2)
const planIndex = args.indexOf('--plan')
assert.ok(planIndex >= 0 && args[planIndex + 1], 'Usage: npm run generate:puzzles -- --plan PATH.json [--dry-run] [--replace]')
const plan = JSON.parse(readFileSync(args[planIndex + 1], 'utf8')) as {
  startDate?: string; profiles?: string[]; puzzles?: { date: string; profile: string }[]
}
assert.ok(plan.puzzles ? !plan.startDate && !plan.profiles : plan.startDate && plan.profiles,
  'Use either startDate/profiles or an explicit puzzles list')
const requests = plan.puzzles ?? plan.profiles!.map((profile, index) => ({ date: shiftPuzzleId(validatePuzzleId(plan.startDate!), index), profile }))
assert.ok(Array.isArray(requests) && requests.length > 0 && requests.every(item => typeof item.profile === 'string'), 'The plan needs reviewed profile IDs')
const profiles = requests.map(item => item.profile)
assert.equal(new Set(profiles).size, profiles.length, 'A batch must not repeat profiles')
const context = publicationContext()
const dates = requests.map(item => validatePuzzleId(item.date))
const replace = args.includes('--replace')
checkPublicationDates(dates, context, replace)
const retained = context.allEntries.filter(entry => !replace || !dates.includes(entry.date))
const pairs = new Set(retained.map(entry => `${entry.enemy}:${context.guides[entry.id]?.answer}`))
const answers = new Set(retained.map(entry => context.guides[entry.id]?.answer))
const selected = profiles.map(id => {
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
const boards = new Set(retained.map(entry => {
  const payload = JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8'))
  return payload.encounter.startingTiles.map((tile: { letter: string }) => tile.letter).sort().join('')
}))
for (const puzzle of puzzles) {
  assert.ok(!boards.has(puzzle.report.identity.board), `Starting letter pool already published: ${puzzle.entry.id}`)
  boards.add(puzzle.report.identity.board)
}
const dryRun = args.includes('--dry-run')
publishPreparedPuzzles(puzzles, { dryRun, replace })
console.log(`${dryRun ? 'Validated' : 'Published'} ${puzzles.length} puzzles. ${replace ? 'Only the listed dates are replaced; prior assets and saves are preserved.' : 'All prior dates preserved.'}`)
