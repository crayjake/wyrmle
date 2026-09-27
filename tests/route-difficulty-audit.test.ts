import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import manifest from '../artifacts/daily-year-2026-10-26/schedule.json' with { type: 'json' }
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { inspectThirdWords, ordinaryRoute, rateRoute, replayRoute, searchEasierRoute } from '../scripts/bingo/routeDifficulty.ts'

function fixture(enemy: string) {
  const entry = manifest.find(e => e.enemy === enemy)!
  const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
  return { encounter: decodeScheduledPuzzle(read(`public/${entry.asset}`), entry), report: read(entry.report) }
}

test('offline difficulty search finds an easier actual three-life win without changing its board', () => {
  const { encounter, report } = fixture('STONE')
  const before = JSON.stringify(encounter)
  const seed = report.analysis.routes.map(r => r.witness).find(w => w?.words.join(' ') === 'SOFT CUSHIONED EYE')
  assert.ok(seed)
  const result = searchEasierRoute(encounter, 3, report.analysis.bingos, seed, 3000)
  assert.ok(result.witness && result.rating)
  assert.ok(result.rating.effort < rateRoute(seed.words).effort)
  assert.equal(replayRoute(encounter, result.witness).playedWords.length, 3)
  assert.ok(result.witness.hits.every(hit => hit > 0))
  assert.equal(JSON.stringify(encounter), before)
})

test('a bounded search retains a valid witness and reports that easier routes may remain', () => {
  const { encounter, report } = fixture('STONE')
  const seed = report.analysis.routes.map(r => r.witness).find(w => w?.words.join(' ') === 'SOFT CUSHIONED EYE')
  const result = searchEasierRoute(encounter, 3, report.analysis.bingos, seed, 1)
  assert.equal(result.searchComplete, false)
  assert.equal(result.positions, 1)
  assert.deepEqual(result.witness, seed)
  assert.equal(replayRoute(encounter, result.witness!).status, 'won')
  assert.throws(() => searchEasierRoute(encounter, 2, report.analysis.bingos, seed, 1))
  assert.throws(() => searchEasierRoute(encounter, 3, report.analysis.bingos, seed, 0))
})

test('a two-word win padded with a zero-hit move is not evidence for an approachable three-word route', () => {
  const { encounter, report } = fixture('VEIL')
  const padded = report.analysis.routes.map(r => r.witness).find(w => w?.words.length === 3 && w.hits.includes(0))
  assert.ok(padded)
  assert.equal(replayRoute(encounter, padded).status, 'won')
  const families = new Set<string>(report.analysis.bingos.map(w => encounter.meaningLexicon!.words[w].lemma))
  assert.equal(ordinaryRoute(padded, encounter, families), false)
  assert.throws(() => replayRoute(encounter, { ...padded, tileIds: padded.tileIds.slice(0, 2) }))
})

test('third-word inspection preserves both played moves and proves every reported alternative', () => {
  const { encounter, report } = fixture('SOIL')
  const seed = report.analysis.routes.map(r => r.witness).find(w => w?.words.join(' ') === 'CLEANSE POST STERILIZED')
  assert.ok(seed)
  const result = inspectThirdWords(encounter, seed, report.analysis.bingos)
  assert.ok(result.finishers.some(f => f.words[0] === 'STERILIZED'))
  for (const finisher of result.finishers) {
    assert.deepEqual(finisher.witness.words.slice(0, 2), ['CLEANSE', 'POST'])
    assert.deepEqual(finisher.witness.tileIds.slice(0, 2), seed.tileIds.slice(0, 2))
    assert.equal(replayRoute(encounter, finisher.witness).status, 'won')
  }
})
