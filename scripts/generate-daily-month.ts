import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { dailyBingoProfiles, dailyBingoTheme } from './bingo/dailyProfiles.ts'
import { createBingoMeanings, bingoProfileVersion } from './bingo/meanings.ts'
import { analyseBingo, constructBingo } from './bingo/generate.ts'
import { findTwoWordWin } from './bingo/twoWordWin.ts'
import { validateBingo } from './bingo/validate.ts'
import { packMeaningLexicon, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'

const { values } = parseArgs({ options: { seeds: { type: 'string', default: '12' },
  start: { type: 'string', default: new Date().toISOString().slice(0, 10) }, days: { type: 'string', default: '30' },
  enemies: { type: 'string' }, publish: { type: 'boolean', default: false }, resume: { type: 'boolean', default: false } } })
const seeds = Number(values.seeds), days = Number(values.days)
assert.ok(Number.isSafeInteger(seeds) && seeds > 0 && seeds <= 100)
assert.ok(Number.isSafeInteger(days) && days > 0 && days <= 31)
assert.match(values.start!, /^\d{4}-\d{2}-\d{2}$/)
assert.equal(new Date(`${values.start}T00:00:00Z`).toISOString().slice(0, 10), values.start)
const directory = `artifacts/daily-month-${values.start}`
mkdirSync(directory, { recursive: true })
const accepts = (a: ReturnType<typeof analyseBingo>) => a.counterFamilies >= 4 && a.repeatedCounterRoutes >= 4
  && a.resistedFamilies >= 2 && a.sustainedPositions >= 2 && a.sustainedFinalPositions >= 2
const accepted = []
if (values.enemies) assert.ok(values.enemies.toUpperCase().split(',').every(enemy => dailyBingoProfiles().some(p => p.enemy === enemy)), 'Enemy needs a pinned candidate profile in scripts/bingo/dailyProfiles.ts.')
for (const profile of dailyBingoProfiles().filter(p => !values.enemies || values.enemies.toUpperCase().split(',').includes(p.enemy))) {
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
      old.twoWordWin ??= findTwoWordWin(encounter, old.analysis.bingos)
      if (!old.twoWordWin) old.accepted = false
      writeFileSync(path, JSON.stringify(old, null, 2) + '\n')
      assert.ok(accepts(old.analysis))
      validateBingo(encounter, profile.bingo, old.analysis)
      if (old.accepted) accepted.push(old)
    }
    continue
  }
  const meanings = createBingoMeanings(profile)
  const candidates = []
  function tryPlans(plannedTurns: 2 | 3) {
    for (let seed = 12; seed < 12 + seeds; seed++) {
      const candidate = constructBingo(profile, meanings, seed, plannedTurns)
      const analysis = analyseBingo(candidate.encounter)
      const twoWordWin = accepts(analysis) ? findTwoWordWin(candidate.encounter, analysis.bingos) : null
      candidates.push({ ...candidate, analysis, twoWordWin })
    }
  }
  tryPlans(3)
  const baseline = [...candidates].sort((a, b) => Number(accepts(b.analysis)) - Number(accepts(a.analysis))
    || b.analysis.score - a.analysis.score)[0]
  if (!accepts(baseline.analysis) || !baseline.twoWordWin) tryPlans(2)
  candidates.sort((a, b) => Number(accepts(b.analysis) && !!b.twoWordWin) - Number(accepts(a.analysis) && !!a.twoWordWin) || b.analysis.score - a.analysis.score)
  const chosen = candidates[0]
  const pass = accepts(chosen.analysis) && !!chosen.twoWordWin
  if (pass) validateBingo(chosen.encounter, profile.bingo, chosen.analysis)
  const payload = { version: 1, id, method: 'bingo-first', semanticStatus: 'source-profile',
    encounter: { ...chosen.encounter, meaningLexicon: packMeaningLexicon(chosen.encounter.meaningLexicon!) } }
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
  const report = { id, enemy: profile.enemy, answer: profile.bingo, accepted: pass, seed: chosen.seed,
    score: chosen.analysis.score, analysis: chosen.analysis, twoWordWin: chosen.twoWordWin, roots: profile.roots,
    semanticPolicy: 'Pinned source senses and reviewed lexical families; unlabelled defined senses are neutral. Not a proof of exhaustive contextual semantic coverage.',
    asset: `puzzles/${id}-${hash}.json` }
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n')
  writeFileSync(`${directory}/${id}.puzzle.json`, JSON.stringify(payload) + '\n')
  if (pass) accepted.push(report)
  console.log(JSON.stringify({ id, accepted: pass, score: report.score, routes: chosen.analysis.repeatedCounterRoutes,
    starts: chosen.analysis.counterFamilies, sustained: chosen.analysis.sustainedPositions, finals: chosen.analysis.sustainedFinalPositions }))
}
console.log(`${accepted.length} accepted distinct answers of ${dailyBingoProfiles().length} candidates.`)
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
  for (const item of pool) { const theme = dailyBingoTheme(item.enemy, item.answer); totals.set(theme, (totals.get(theme) ?? 0) + 1) }
  const chosen = []
  let previousTheme = ''
  while (pool.length) {
    const position = chosen.length
    const ranked = [...pool].sort((a, b) => {
      const priority = (item: typeof a) => {
        const theme = dailyBingoTheme(item.enemy, item.answer)
        return (position + 1) * totals.get(theme)! / days - (used.get(theme) ?? 0) - Number(theme === previousTheme) * days
      }
      return priority(b) - priority(a)
    })
    const next = position === 0 ? pool[0] : ranked[0]
    chosen.push(next); pool.splice(pool.indexOf(next), 1)
    previousTheme = dailyBingoTheme(next.enemy, next.answer)
    used.set(previousTheme, (used.get(previousTheme) ?? 0) + 1)
  }
  assert.equal(new Set(chosen.map(p => p.answer)).size, days)
  const manifest = chosen.map((item, i) => {
    const date = new Date(`${values.start}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + i)
    const data = readFileSync(`${directory}/${item.id}.puzzle.json`, 'utf8')
    mkdirSync('public/puzzles', { recursive: true }); writeFileSync(`public/${item.asset}`, data)
    return { date: date.toISOString().slice(0, 10), id: item.id, enemy: item.enemy, asset: item.asset, method: 'bingo-first' }
  })
  writeFileSync('src/daily/schedule.json', JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(`${directory}/schedule.json`, JSON.stringify(manifest, null, 2) + '\n')
}
