import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { validateMeaningLexicon } from '../src/game/meaningLexicon.ts'
import { discoverValidMoves } from '../src/generator/findMoves.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'
import { getGenerationWordCommonness, GENERATION_COMMONNESS_SOURCE } from '../src/generator/familiarity.ts'
import { isMeaningCompilationCurrent, isMeaningPublicationReady } from '../src/generator/meaningCompiler.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import { getDefinedDictionaryWords } from '../src/lexicon/meaningDictionary.ts'
import { stateKey } from '../src/generator/stateKey.ts'

const selected = JSON.parse(gunzipSync(readFileSync(new URL('../artifacts/meaning-v3/selected.json.gz', import.meta.url))).toString()) as RankedCandidate
const previous = JSON.parse(gunzipSync(readFileSync(new URL('../artifacts/meaning-v2/selected.json.gz', import.meta.url))).toString()) as RankedCandidate
const walkthroughs = JSON.parse(readFileSync(new URL('../artifacts/meaning-v3/walkthroughs.json', import.meta.url), 'utf8')) as {
  candidateId: string; routes: { words: string[]; tileIds: number[][]; livesRemaining: number }[]
}
const puzzle = getDailyPuzzle('2026-09-26')
const oldPuzzle = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-7', 11)

test('the separate exhaustive three-word proof binds to this exact publication and a real winning witness', () => {
  const proof = JSON.parse(gunzipSync(readFileSync(new URL('../artifacts/meaning-v3/minimum-proof.json.gz', import.meta.url))).toString())
  let state = createLetterStrikeGame(puzzle.encounter)
  assert.equal(proof.encounterKey, stateKey(state))
  assert.equal(proof.provenMinimumWords, 3)
  assert.equal(proof.openingSelections, selected.analysis.openingSafety!.enumeration.requiredSelections)
  assert.equal(proof.witness.length, 3)
  for (const move of proof.witness) state = submitLetterStrike(state, move.tileIds)
  assert.equal(state.error, null)
  assert.equal(state.status, 'won')
})

test('today and tomorrow publish the same reviewed model-assessed v12 and preserve archived v11 independently', () => {
  const tomorrow = getDailyPuzzle('2026-09-27')
  assert.equal(tomorrow.puzzleVersion, 12)
  assert.equal(tomorrow.puzzleId, '2026-09-27')
  assert.equal(tomorrow.date, '2026-09-27')
  assert.equal(tomorrow.encounter, puzzle.encounter)
  assert.notEqual(tomorrow.puzzleId, puzzle.puzzleId)
  assert.equal(getDailyPuzzle('2026-09-28').puzzleVersion, 4)
  assert.equal(puzzle.puzzleVersion, 12)
  assert.equal(puzzle.gameVersion, 'letter-strike-7')
  assert.deepEqual(puzzle.encounter, selected.candidate.encounter)
  assert.equal(JSON.stringify(puzzle.encounter), JSON.stringify(selected.candidate.encounter))
  assert.deepEqual(oldPuzzle.encounter, previous.candidate.encounter)
  assert.equal(selected.validation.accepted, true)
  assert.equal(puzzle.difficulty, selected.difficulty!.label)
  assert.equal(isMeaningCompilationCurrent(puzzle.encounter), true)
  assert.equal(isMeaningPublicationReady(puzzle.encounter), true)
  assert.equal(isMeaningCompilationCurrent(oldPuzzle.encounter), false)
  assert.equal(puzzle.encounter.finiteRefills, true)
  assert.ok(puzzle.encounter.refillQueue.length > 0)
  assert.equal(puzzle.encounter.startingTiles.filter(tile => tile.gem === 'regen').length, 1)
  assert.ok(selected.analysis.refillPressure!.winsOnReducedBoard > 0)
  assert.ok(selected.analysis.regenImportance! > 0)
  assert.ok(selected.analysis.semanticMechanicImportance! > 0)
  for (const key of ['analysis', 'winningLines', 'construction', 'packedMeanings']) assert.equal(key in puzzle.encounter, false)
})

test('every accepted supply spelling has frozen model scores and source evidence before any move', () => {
  const meanings = puzzle.encounter.meaningLexicon!
  assert.ok(meanings.assessment)
  assert.equal(meanings.assessment.assessedWords, getDefinedDictionaryWords().length)
  assert.ok(meanings.assessment.assessedSenses > 0)
  assert.ok(Object.isFrozen(meanings.assessment))
  assert.ok(meanings.assessment.refinement)
  assert.ok(Object.isFrozen(meanings.assessment.refinement))
  assert.ok(meanings.assessment.refinement.eligibleWords > 0)
  assert.equal(meanings.assessment.refinement.reviewedWords, meanings.assessment.refinement.eligibleWords)
  assert.equal(Object.values(meanings.words).filter(word => ['local-llm', 'source-reviewed'].includes(word.assessment?.decisionBasis ?? '')).length, meanings.assessment.refinement.reviewedWords)
  assert.equal(Object.values(meanings.words).filter(word => word.assessment?.decisionBasis === 'source-reviewed').length, meanings.assessment.refinement.sourceReviewedWords)
  assert.doesNotThrow(() => validateMeaningLexicon(puzzle.encounter))
  const supply = puzzle.encounter.startingTiles.map(tile => tile.letter).join('') + puzzle.encounter.refillQueue
  const expected = getDefinedDictionaryWords().filter(word => {
    if (word.length < puzzle.encounter.minimumWordLength || word.length > puzzle.encounter.startingTiles.length) return false
    let remaining = supply
    for (const letter of word) {
      const index = remaining.indexOf(letter)
      if (index < 0) return false
      remaining = remaining.slice(0, index) + remaining.slice(index + 1)
    }
    return true
  })
  assert.deepEqual(Object.keys(meanings.words), expected)
  for (const [word, meaning] of Object.entries(meanings.words)) {
    assert.equal(meaning.evidence, 'model-assessed', word)
    assert.ok(meaning.definition.trim(), word)
    assert.ok(meaning.senseId, word)
    assert.ok(meaning.assessment && meaning.assessment.sensesEvaluated > 0, word)
    assert.ok(Object.isFrozen(meaning.assessment), word)
    assert.ok(Number.isFinite(meaning.assessment.counterScore), word)
    assert.ok(Number.isFinite(meaning.assessment.resistedScore), word)
    assert.ok(Number.isFinite(meaning.assessment.margin), word)
  }
})

