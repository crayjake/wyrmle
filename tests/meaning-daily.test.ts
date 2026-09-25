import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { isMeaningCompilationCurrent } from '../src/generator/meaningCompiler.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'
import { getWordCommonness } from '../src/generator/lexicalProvider.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'

const selected = JSON.parse(gunzipSync(readFileSync(new URL('../artifacts/meaning-v1/selected.json.gz', import.meta.url))).toString()) as RankedCandidate
const puzzle = getDailyPuzzle('2026-09-25')

test('today publishes the complete definition-backed CHAOS v10 with archived rules retained separately', () => {
  assert.equal(puzzle.puzzleVersion, 10)
  assert.equal(puzzle.gameVersion, 'letter-strike-7')
  assert.equal(puzzle.encounter.enemy.word, 'CHAOS')
  assert.deepEqual(puzzle.encounter, selected.candidate.encounter)
  assert.equal(puzzle.encounter.refillQueue.length, 20)
  assert.deepEqual(puzzle.encounter.grammarModifiers, {})
  assert.equal(puzzle.encounter.longWordRule, undefined)
  assert.equal(Object.keys(puzzle.encounter.meaningLexicon!.words).length, 29647)
  assert.ok(isMeaningCompilationCurrent(puzzle.encounter))
  assert.ok(Object.isFrozen(puzzle.encounter.meaningLexicon!.words))
  assert.equal(puzzle.difficulty, 'MEDIUM')
  assert.equal(selected.validation.accepted, true)
  assert.equal(selected.analysis.minimumTurnsProven, false)
  assert.ok(selected.analysis.refillPressure!.winsOnReducedBoard >= 10)
  assert.ok(selected.analysis.regenImportance! > 0)
  for (const key of ['analysis', 'winningLines', 'construction', 'packedMeanings']) assert.equal(key in puzzle.encounter, false)
  const historical = getDailyPuzzleForVersion(puzzle.date, 'letter-strike-6', 9)
  assert.equal(historical.encounter.enemy.word, 'ANGER')
  assert.equal(historical.encounter.longWordRule!.minimumLength, 7)
  assert.equal(historical.encounter.meaningLexicon, undefined)
})

test('every one of 7999 full-dictionary physical openings has a legal familiar winning continuation', () => {
  const certificate = selected.analysis.openingSafety!
  assert.equal(isOpeningSafetyCertificateCurrent(puzzle.encounter, certificate), true)
  assert.equal(certificate.scope, 'all-valid-openings')
  assert.equal(certificate.openingVocabulary.scope, 'full-dictionary')
  assert.equal(certificate.enumeration.vocabularyComplete, true)
  assert.equal(certificate.enumeration.requiredSelections, 7999)
  assert.equal(certificate.unknownSelections, 0)
  assert.equal(certificate.unsafeSelections, 0)
  const initial = createLetterStrikeGame(puzzle.encounter)
  const words = new Set<string>()
  let replayed = 0
  for (const result of certificate.results) for (const opening of result.openings) {
    words.add(opening.word)
    let state = submitLetterStrike(initial, opening.tileIds)
    assert.equal(state.error, null, opening.word)
    assert.equal(state.playedWords[0].word, opening.word)
    for (const move of result.continuation!) {
      assert.ok((getWordCommonness(move.word) ?? -1) >= certificate.familiarity.minimum)
      state = submitLetterStrike(state, move.tileIds)
      assert.equal(state.error, null, `${opening.word} → ${move.word}`)
      assert.equal(state.playedWords.at(-1)!.word, move.word)
    }
    assert.equal(state.status, 'won', opening.word)
    replayed++
  }
  assert.equal(replayed, 7999)
  assert.equal(words.size, 3041)
  assert.equal(initial.playedWords.length, 0)
})

test('meaning certificates use a compact fingerprint and reject altered definitions as well as scoring rules', () => {
  const certificate = selected.analysis.openingSafety!
  assert.match(certificate.encounterKey, /^sha256:[a-f0-9]{64}$/)
  const lexicon = puzzle.encounter.meaningLexicon!
  for (const change of [{ definition: 'Changed after certification.' }, { relation: 'unrelated' as const }]) {
    const changed = { ...puzzle.encounter, meaningLexicon: { ...lexicon,
      words: { ...lexicon.words, HARMONY: { ...lexicon.words.HARMONY, ...change } } } }
    assert.equal(isOpeningSafetyCertificateCurrent(changed, certificate), false)
  }
})
