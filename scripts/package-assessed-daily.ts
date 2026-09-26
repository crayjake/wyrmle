import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { MEANING_ASSESSMENT_PACKING_VERSION, packMeaningLexicon, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { discoverValidMoves } from '../src/generator/findMoves.ts'
import { getGenerationWordCommonness, GENERATION_COMMONNESS_SOURCE } from '../src/generator/familiarity.ts'
import { isMeaningCompilationCurrent, assertMeaningPublicationReady } from '../src/generator/meaningCompiler.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'
import { assertSemanticQualityForPublication } from './lib/semanticQuality.ts'
import { analyseSemanticChoices } from '../src/generator/semanticChoices.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { assessedPublicationGates } from './lib/publicationGates.ts'

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/package-assessed-daily.ts <reviewed-selected.json> [puzzle-version] [artifact-directory]')
const puzzleVersion = Number(process.argv[3] ?? 12)
assert.ok(Number.isSafeInteger(puzzleVersion) && puzzleVersion >= 12)
const artifactDirectory = process.argv[4] ?? (puzzleVersion === 12 ? 'artifacts/meaning-v3' : `artifacts/meaning-v${puzzleVersion}`)
const selected = JSON.parse(readFileSync(input, 'utf8')) as RankedCandidate
const encounter = selected.candidate.encounter
assert.equal(encounter.id, `daily-chaos-2026-09-26-v${puzzleVersion}`)
assertMeaningPublicationReady(encounter)
const semanticQuality = assertSemanticQualityForPublication()
const choices = analyseSemanticChoices(encounter, selected.analysis.winningLines)
assert.deepEqual(selected.analysis.semanticChoices, choices, 'Review must contain a current replayed counter-choice audit.')
const validation = validatePuzzle(selected.candidate, selected.analysis, assessedPublicationGates)
assert.ok(validation.accepted, validation.reasons.map(reason => reason.message).join('\n'))
assert.equal(selected.validation.accepted, true, 'The selected candidate must pass validation.')
assert.ok(selected.difficulty, 'Publication requires a measured difficulty rating.')
assert.ok(isMeaningCompilationCurrent(encounter), 'Recompile against the complete current assessment cache before publication.')
const { meaningLexicon, ...rules } = encounter
assert.ok(meaningLexicon?.assessment, 'Publication requires model metadata and evidence for all accepted words.')
const packedMeanings = packMeaningLexicon(meaningLexicon)
assert.equal(packedMeanings.packingVersion, MEANING_ASSESSMENT_PACKING_VERSION)
assert.equal(JSON.stringify({ ...rules, meaningLexicon: unpackMeaningLexicon(packedMeanings) }), JSON.stringify(encounter),
  'Publication packing must preserve the exact reviewed encounter and certificate fingerprint.')

const { openingSafety, ...reviewAnalysis } = selected.analysis
assert.ok(openingSafety && isOpeningSafetyCertificateCurrent(encounter, openingSafety))
assert.equal(openingSafety.scope, 'all-valid-openings')
assert.equal(openingSafety.openingVocabulary.scope, 'full-dictionary')
assert.equal(openingSafety.enumeration.vocabularyComplete, true)
assert.equal(openingSafety.familiarity.required, true)
assert.equal(openingSafety.familiarity.source, GENERATION_COMMONNESS_SOURCE)

// A certificate hash binds the data; replay independently proves its claims.
const initial = createLetterStrikeGame(encounter)
const discovered = discoverValidMoves(initial)
assert.equal(discovered.complete, true)
assert.equal(discovered.vocabularyComplete, true)
const openingKey = (word: string, tileIds: readonly number[]) => `${word}:${tileIds.join(',')}`
const requiredOpenings = new Set(discovered.moves.map(move => openingKey(move.word, move.tileIds)))
const replayedOpenings = new Set<string>()
for (const result of openingSafety.results) for (const opening of result.openings) {
  const key = openingKey(opening.word, opening.tileIds)
  assert.equal(replayedOpenings.has(key), false, `Duplicate opening certificate entry: ${key}`)
  replayedOpenings.add(key)
  let state = submitLetterStrike(initial, opening.tileIds)
  assert.equal(state.error, null, key)
  assert.equal(state.playedWords.at(-1)!.word, opening.word)
  for (const move of result.continuation!) {
    assert.ok((getGenerationWordCommonness(move.word) ?? -1) >= openingSafety.familiarity.minimum,
      `Continuation word ${move.word} does not meet the declared familiarity requirement.`)
    state = submitLetterStrike(state, move.tileIds)
    assert.equal(state.error, null, `${opening.word} → ${move.word}`)
    assert.equal(state.playedWords.at(-1)!.word, move.word)
  }
  assert.equal(state.status, 'won', `Opening ${key} has no replayable winning continuation.`)
}
assert.deepEqual(replayedOpenings, requiredOpenings, 'Certificate must cover every physical legal opening exactly once.')

assert.ok(selected.analysis.winningLines.length, 'Publication needs replayable walkthroughs.')
const routes = selected.analysis.winningLines.map(line => {
  let state = createLetterStrikeGame(encounter)
  const turns = line.moves.map(move => {
    state = submitLetterStrike(state, move.tileIds)
    assert.equal(state.error, null, move.word)
    const preview = state.playedWords.at(-1)!.preview
    assert.equal(preview.word, move.word)
    assert.equal(preview.strikes, move.strikes)
    assert.equal(preview.semanticLabel, move.semanticLabel)
    const meaning = meaningLexicon.words[move.word]
    return { word: move.word, tileIds: move.tileIds, meaning: preview.semanticLabel, hits: preview.strikes,
      lives: state.playerResolve, refills: encounter.refillQueue.length - state.refillIndex,
      activeTiles: state.tiles.filter(tile => tile.letter).length,
      recovery: preview.recoveries ?? [], senseId: meaning.senseId, assessment: meaning.assessment }
  })
  assert.equal(state.status, 'won')
  assert.equal(state.playerResolve, line.resolveRemaining)
  return { words: line.moves.map(move => move.word), tileIds: line.moves.map(move => move.tileIds),
    livesRemaining: state.playerResolve, turns }
})

const summary = { puzzleDate: '2026-09-26', puzzleDates: ['2026-09-26', '2026-09-27'], puzzleVersion,
  candidateId: encounter.id, seed: selected.candidate.seed, enemy: encounter.enemy.word,
  assessment: meaningLexicon.assessment,
  semanticQualityConfiguration: semanticQuality.configurationHash, choices,
  refills: encounter.refillQueue.length, dictionaryWords: Object.keys(meaningLexicon.words).length,
  openingWords: new Set(discovered.moves.map(move => move.word)).size,
  openingSelections: openingSafety.safeSelections, openingSuccessors: openingSafety.safeSuccessors,
  familiarity: openingSafety.familiarity, openingScope: openingSafety.scope, vocabularyScope: openingSafety.openingVocabulary.scope,
  accepted: selected.validation.accepted, quality: selected.quality.total, difficulty: selected.difficulty,
  reducedBoardWins: selected.analysis.refillPressure?.winsOnReducedBoard,
  semanticImportance: selected.analysis.semanticMechanicImportance, reviveImportance: selected.analysis.regenImportance,
  walkthroughs: routes.length, fewestRetainedWords: Math.min(...routes.map(route => route.words.length)),
  mostRetainedWords: Math.max(...routes.map(route => route.words.length)),
  finalLifeWalkthroughs: routes.filter(route => (route.turns.at(-2)?.lives ?? encounter.startingResolve) === 1).length,
  limitations: selected.validation.warnings }
const { encounter: _encounter, ...candidateMetadata } = selected.candidate
const review = { ...selected, candidate: candidateMetadata,
  analysis: { ...reviewAnalysis, notes: [...reviewAnalysis.notes,
    `Model-assessed meanings for all ${Object.keys(meaningLexicon.words).length} playable supply spellings.`,
    `Full dictionary opening certificate: ${openingSafety.safeSelections} / ${openingSafety.enumeration.requiredSelections} physical choices recover with familiar words. Offline proof: ${artifactDirectory}/selected.json.gz.`] } }
const difficultyUpdates = ['src/daily/difficultyLabels.json', 'src/generator/data/daily-difficulty.json'].map(path => {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  data[encounter.id] = path.includes('difficultyLabels') ? selected.difficulty!.label : selected.difficulty
  return { path, data }
})

// All checks and replays complete before replacing any publication files.
mkdirSync(artifactDirectory, { recursive: true })
writeFileSync(`src/daily/puzzles/2026-09-26-v${puzzleVersion}.json`, JSON.stringify({ ...rules, packedMeanings }) + '\n')
writeFileSync(`${artifactDirectory}/selected.json.gz`, gzipSync(JSON.stringify(selected), { level: 9 }))
writeFileSync(`${artifactDirectory}/walkthroughs.json`, JSON.stringify({ candidateId: encounter.id, routes }, null, 2) + '\n')
writeFileSync(`${artifactDirectory}/summary.json`, JSON.stringify(summary, null, 2) + '\n')
writeFileSync('src/generator/data/meaning-review.json', JSON.stringify(review, null, 2) + '\n')
for (const { path, data } of difficultyUpdates) writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
