import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import history from '../scripts/bingo/published-history.json' with { type: 'json' }
import summary from '../artifacts/daily-year-2026-10-26/summary.json' with { type: 'json' }
import manifest from '../artifacts/daily-year-2026-10-26/schedule.json' with { type: 'json' }
import benchmarks from '../artifacts/daily-year-v3-benchmarks-2026-09-27/benchmarks.json' with { type: 'json' }
import { conflictsWithBatch, sampleBatch, selectBatch } from '../scripts/bingo/year/select.ts'
import { yearProfile, yearThemes } from '../scripts/bingo/year/profiles.ts'
import { bingoProfileVersion, createBingoMeanings } from '../scripts/bingo/meanings.ts'
import { freshnessIssues, puzzleIdentity } from '../scripts/bingo/freshness.ts'
import dailySchedule from '../artifacts/bingo-hunt-daily-2026-09-29/previous-schedule.json' with { type: 'json' }
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import archivedPuzzles from '../artifacts/calendar-transition-2026-09-29/previous-archive.json' with { type: 'json' }
import { validateBingo } from '../scripts/bingo/validate.ts'
const puzzleSchedule = [...archivedPuzzles, ...dailySchedule]
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

test('the frozen combat batch published 38 distinct reviewed puzzles and moves five random samples into the archive', () => {
  assert.equal(summary.published, 38); assert.equal(manifest.length, 38)
  const ids = new Set(manifest.map(e => e.id)), prior = history.filter(e => !ids.has(e.id))
  const reports = manifest.map(e => read(e.report))
  const samples = sampleBatch(reports, 5, summary.archiveSampleSeed)
  assert.deepEqual(samples.map(r => r.id), summary.archiveSample.map(e => e.id))
  assert.equal(new Set(reports.map(r => r.enemyLemma)).size, 38)
  for (const entry of manifest) {
    const replacement = benchmarks.find(b => b.changed && b.previous.id === entry.id)
    assert.deepEqual(puzzleSchedule.filter(e => e.id === entry.id), replacement
      ? replacement.current.id === entry.id ? [replacement.current] : [] : [entry], 'A sample has no second date in the future queue')
    if (replacement) assert.deepEqual(puzzleSchedule.filter(e => e.date === entry.date), [replacement.current], 'Only the documented V3 revision replaces an original sample')
    const report = read(entry.report), encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
    assert.equal(report.accepted, true); assert.ok(report.editorialReview)
    // Superseded assets retain their published source version for saved replay.
    // The current semantic revision is checked against its source in the V3 tests.
    assert.equal(encounter.meaningLexicon!.profileVersion, replacement ? report.profileVersion
      : bingoProfileVersion(yearProfile(yearThemes.find(t => t.id === report.theme)!, report.side, report)))
    const identity = puzzleIdentity(entry.id, encounter)
    assert.deepEqual(identity, report.identity)
    assert.deepEqual(freshnessIssues(identity, [...prior, ...reports.filter(r => r.id !== entry.id).map(r => r.identity)]), [])
    if (entry.date < dailySchedule[0].date) validateBingo(encounter, report.answer, report.analysis)
  }
  assert.equal(dailySchedule.at(-1)!.date, summary.end)
})

test('batch selection rejects shared hidden bingo families, enemy variants and rearranged boards', () => {
  const original = read(manifest[0].report)
  const copy = { ...original, id: 'second', enemy: 'OTHER', enemyLemma: 'other' }
  assert.equal(conflictsWithBatch(copy, [original]), true)
  const distinct = { ...copy, identity: { ...copy.identity, board: 'XYZ', bingoFamilies: ['NEW'] } }
  assert.equal(conflictsWithBatch(distinct, [original]), false)
  assert.equal(conflictsWithBatch({ ...distinct, enemyLemma: original.enemyLemma }, [original]), true)
  assert.equal(selectBatch([original, copy, distinct]).length, 2)
  assert.throws(() => selectBatch([], 0))
  assert.throws(() => sampleBatch([original], 1, 'seed'))
})

test('bulk pools fix known homographs and include ordinary concept words without generic shortcut counters', () => {
  const compile = (id: string) => createBingoMeanings(yearProfile(yearThemes.find(t => t.id === id)!, 0)).meanings
  const light = compile('light')
  for (const word of ['LAMP', 'LAMPS', 'FLASH', 'FLASHED', 'RAY', 'SUNNY', 'DAWN']) assert.equal(light[word].relation, 'opposite', word)
  const hide = compile('concealment')
  assert.equal(hide.HIDDEN.relation, 'similar')
  const permission = compile('permission')
  for (const word of ['BANI', 'BARED', 'BARING']) assert.equal(permission[word].relation, 'unrelated', word)
  assert.equal(permission.BARRED.relation, 'similar')
  assert.equal(permission.TAKE.relation, 'unrelated')
  const hunger = compile('hunger')
  assert.equal(hunger.DINING.relation, 'opposite')
  assert.equal(hunger.SNACK.relation, 'opposite')
  assert.equal(hunger.FITS.relation, 'unrelated')
  const truth = compile('truth')
  assert.equal(truth.LIED.relation, 'similar')
  assert.equal(truth.LAIN.relation, 'unrelated')
})
