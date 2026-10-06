/** Publish one reviewed bingo-first puzzle, with exhaustive removal proofs. */
import assert from 'node:assert/strict'
import { puzzleProfiles } from './puzzles/profiles.ts'
import { preparePuzzle, publicationContext, checkPublicationDates, publishPreparedPuzzles } from './puzzles/publish.ts'
import { validatePuzzleId } from '../src/daily/date.ts'

const args = process.argv.slice(2)
const option = (name: string) => args[args.indexOf(name) + 1]
if (!args.includes('--profile') || !args.includes('--date')) throw new Error('Usage: npm run generate:puzzle -- --profile ID --date YYYY-MM-DD [--dry-run] [--replace] [--archive]')
const date = validatePuzzleId(option('--date'))
const selected = puzzleProfiles.find(item => item.profile.id === option('--profile'))
assert.ok(selected, `Unknown reviewed profile: ${option('--profile')}`)
const dryRun = args.includes('--dry-run'), archive = args.includes('--archive'), replace = args.includes('--replace')
checkPublicationDates([date], publicationContext(archive), replace)
const prepared = preparePuzzle(selected, date)
publishPreparedPuzzles([prepared], { dryRun, archive, replace })
const { entry, counters, report: { witnesses, startingBingos, helperEffort, removalProof } } = prepared
console.log(JSON.stringify({ dryRun, entry, witnesses, startingBingos, helperEffort, counters }, null, 2))
console.log(`${date} ${entry.enemy}: ${removalProof.pathsChecked} two-helper paths; ${removalProof.minPreferredFamilies} minimum familiar follow-up families`)
