import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { bingoProfileVersion } from '../meanings.ts'
import { yearProfile, yearThemes } from './profiles.ts'
import { selectBatch, sampleBatch } from './select.ts'
import { validateBingo } from '../validate.ts'
import { freshnessIssues, mergeDailyWindow, puzzleIdentity } from '../freshness.ts'
import { unpackMeaningLexicon } from '../../../src/game/meaningPacking.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../../../src/game/letterStrike.ts'
import { getMeaningSense } from '../../lib/wordMeanings.ts'
import { shiftPuzzleId, validatePuzzleId } from '../../../src/daily/date.ts'

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
export function publishBatch(directory: string, start: string, limit: number, sampleCount = 5) {
  validatePuzzleId(start)
  const history = read('scripts/bingo/published-history.json'), shortlist = new Set(read(`${directory}/editorial-shortlist.json`))
  const reports = readdirSync(`${directory}/reports`).filter(f => f.endsWith('.json')).map(f => read(`${directory}/reports/${f}`))
    .filter(r => shortlist.has(r.id) && r.accepted && r.editorialReview && yearThemes.some(t => t.id === r.theme
      && bingoProfileVersion(yearProfile(t, r.side, r)) === r.profileVersion))
  const chosen = selectBatch(reports, limit)
  assert.ok(chosen.length > sampleCount, 'Not enough reviewed, fresh puzzles to publish.')
  const previous = read('src/daily/schedule.json'), archive = read('src/daily/archive.json'), guides = read('src/daily/guides.json')
  assert.equal(start, shiftPuzzleId(previous.at(-1).date, 1), 'Append immediately after the existing queue.')
  const sampleSeed = randomBytes(16).toString('hex'), sample = sampleBatch(chosen, sampleCount, sampleSeed)
  const earliest = [...archive, ...previous].map(e => e.date).sort()[0]
  const samples = new Set(sample.map(r => r.id)), future = chosen.filter(r => !samples.has(r.id))
  const dated = [...sample.map((r, i) => ({ report: r, date: shiftPuzzleId(earliest, i - sampleCount), sample: true })),
    ...future.map((r, i) => ({ report: r, date: shiftPuzzleId(start, i), sample: false }))]
  const identities = [], manifest = []
  // Recheck every transport and real-engine witness before changing catalogs.
  for (const { report, date } of dated) {
    const path = `${directory}/payloads/${report.id}.puzzle.json`, bytes = readFileSync(path, 'utf8'), payload = JSON.parse(bytes)
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
    assert.equal(report.asset, `puzzles/${report.id}-${hash}.json`)
    assert.equal(payload.method, 'bingo-first')
    const encounter = { ...payload.encounter, meaningLexicon: unpackMeaningLexicon(payload.encounter.meaningLexicon) }
    assert.equal(encounter.meaningLexicon.profileVersion, report.profileVersion)
    const identity = puzzleIdentity(report.id, encounter)
    assert.deepEqual(identity, report.identity)
    assert.deepEqual(freshnessIssues(identity, [...history, ...identities]), [])
    validateBingo(encounter, report.answer, report.analysis)
    let two = createLetterStrikeGame({ ...encounter, startingResolve: 2 })
    for (const [turn, ids] of report.twoWordWin.tileIds.entries()) {
      two = submitLetterStrike(two, ids)
      assert.equal(two.error, null)
      assert.equal(two.playedWords.at(-1)?.word, report.twoWordWin.words[turn])
    }
    assert.equal(two.status, 'won'); assert.equal(two.playedWords.length, 2)
    identities.push(identity)
    manifest.push({ date, id: report.id, enemy: report.enemy, asset: report.asset,
      method: 'bingo-first', report: `${directory}/proofs/${report.id}.json` })
    const meaning = encounter.meaningLexicon.words[report.answer], enemySense = getMeaningSense(report.enemySense)!
    const senseHint = meaning.definition.toUpperCase().includes(report.answer)
      ? `Look for a ${getMeaningSense(meaning.senseId)?.partOfSpeech ?? 'word'} that works against the enemy.`
      : `Its meaning: ${meaning.definition}.`
    guides[report.id] = { hints: [`Think about a change involving ${report.theme}.`, senseHint,
      `${report.answer.length} letters, beginning with ${report.answer[0]}. You’ll need every enemy letter, including repeats for double borders.`],
      answer: report.answer, explanation: `${report.answer} means “${meaning.definition}”. It counters ${report.enemy}: “${enemySense.definition}”.` }
    assert.ok(guides[report.id].hints.every(hint => !hint.toUpperCase().includes(report.answer)))
  }
  mkdirSync('public/puzzles', { recursive: true }); mkdirSync(`${directory}/proofs`, { recursive: true })
  for (const entry of manifest) {
    copyFileSync(`${directory}/payloads/${entry.id}.puzzle.json`, `public/${entry.asset}`)
    copyFileSync(`${directory}/reports/${entry.id}.json`, entry.report)
  }
  const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
  const backdated = manifest.filter(e => samples.has(e.id)), upcoming = manifest.filter(e => !samples.has(e.id))
  write(`${directory}/schedule.json`, manifest)
  write(`${directory}/summary.json`, { generatedCandidates: readdirSync(`${directory}/reports`).length,
    reviewedCandidates: shortlist.size, published: chosen.length, futureDays: upcoming.length, start, end: upcoming.at(-1)!.date,
    archiveSampleSeed: sampleSeed, archiveSample: backdated.map(({date,id,enemy}) => ({date,id,enemy})),
    uniqueEnemies: new Set(chosen.map(r => r.enemy)).size, uniqueEnemyFamilies: new Set(chosen.map(r => r.enemyLemma)).size,
    noveltyPolicy: 'No repeated enemy families or starting letter pools within the batch; no shared available bingo family within the batch or with any previously published puzzle. Random samples move into the archive, leaving no future duplicate.',
    method: 'bingo-first', proof: 'Every publication replays its bingo, separate two-word solution and at least four distinct counter routes.' })
  write('scripts/bingo/published-history.json', [...history, ...identities])
  write('src/daily/guides.json', guides)
  write('src/daily/archive.json', mergeDailyWindow(archive, backdated))
  write('src/daily/schedule.json', mergeDailyWindow(previous, upcoming))
  console.log(`Published ${chosen.length} puzzles: ${upcoming.length} days from ${start} to ${upcoming.at(-1)!.date}, plus ${backdated.length} archive samples.`)
}
