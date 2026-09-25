import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { packMeaningRevision, unpackMeaningRevision } from '../src/game/meaningRevision.ts'
import { dailyEncounter20260925V10 } from '../src/daily/catalog.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { isMeaningCompilationCurrent } from '../src/generator/meaningCompiler.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'

const input = process.argv[2]
if (!input) throw new Error('Pass the fully reviewed selected JSON file.')
const artifactDirectory = 'artifacts/meaning-v2'
const selected = JSON.parse(readFileSync(input, 'utf8')) as RankedCandidate
const encounter = selected.candidate.encounter
assert.equal(selected.validation.accepted, true)
assert.ok(isMeaningCompilationCurrent(encounter))
assert.ok(selected.analysis.openingSafety)
assert.equal(selected.analysis.openingSafety.enumeration.vocabularyComplete, true)
assert.ok(isOpeningSafetyCertificateCurrent(encounter, selected.analysis.openingSafety))
const { meaningLexicon, ...rules } = encounter
assert.ok(meaningLexicon)
const revision = packMeaningRevision(dailyEncounter20260925V10, meaningLexicon)
assert.equal(JSON.stringify(unpackMeaningRevision(dailyEncounter20260925V10, revision.meaningBase, revision.packedMeanings)), JSON.stringify(meaningLexicon))
mkdirSync(artifactDirectory, { recursive: true })
writeFileSync('src/daily/puzzles/2026-09-25-v11.json', JSON.stringify({ ...rules, ...revision }) + '\n')
writeFileSync(`${artifactDirectory}/selected.json.gz`, gzipSync(JSON.stringify(selected), { level: 9 }))
const { openingSafety, ...reviewAnalysis } = selected.analysis
const { encounter: _encounter, ...candidateMetadata } = selected.candidate
writeFileSync('src/generator/data/meaning-review.json', JSON.stringify({ ...selected, candidate: candidateMetadata,
  analysis: { ...reviewAnalysis, notes: [...reviewAnalysis.notes,
    `Full dictionary opening certificate: ${openingSafety.safeSelections} / ${openingSafety.enumeration.requiredSelections} physical choices recover with familiar words. Offline proof: ${artifactDirectory}/selected.json.gz.`] } }, null, 2) + '\n')
const words = ['CLEAR,SORT,HARMONY', 'CARE,SORT,HARMONY,NEAT', 'REACH,SORT,ANGER,SYSTEM,CHAIN', 'CHARM,SORT,ANGER,SYSTEM,HAND,CAT']
const archivedWalkthroughs = JSON.parse(readFileSync('artifacts/meaning-v1/walkthroughs.json', 'utf8')) as {
  routes: { words: string[]; tileIds: number[][] }[]
}
const routes = words.map(wanted => {
  const measured = selected.analysis.winningLines.find(line => line.moves.map(move => move.word).join(',') === wanted)
  const previous = archivedWalkthroughs.routes.find(route => route.words.join(',') === wanted)
  // An unchanged example may fall outside the analyzer's retained-line budget.
  // Replaying its physical choices below verifies it against the new rules.
  const line = measured ?? (previous && { moves: previous.words.map((word, index) => ({ word, tileIds: previous.tileIds[index] })) })
  assert.ok(line, `Missing walkthrough ${wanted}`)
  let state = createLetterStrikeGame(encounter)
  const turns = line.moves.map(move => {
    state = submitLetterStrike(state, move.tileIds)
    assert.equal(state.error, null)
    const preview = state.playedWords.at(-1)!.preview
    return { word: move.word, tileIds: move.tileIds, meaning: preview.semanticLabel, hits: preview.strikes,
      lives: state.playerResolve, refills: encounter.refillQueue.length - state.refillIndex,
      activeTiles: state.tiles.filter(tile => tile.letter).length,
      recovery: preview.recoveries ?? [] }
  })
  assert.equal(state.status, 'won')
  return { words: line.moves.map(move => move.word), tileIds: line.moves.map(move => move.tileIds),
    livesRemaining: state.playerResolve, turns }
})
writeFileSync(`${artifactDirectory}/walkthroughs.json`, JSON.stringify({ candidateId: encounter.id, routes }, null, 2) + '\n')
const summary = { candidateId: encounter.id, seed: selected.candidate.seed, enemy: encounter.enemy.word,
  refills: encounter.refillQueue.length, dictionaryWords: Object.keys(meaningLexicon.words).length,
  openingWords: selected.analysis.lexicalAudit?.opening.words, openingSelections: openingSafety.safeSelections,
  openingSuccessors: openingSafety.safeSuccessors, openingScope: openingSafety.scope,
  vocabularyScope: openingSafety.openingVocabulary.scope, accepted: selected.validation.accepted,
  quality: selected.quality.total, difficulty: selected.difficulty,
  reducedBoardWins: selected.analysis.refillPressure?.winsOnReducedBoard,
  semanticImportance: selected.analysis.semanticMechanicImportance, reviveImportance: selected.analysis.regenImportance,
  limitations: selected.validation.warnings }
writeFileSync(`${artifactDirectory}/summary.json`, JSON.stringify(summary, null, 2) + '\n')
for (const path of ['src/daily/difficultyLabels.json', 'src/generator/data/daily-difficulty.json']) {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  data[encounter.id] = path.includes('difficultyLabels') ? selected.difficulty!.label : selected.difficulty
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}
console.log(JSON.stringify(summary, null, 2))
