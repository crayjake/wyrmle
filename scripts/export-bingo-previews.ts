/** Freeze the assessed boards for static production previews; never publish a daily. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { packMeaningLexicon, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { meaningLexicalProvider, withCompiledMeanings } from '../src/generator/meaningCompiler.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'

const source = 'artifacts/bingo-feasibility-2026-09-26/candidates.json'
type Candidate = { enemy: string; bingo: string; seed: string; board: string; refills: string; armour: string[];
  enemyHP: number; meaningWords: number; analysis: { rootReports: { witness: null | {
    words: string[]; tileIds: number[][]; labels: string[]; hits: number[];
  } }[] } }
const candidates = JSON.parse(readFileSync(source, 'utf8')) as Candidate[]
const counts = new Map<string, number>()
const manifest = []
mkdirSync('public/previews/bingo', { recursive: true })
for (const candidate of candidates) {
  const ordinal = (counts.get(candidate.enemy) ?? 0) + 1
  counts.set(candidate.enemy, ordinal)
  const slug = `${candidate.enemy.toLowerCase()}-${ordinal}`
  const id = `bingo-${slug}`
  const enemy = meaningLexicalProvider.getEntry(candidate.enemy)!
  const remainingArmour = [...candidate.armour]
  const encounter = withCompiledMeanings({
    id: candidate.seed,
    enemy: { word: candidate.enemy, definition: enemy.definition, partOfSpeech: enemy.partsOfSpeech[0],
      semanticRelations: { opposite: [], similar: [], related: [] } },
    enemyLetters: [...candidate.enemy].map((letter, index) => {
      const slot = remainingArmour.indexOf(letter)
      const hits = slot >= 0 ? 2 : 1
      if (slot >= 0) remainingArmour.splice(slot, 1)
      return { id: `enemy-${index}`, letter, initialHits: hits, hitsRemaining: hits }
    }),
    startingTiles: [...candidate.board].map((letter, id) => ({ id, letter, type: 'normal' })),
    startingResolve: 3, refillQueue: candidate.refills, finiteRefills: true, minimumWordLength: 3,
    grammarModifiers: {}, tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true } },
  })
  assert.equal(remainingArmour.length, 0)
  assert.equal(Object.keys(encounter.meaningLexicon!.words).length, candidate.meaningWords)
  assert.equal(encounter.enemyLetters.reduce((sum, letter) => sum + letter.initialHits, 0), candidate.enemyHP)
  const { meaningLexicon, ...physical } = encounter
  const packed = packMeaningLexicon(meaningLexicon!)
  assert.deepEqual(unpackMeaningLexicon(packed), meaningLexicon)
  // Replay the original assessed witnesses before freezing the payload. Fail if
  // changes to cached meanings no longer support the report's exact outcomes.
  for (const lives of [3, 4, 5]) {
    const initial = createLetterStrikeGame({ ...encounter, startingResolve: lives })
    const bingoIds = selectWordIds(initial.tiles, candidate.bingo)
    assert.ok(bingoIds)
    assert.equal(submitLetterStrike(initial, bingoIds).status, 'won')
    for (const { witness } of candidate.analysis.rootReports) {
      if (!witness || witness.words.length > lives) continue
      let state = initial
      for (const [index, ids] of witness.tileIds.entries()) {
        state = submitLetterStrike(state, ids)
        assert.equal(state.error, null)
        const move = state.playedWords.at(-1)!
        assert.equal(move.word, witness.words[index])
        assert.equal(move.semanticLabel, witness.labels[index])
        assert.equal(move.strikes, witness.hits[index])
      }
      assert.equal(state.status, 'won')
    }
  }
  const payload = JSON.stringify({ version: 1, id, semanticStatus: 'draft', encounter: { ...physical, meaningLexicon: packed } }) + '\n'
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 12)
  const asset = `previews/bingo/${slug}-${digest}.json`
  writeFileSync(`public/${asset}`, payload)
  manifest.push({ id, title: `${candidate.enemy} ${ordinal}`, enemy: candidate.enemy, enemyHP: candidate.enemyHP, asset })
  console.log(`${id}: ${Math.round(Buffer.byteLength(payload) / 1024)} KB`)
}
// Re-exporting the original study must not remove later bingo-first batches.
const prior = JSON.parse(readFileSync('src/experimental/bingo/catalog.json', 'utf8')) as { id: string }[]
const exportedIds = new Set(manifest.map(entry => entry.id))
writeFileSync('src/experimental/bingo/catalog.json', JSON.stringify([...manifest, ...prior.filter(entry => !exportedIds.has(entry.id))], null, 2) + '\n')
console.log(`Exported ${manifest.length} draft previews; daily catalog unchanged.`)
