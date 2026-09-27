import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { assessProgressionV3, validateProgressionV3 } from './bingo/progressionV3.ts'
import { validateBingo } from './bingo/validate.ts'
import { freshnessIssues, mergeDailyWindow, puzzleIdentity } from './bingo/freshness.ts'

const { values } = parseArgs({ options: { publish: { type: 'boolean', default: false } } })
const directory = 'artifacts/daily-year-v3-benchmarks-2026-09-27'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
const cases = read(`${directory}/benchmarks.json`), archive = read('src/daily/archive.json'), history = read('scripts/bingo/published-history.json')
const identities = []
// Validate the whole batch before mutating any catalog. Only explicitly
// superseded entries change; previous asset revisions remain available.
for (const benchmark of cases) {
  const { current, previous } = benchmark, report = read(benchmark.report)
  const live = archive.find(e => e.date === current.date)
  assert.ok(JSON.stringify(live) === JSON.stringify(previous) || JSON.stringify(live) === JSON.stringify(current),
    `Archive date changed since this revision was prepared: ${current.date}`)
  const encounter = decodeScheduledPuzzle(read(`public/${current.asset}`), current)
  validateBingo(encounter, report.answer, report.analysis)
  const result = validateProgressionV3(encounter, report.semanticReview)
  assert.deepEqual(report.progression, result, 'Stale V3 benchmark report')
  assert.deepEqual(report.identity, puzzleIdentity(current.id, encounter))
  if (benchmark.changed) {
    const identity = report.identity, existing = history.find(e => e.id === identity.id)
    if (existing) assert.deepEqual(existing, identity, 'Cannot overwrite a published identity')
    assert.deepEqual(freshnessIssues(identity, [...history.filter(e => e.id !== identity.id), ...identities]), [])
    if (!existing) identities.push(identity)
  } else assert.deepEqual(current, previous)
  console.log(`${current.date} ${current.enemy}: 3 words ${result.three.rating!.effort.toFixed(2)} < any 2-word win ${result.two.rating!.effort.toFixed(2)}; ordinary 2 words ${result.twoWordRoute.rating!.effort.toFixed(2)} < easiest bingo ${result.bingos[0].effort.toFixed(2)}. PASS`)
}
const rejected = read(`${directory}/rejected-days.json`)
const old = decodeScheduledPuzzle(read(`public/${rejected.entry.asset}`), rejected.entry)
const failure = assessProgressionV3(old)
assert.equal(failure.accepted, false)
assert.deepEqual(failure, rejected.progression)
assert.throws(() => validateProgressionV3(old, rejected.semanticReview), /semantic review rejected/)
console.log('Original DAYS: rejected for its difficulty tie and strained daylight interpretation. PASS')
if (values.publish) {
  write('src/daily/archive.json', mergeDailyWindow(archive, cases.map(c => c.current)))
  write('src/daily/guides.json', { ...read('src/daily/guides.json'), ...read(`${directory}/guides.json`) })
  write('scripts/bingo/published-history.json', [...history, ...identities])
  console.log('Applied the reviewed archive revision. Existing asset revisions remain available for saved-progress backups.')
}
