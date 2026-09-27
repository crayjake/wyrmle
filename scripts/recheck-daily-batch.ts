import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { yearThemes, yearProfile, retargetYearMeanings } from './bingo/year/profiles.ts'
import { createBingoMeanings, bingoProfileVersion } from './bingo/meanings.ts'
import { analyseBingo } from './bingo/generate.ts'
import { findTwoWordWin } from './bingo/twoWordWin.ts'
import { validateBingo } from './bingo/validate.ts'
import { packDictionaryMeanings, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { freshnessIssues, puzzleIdentity } from './bingo/freshness.ts'

const { values } = parseArgs({ options: { directory: { type: 'string', default: 'artifacts/daily-year-2026-10-26' } } })
const directory = values.directory!, read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const history = read('scripts/bingo/published-history.json'), bases = new Map()
for (const id of read(`${directory}/editorial-shortlist.json`)) {
  const report = read(`${directory}/reports/${id}.json`), payload = read(`${directory}/payloads/${id}.puzzle.json`)
  const theme = yearThemes.find(t => t.id === report.theme)!, key = `${theme.id}:${report.side}`
  const profile = yearProfile(theme, report.side, report)
  if (!bases.has(key)) bases.set(key, createBingoMeanings(yearProfile(theme, report.side)))
  const meanings = retargetYearMeanings(profile, bases.get(key))
  const encounter = meanings.compile({ ...payload.encounter, meaningLexicon: undefined })
  const analysis = analyseBingo(encounter), twoWordWin = findTwoWordWin(encounter, analysis.bingos)
  const identity = puzzleIdentity(id, encounter), novelty = freshnessIssues(identity, history)
  const accepted = analysis.counterFamilies >= 4 && analysis.repeatedCounterRoutes >= 4 && analysis.resistedFamilies >= 2
    && analysis.sustainedPositions >= 2 && analysis.sustainedFinalPositions >= 2 && !!twoWordWin && !novelty.length
  const packed = packDictionaryMeanings(encounter.meaningLexicon!)
  if (accepted) {
    assert.deepEqual(unpackMeaningLexicon(packed), encounter.meaningLexicon)
    validateBingo(encounter, report.answer, analysis)
  }
  const bytes = JSON.stringify({ ...payload, encounter: { ...encounter, meaningLexicon: packed } })
  const asset = `puzzles/${id}-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.json`
  const updated = { ...report, accepted, profileVersion: bingoProfileVersion(profile), analysis, twoWordWin,
    score: analysis.score, identity, novelty, asset, editorialReview: 'Enemy/bingo relationship and opening non-neutral meanings reviewed; homograph forms corrected and obvious concept words added. Existing board and refills preserved, all quality gates rerun.' }
  writeFileSync(`${directory}/payloads/${id}.puzzle.json`, bytes)
  writeFileSync(`${directory}/reports/${id}.json`, JSON.stringify(updated, null, 2)+'\n')
  console.log(JSON.stringify({ id, accepted, counters: analysis.counterFamilies, routes: analysis.repeatedCounterRoutes, sustained: analysis.sustainedPositions, finals: analysis.sustainedFinalPositions, twoWordWin: twoWordWin?.words, novelty }))
}
