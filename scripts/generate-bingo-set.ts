/** Reproducible bingo-first batch authoring; only exports isolated beta puzzles. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { bingoProfiles, createBingoMeanings } from './bingo/meanings.ts'
import { analyseBingo, bingoArmour, constructBingo } from './bingo/generate.ts'
import { validateBingo } from './bingo/validate.ts'
import { canSpell } from '../src/generator/constructBoard.ts'
import { packMeaningLexicon } from '../src/game/meaningPacking.ts'

const { values } = parseArgs({ options: { enemies: { type: 'string' }, seeds: { type: 'string', default: '12' },
  output: { type: 'string', default: 'artifacts/bingo-first-new-enemies-2026-09-26' }, export: { type: 'boolean', default: false } } })
const seeds = Number(values.seeds)
assert.ok(Number.isSafeInteger(seeds) && seeds > 0 && seeds <= 100)
const requested = values.enemies?.toUpperCase().split(',') ?? bingoProfiles.map(p => p.enemy)
assert.ok(requested.every(enemy => bingoProfiles.some(p => p.enemy === enemy)), 'Enemy needs a reviewed source profile in scripts/bingo/profiles.json.')
mkdirSync(values.output!, { recursive: true })
const reports = []
const exports: { asset: string; payload: string }[] = []
const manifest = JSON.parse(readFileSync('src/experimental/bingo/catalog.json', 'utf8'))
const guidePath = 'src/experimental/bingo/guides.json'
let guides: Record<string, unknown> = {}
try { guides = JSON.parse(readFileSync(guidePath, 'utf8')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
for (const profile of bingoProfiles.filter(p => requested.includes(p.enemy))) {
  const meanings = createBingoMeanings(profile)
  const inventory = meanings.relations.opposite.filter(word => word.length <= 16 && canSpell(profile.enemy, [...word]))
    .map(word => ({ word, armour: bingoArmour(profile.enemy, word).filter(l => l.initialHits === 2).map(l => l.letter),
      definition: meanings.meanings[word].definition }))
  const candidates = []
  for (let index = 0; index < seeds; index++) {
    const candidate = constructBingo(profile, meanings, index)
    const analysis = analyseBingo(candidate.encounter)
    candidates.push({ ...candidate, analysis })
    console.log(JSON.stringify({ enemy: profile.enemy, seed: index, ...Object.fromEntries(Object.entries(analysis).filter(([key]) => key !== 'routes')) }))
  }
  const accepts = (analysis: ReturnType<typeof analyseBingo>) => analysis.counterFamilies >= 4
    && analysis.repeatedCounterRoutes >= 4 && analysis.resistedFamilies >= 2
    && analysis.sustainedPositions >= 2 && analysis.sustainedFinalPositions >= 2
  candidates.sort((a, b) => Number(accepts(b.analysis)) - Number(accepts(a.analysis))
    || b.analysis.score - a.analysis.score || a.seed.localeCompare(b.seed))
  const selected = candidates[0]
  assert.ok(selected.analysis.bingos.includes(profile.bingo))
  const { encounter, ...description } = selected
  const report = { enemy: profile.enemy, bingo: profile.bingo, method: 'bingo-first', semanticStatus: 'draft-source-profile', accepted: accepts(selected.analysis),
    ...description, board: encounter.startingTiles.map(t => t.letter).join(''), refills: encounter.refillQueue,
    inventory, seeds: candidates.map(c => ({ seed: c.seed, score: c.analysis.score })),
    derivations: meanings.derivations,
    meaningWords: Object.keys(encounter.meaningLexicon!.words).length,
    limitation: 'Source-pinned roots, all-sense exact-synset expansion, one direct derivation, and explicit adjective/adverb links. Other defined words are neutral under this beta policy; complete contextual review and daily certification are outstanding.' }
  reports.push(report)
  writeFileSync(`${values.output}/${profile.enemy.toLowerCase()}.json`, JSON.stringify(report, null, 2) + '\n')
  if (values.export) {
    assert.ok(report.accepted, `${profile.enemy} lacks enough sustained semantic routes; inspect the report before exporting.`)
    validateBingo(encounter, profile.bingo, selected.analysis)
    const id = `bingo-${profile.enemy.toLowerCase()}-1`
    const payload = JSON.stringify({ version: 1, id, semanticStatus: 'draft', encounter: { ...encounter,
      meaningLexicon: packMeaningLexicon(encounter.meaningLexicon!) } }) + '\n'
    const digest = createHash('sha256').update(payload).digest('hex').slice(0, 12)
    const asset = `previews/bingo/${profile.enemy.toLowerCase()}-1-${digest}.json`
    exports.push({ asset, payload })
    const entry = { id, title: profile.enemy, enemy: profile.enemy,
      enemyHP: encounter.enemyLetters.reduce((sum, l) => sum + l.initialHits, 0), asset, collection: 'new' }
    const existing = manifest.findIndex((e: { id: string }) => e.id === id)
    if (existing >= 0) manifest[existing] = entry
    else manifest.push(entry)
    guides[id] = { hints: profile.hints, answer: profile.bingo, explanation: profile.explanation }
  }
}
if (values.export) {
  for (const { asset, payload } of exports) writeFileSync(`public/${asset}`, payload)
  writeFileSync('src/experimental/bingo/catalog.json', JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(guidePath, JSON.stringify(guides, null, 2) + '\n')
}
console.log(`Assessed ${reports.length} enemies using bingo-first construction${values.export ? '; exported to beta' : ''}.`)