test('every physical model-era opening has an independently replayed familiar winning continuation', () => {
  const certificate = selected.analysis.openingSafety!
  assert.equal(isOpeningSafetyCertificateCurrent(puzzle.encounter, certificate), true)
  assert.equal(certificate.scope, 'all-valid-openings')
  assert.equal(certificate.familiarity.source, GENERATION_COMMONNESS_SOURCE)
  assert.equal(certificate.openingVocabulary.scope, 'full-dictionary')
  assert.equal(certificate.enumeration.vocabularyComplete, true)
  assert.equal(certificate.unknownSelections, 0)
  assert.equal(certificate.unsafeSelections, 0)
  const initial = createLetterStrikeGame(puzzle.encounter)
  const discovered = discoverValidMoves(initial)
  assert.equal(discovered.complete, true)
  assert.equal(discovered.vocabularyComplete, true)
  const key = (word: string, ids: readonly number[]) => `${word}:${ids.join(',')}`
  const expected = new Set(discovered.moves.map(move => key(move.word, move.tileIds)))
  const replayed = new Set<string>()
  for (const result of certificate.results) for (const opening of result.openings) {
    const openingKey = key(opening.word, opening.tileIds)
    assert.equal(replayed.has(openingKey), false, openingKey)
    replayed.add(openingKey)
    let state = submitLetterStrike(initial, opening.tileIds)
    assert.equal(state.error, null, opening.word)
    assert.equal(state.playedWords.at(-1)!.word, opening.word)
    for (const move of result.continuation!) {
      assert.ok((getGenerationWordCommonness(move.word) ?? -1) >= certificate.familiarity.minimum)
      state = submitLetterStrike(state, move.tileIds)
      assert.equal(state.error, null, `${opening.word} → ${move.word}`)
      assert.equal(state.playedWords.at(-1)!.word, move.word)
    }
    assert.equal(state.status, 'won', openingKey)
  }
  assert.deepEqual(replayed, expected)
  assert.equal(replayed.size, certificate.enumeration.requiredSelections)
})

test('stored walkthroughs are current retained winners and replay their exact physical tile choices', () => {
  assert.equal(walkthroughs.candidateId, puzzle.encounter.id)
  assert.equal(walkthroughs.routes.length, selected.analysis.winningLines.length)
  for (const [index, route] of walkthroughs.routes.entries()) {
    assert.deepEqual(route.words, selected.analysis.winningLines[index].moves.map(move => move.word))
    assert.deepEqual(route.tileIds, selected.analysis.winningLines[index].moves.map(move => move.tileIds))
    let state = createLetterStrikeGame(puzzle.encounter)
    for (const [turn, ids] of route.tileIds.entries()) {
      state = submitLetterStrike(state, ids)
      assert.equal(state.error, null)
      assert.equal(state.playedWords.at(-1)!.word, route.words[turn])
    }
    assert.equal(state.status, 'won')
    assert.equal(state.playerResolve, route.livesRemaining)
  }
})

test('old certificates and changed model scores or metadata cannot certify the new publication', () => {
  assert.equal(isOpeningSafetyCertificateCurrent(oldPuzzle.encounter, previous.analysis.openingSafety!), true)
  assert.equal(isOpeningSafetyCertificateCurrent(puzzle.encounter, previous.analysis.openingSafety!), false)
  const meanings = puzzle.encounter.meaningLexicon!
  const word = Object.keys(meanings.words)[0]
  const stored = meanings.words[word]
  const missing = { ...meanings.words }
  delete missing[word]
  const changedScore = { ...stored, assessment: { ...stored.assessment!,
    counterScore: stored.assessment!.counterScore < 0.5 ? 0.75 : 0.25 } }
  for (const changed of [
    { ...meanings, words: missing },
    { ...meanings, words: { ...meanings.words, [word]: changedScore } },
    { ...meanings, assessment: { ...meanings.assessment!, modelRevision: 'a-different-model' } },
  ]) {
    const encounter = { ...puzzle.encounter, meaningLexicon: changed }
    assert.equal(isMeaningCompilationCurrent(encounter), false)
    assert.equal(isMeaningPublicationReady(encounter), false)
    assert.equal(isOpeningSafetyCertificateCurrent(encounter, selected.analysis.openingSafety!), false)
  }
})
