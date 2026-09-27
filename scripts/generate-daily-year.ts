import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { shiftPuzzleId } from '../src/daily/date.ts'
import { yearThemes, yearProfile, retargetYearMeanings } from './bingo/year/profiles.ts'
import type { YearCandidate } from './bingo/year/profiles.ts'
import { createBingoMeanings, bingoProfileVersion } from './bingo/meanings.ts'
import { constructBingo, analyseBingo } from './bingo/generate.ts'
import { findTwoWordWin } from './bingo/twoWordWin.ts'
import { validateBingo } from './bingo/validate.ts'
import { packDictionaryMeanings, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { publishBatch } from './bingo/year/publish.ts'
import { puzzleIdentity, freshnessIssues } from './bingo/freshness.ts'
import { assessProgressionV3 } from './bingo/progressionV3.ts'

const { values } = parseArgs({ options: {
  directory: { type: 'string' },
  start: { type: 'string' }, days: { type: 'string', default: '366' },
  'publish-only': { type: 'boolean', default: false },
  seeds: { type: 'string', default: '12' }, shard: { type: 'string', default: '0/1' }, enemies: { type: 'string' },
  limit: { type: 'string', default: '10000' }, themes: { type: 'string' }, resume: { type: 'boolean', default: false },
} })
const seeds = Number(values.seeds), limit = Number(values.limit), [shard, count] = values.shard!.split('/').map(Number)
assert.ok(Number.isSafeInteger(seeds) && seeds > 0 && seeds <= 100)
assert.ok(Number.isSafeInteger(limit) && limit > 0)
assert.ok(Number.isSafeInteger(shard) && Number.isSafeInteger(count) && count > shard && shard >= 0)
const start = values.start ?? shiftPuzzleId(JSON.parse(readFileSync('src/daily/schedule.json', 'utf8')).at(-1).date, 1)
const directory = values.directory ?? `artifacts/daily-year-${start}`
if (values['publish-only']) { publishBatch(directory, start, Number(values.days)); process.exit(0) }
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
assert.ok(existsSync(`${directory}/candidates.json`), `Discover candidates first: npm run discover:batch -- --directory ${directory}`)
const candidates: YearCandidate[] = read(`${directory}/candidates.json`)
const requestedEnemies = values.enemies?.toUpperCase().split(',')
if (requestedEnemies) assert.ok(requestedEnemies.every(enemy => candidates.some(c => c.enemy === enemy)),
  'Requested enemy has no discovered bingo-first candidate in this directory.')
const history = read('scripts/bingo/published-history.json')
const accepts = (a: ReturnType<typeof analyseBingo>) => a.counterFamilies >= 4 && a.repeatedCounterRoutes >= 4
  && a.resistedFamilies >= 2 && a.sustainedPositions >= 2 && a.sustainedFinalPositions >= 2
mkdirSync(`${directory}/reports`, { recursive: true }); mkdirSync(`${directory}/payloads`, { recursive: true })
let tried = 0
for (const [themeIndex, theme] of yearThemes.entries()) {
  if (themeIndex % count !== shard || values.themes && !values.themes.split(',').includes(theme.id)) continue
  for (const side of [0, 1] as const) {
    const pool = candidates.filter(c => c.theme === theme.id && c.side === side && (!requestedEnemies || requestedEnemies.includes(c.enemy)))
    if (!pool.length) continue
    const base = createBingoMeanings(yearProfile(theme, side))
    const finished = new Set<string>()
    for (const candidate of pool) {
      const pair = `${candidate.enemy}:${candidate.bingoLemma}`
      if (finished.has(pair)) continue
      const profile = yearProfile(theme, side, candidate)
      const profileVersion = bingoProfileVersion(profile)
      const id = `${theme.id}-${side}-${candidate.enemy.toLowerCase()}-${candidate.bingo.toLowerCase()}`
      const path = `${directory}/reports/${id}.json`, payloadPath = `${directory}/payloads/${id}.puzzle.json`
      if (values.resume && existsSync(path)) {
        const old = read(path)
        if (old.generatorVersion === 3 && old.profileVersion === profileVersion && (old.accepted || old.seeds >= seeds)) {
          if (old.accepted) { assert.ok(existsSync(payloadPath)); finished.add(pair) }
          continue
        }
      }
      if (tried++ >= limit) process.exit(0)
      const meanings = retargetYearMeanings(profile, base)
      const options = []
      for (const plannedTurns of [3, 2] as const) {
        for (let seed = 12; seed < 12 + seeds; seed++) {
          const constructed = constructBingo(profile, meanings, seed, plannedTurns)
          const analysis = analyseBingo(constructed.encounter)
          const identity = puzzleIdentity(id, constructed.encounter)
          const novelty = freshnessIssues(identity, history)
          const twoWordWin = accepts(analysis) && !novelty.length ? findTwoWordWin(constructed.encounter, analysis.bingos) : null
          const progression = twoWordWin ? assessProgressionV3(constructed.encounter) : null
          const accepted = accepts(analysis) && !!progression?.accepted && !novelty.length
          options.push({ ...constructed, analysis, identity, novelty, twoWordWin: progression?.twoWordRoute.witness ?? twoWordWin, progression, accepted })
        }
        if (options.some(o => o.accepted)) break
      }
      options.sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.analysis.score - a.analysis.score)
      const chosen = options[0]
      let asset: string | null = null
      if (chosen.accepted) {
        const packed = packDictionaryMeanings(chosen.encounter.meaningLexicon!)
        const restored = { ...chosen.encounter, meaningLexicon: unpackMeaningLexicon(packed) }
        for (const word of Object.keys(chosen.encounter.meaningLexicon!.words)) {
          assert.deepEqual(restored.meaningLexicon.words[word], chosen.encounter.meaningLexicon!.words[word], word)
        }
        validateBingo(restored, candidate.bingo, chosen.analysis)
        const payload = { version: 1, id, method: 'bingo-first', semanticStatus: 'source-profile',
          encounter: { ...chosen.encounter, meaningLexicon: packed } }
        const bytes = JSON.stringify(payload)
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
        asset = `puzzles/${id}-${hash}.json`
        writeFileSync(payloadPath, bytes)
        finished.add(pair)
      }
      const report = { id, ...candidate, answer: candidate.bingo, method: 'bingo-first', generatorVersion: 3, accepted: chosen.accepted,
        profileVersion, seeds, seed: chosen.seed, score: chosen.analysis.score, analysis: chosen.analysis,
        twoWordWin: chosen.twoWordWin, progression: chosen.progression, identity: chosen.identity, novelty: chosen.novelty, asset,
        publicationStatus: chosen.accepted ? 'needs-semantic-review' : 'rejected',
        semanticPolicy: 'Source-pinned concept pools with individually reviewed senses and lexical families. Unlabelled defined senses remain neutral; this is not an exhaustive contextual semantic proof.' }
      writeFileSync(path, JSON.stringify(report, null, 2) + '\n')
      console.log(JSON.stringify({ id, accepted: chosen.accepted, score: chosen.analysis.score,
        starts: chosen.analysis.counterFamilies, routes: chosen.analysis.repeatedCounterRoutes,
        sustained: chosen.analysis.sustainedPositions, finals: chosen.analysis.sustainedFinalPositions,
        novelty: chosen.novelty.slice(0, 1), progressionIssues: chosen.progression?.issues ?? [] }))
    }
  }
}
