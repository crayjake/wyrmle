import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { dailyBingoProfiles, dailyBingoTheme } from './bingo/dailyProfiles.ts'
import freshProfiles from './bingo/freshProfiles.json' with { type: 'json' }
import { createBingoMeanings, bingoProfileVersion } from './bingo/meanings.ts'
import { analyseBingo, constructBingo } from './bingo/generate.ts'
import { findTwoWordWin } from './bingo/twoWordWin.ts'
import { validateBingo } from './bingo/validate.ts'
import { packMeaningLexicon, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { freshnessIssues, mergeDailyWindow, puzzleIdentity } from './bingo/freshness.ts'
import type { PuzzleIdentity } from './bingo/freshness.ts'

const { values } = parseArgs({ options: { seeds: { type: 'string', default: '12' },
  start: { type: 'string', default: new Date().toISOString().slice(0, 10) }, days: { type: 'string', default: '30' },
  enemies: { type: 'string' }, set: { type: 'string', default: 'fresh' }, publish: { type: 'boolean', default: false }, resume: { type: 'boolean', default: false } } })
assert.ok(['fresh', 'classic'].includes(values.set!))
const profiles = values.set === 'fresh' ? freshProfiles : dailyBingoProfiles()
const theme = (enemy: string, answer: string) => ['FURY', 'RESENT', 'MAD', 'SORE'].includes(enemy)
  ? 'ANGER' : dailyBingoTheme(enemy, answer)
const seeds = Number(values.seeds), days = Number(values.days)
assert.ok(Number.isSafeInteger(seeds) && seeds > 0 && seeds <= 100)
assert.ok(Number.isSafeInteger(days) && days > 0 && days <= 31)
assert.match(values.start!, /^\d{4}-\d{2}-\d{2}$/)
assert.equal(new Date(`${values.start}T00:00:00Z`).toISOString().slice(0, 10), values.start)
const directory = `artifacts/daily-month-${values.start}`
mkdirSync(directory, { recursive: true })
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const existingSchedule = readJson('src/daily/schedule.json')
const history: PuzzleIdentity[] = readJson('scripts/bingo/published-history.json')
// The ledger includes retired previews and replaced dailies. Read the live
// catalogs too so a newly archived puzzle cannot bypass the novelty gate.
for (const entry of [...existingSchedule, ...readJson('src/daily/archive.json')]) {
  const { encounter } = readJson(`public/${entry.asset}`)
  const identity = puzzleIdentity(entry.id, { ...encounter, meaningLexicon: unpackMeaningLexicon(encounter.meaningLexicon) })
  if (!history.some(old => JSON.stringify(old) === JSON.stringify(identity))) history.push(identity)
}
const accepts = (a: ReturnType<typeof analyseBingo>) => a.counterFamilies >= 4 && a.repeatedCounterRoutes >= 4
  && a.resistedFamilies >= 2 && a.sustainedPositions >= 2 && a.sustainedFinalPositions >= 2
const accepted = []
if (values.enemies) assert.ok(values.enemies.toUpperCase().split(',').every(enemy => profiles.some(p => p.enemy === enemy)), 'Enemy needs a pinned candidate profile in the selected set.')
for (const profile of profiles.filter(p => !values.enemies || values.enemies.toUpperCase().split(',').includes(p.enemy))) {
  const id = `${profile.enemy.toLowerCase()}-${profile.bingo.toLowerCase()}`
  const path = `${directory}/${id}.json`
  if (values.resume && existsSync(path)) {
    const old = JSON.parse(readFileSync(path, 'utf8'))
    const data = JSON.parse(readFileSync(`${directory}/${id}.puzzle.json`, 'utf8'))
    const encounter = { ...data.encounter, meaningLexicon: unpackMeaningLexicon(data.encounter.meaningLexicon) }
    assert.equal(encounter.meaningLexicon.profileVersion, bingoProfileVersion(profile), `Stale source profile: ${id}`)
    assert.equal(data.method, 'bingo-first')
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 12)
    assert.equal(old.asset, `puzzles/${id}-${hash}.json`, `Stale puzzle data: ${id}`)
    if (old.accepted) {
      const novelty = freshnessIssues(puzzleIdentity(id, encounter), history)
      if (novelty.length) {
        // A rerun must not overwrite the historical acceptance report for a
        // puzzle that has since been published and entered the ledger.
        console.log(JSON.stringify({ id, skipped: 'Already used', novelty }))
        continue
      }
      old.novelty = novelty
      old.twoWordWin ??= findTwoWordWin(encounter, old.analysis.bingos)
      if (!old.twoWordWin || old.novelty.length) old.accepted = false
      writeFileSync(path, JSON.stringify(old, null, 2) + '\n')
      assert.ok(accepts(old.analysis))
      validateBingo(encounter, profile.bingo, old.analysis)
      if (old.accepted) accepted.push(old)
    }
    continue
  }
  const meanings = createBingoMeanings(profile)
  if (history.some(old => old.bingoFamilies.includes(meanings.meanings[profile.bingo].lemma.toUpperCase()))) {
    console.log(JSON.stringify({ id, skipped: 'Bingo family already used' }))
    continue
  }
  const candidates = []
  function tryPlans(plannedTurns: 2 | 3) {
    for (let seed = 12; seed < 12 + seeds; seed++) {
      const candidate = constructBingo(profile, meanings, seed, plannedTurns)
      const analysis = analyseBingo(candidate.encounter)
      const novelty = freshnessIssues(puzzleIdentity(id, candidate.encounter), history)
      const twoWordWin = accepts(analysis) ? findTwoWordWin(candidate.encounter, analysis.bingos) : null
      candidates.push({ ...candidate, analysis, twoWordWin, novelty })
    }
  }
  tryPlans(3)
  const baseline = [...candidates].sort((a, b) => Number(accepts(b.analysis)) - Number(accepts(a.analysis))
    || b.analysis.score - a.analysis.score)[0]
  if (!accepts(baseline.analysis) || !baseline.twoWordWin) tryPlans(2)
  candidates.sort((a, b) => Number(accepts(b.analysis) && !!b.twoWordWin && !b.novelty.length) - Number(accepts(a.analysis) && !!a.twoWordWin && !a.novelty.length) || b.analysis.score - a.analysis.score)
  const chosen = candidates[0]
  const pass = accepts(chosen.analysis) && !!chosen.twoWordWin && !chosen.novelty.length
  if (pass) validateBingo(chosen.encounter, profile.bingo, chosen.analysis)
  const payload = { version: 1, id, method: 'bingo-first', semanticStatus: 'source-profile',
    encounter: { ...chosen.encounter, meaningLexicon: packMeaningLexicon(chosen.encounter.meaningLexicon!) } }
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
  const report = { id, enemy: profile.enemy, answer: profile.bingo, accepted: pass, seed: chosen.seed,
    score: chosen.analysis.score, analysis: chosen.analysis, twoWordWin: chosen.twoWordWin, roots: profile.roots, novelty: chosen.novelty,
    semanticPolicy: 'Pinned source senses and reviewed lexical families; unlabelled defined senses are neutral. Not a proof of exhaustive contextual semantic coverage.',
    asset: `puzzles/${id}-${hash}.json` }
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n')
  writeFileSync(`${directory}/${id}.puzzle.json`, JSON.stringify(payload) + '\n')
  if (pass) accepted.push(report)
  console.log(JSON.stringify({ id, accepted: pass, score: report.score, routes: chosen.analysis.repeatedCounterRoutes,
    starts: chosen.analysis.counterFamilies, sustained: chosen.analysis.sustainedPositions, finals: chosen.analysis.sustainedFinalPositions }))
}
console.log(`${accepted.length} accepted distinct answers of ${profiles.length} candidates.`)
if (values.publish) {
  assert.ok(accepted.length >= days, `Need ${days} quality-approved puzzles; found ${accepted.length}.`)
  // Keep distinct enemies/answers, and spread semantic themes through the month.
  // ERROR/CORROBORATE is mechanically valid but corroboration need not correct
  // an error, so it is not selected for the published queue.
  const seenEnemies = new Set<string>()
  const pool = accepted.filter(item => {
    if (item.enemy === 'ERROR' || seenEnemies.has(item.enemy)) return false
    seenEnemies.add(item.enemy)
    return true
  }).slice(0, days)
  assert.equal(pool.length, days, 'Need enough distinct, editorially accepted enemies.')
  const totals = new Map<string, number>(), used = new Map<string, number>()
  for (const item of pool) { const key = theme(item.enemy, item.answer); totals.set(key, (totals.get(key) ?? 0) + 1) }
  const chosen = []
  let previousTheme = ''
  while (pool.length) {
    const position = chosen.length
    const ranked = [...pool].sort((a, b) => {
      const priority = (item: typeof a) => {
        const key = theme(item.enemy, item.answer)
        return (position + 1) * totals.get(key)! / days - (used.get(key) ?? 0) - Number(key === previousTheme) * days
      }
      return priority(b) - priority(a)
    })
    const next = position === 0 ? pool[0] : ranked[0]
    chosen.push(next); pool.splice(pool.indexOf(next), 1)
    previousTheme = theme(next.enemy, next.answer)
    used.set(previousTheme, (used.get(previousTheme) ?? 0) + 1)
  }
  assert.equal(new Set(chosen.map(p => p.answer)).size, days)
  const identities = []
  for (const item of chosen) {
    const { encounter } = readJson(`${directory}/${item.id}.puzzle.json`)
    const identity = puzzleIdentity(item.id, { ...encounter, meaningLexicon: unpackMeaningLexicon(encounter.meaningLexicon) })
    assert.deepEqual(freshnessIssues(identity, [...history, ...identities]), [], `Repeated puzzle: ${item.id}`)
    identities.push(identity)
  }
  const guides = readJson('src/daily/guides.json')
  for (const item of chosen) {
    const profile = profiles.find(p => p.enemy === item.enemy && p.bingo === item.answer)!
    const guide = profile.hints.length ? { hints: profile.hints, answer: profile.bingo, explanation: profile.explanation } : guides[item.id]
    assert.ok(guide?.hints.length === 3 && guide.answer === item.answer && guide.explanation, `Missing guide: ${item.id}`)
    guides[item.id] = guide
  }
  const manifest = chosen.map((item, i) => {
    const date = new Date(`${values.start}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + i)
    const data = readFileSync(`${directory}/${item.id}.puzzle.json`, 'utf8')
    mkdirSync('public/puzzles', { recursive: true }); writeFileSync(`public/${item.asset}`, data)
    return { date: date.toISOString().slice(0, 10), id: item.id, enemy: item.enemy, asset: item.asset, method: 'bingo-first', report: `${directory}/${item.id}.json` }
  })
  writeFileSync('scripts/bingo/published-history.json', JSON.stringify([...history, ...identities], null, 2) + '\n')
  writeFileSync('src/daily/guides.json', JSON.stringify(guides, null, 2) + '\n')
  writeFileSync('src/daily/schedule.json', JSON.stringify(mergeDailyWindow(existingSchedule, manifest), null, 2) + '\n')
  writeFileSync(`${directory}/schedule.json`, JSON.stringify(manifest, null, 2) + '\n')
}
