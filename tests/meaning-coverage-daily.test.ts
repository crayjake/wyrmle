import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import { isDeepStrictEqual } from 'node:util'
import { getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { discoverValidMoves } from '../src/generator/findMoves.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'
import { getWordCommonness } from '../src/generator/lexicalProvider.ts'
import { isMeaningCompilationCurrent } from '../src/generator/meaningCompiler.ts'
import { isOpeningSafetyCertificateCurrent } from '../src/generator/openingSafety.ts'

const selected = JSON.parse(gunzipSync(readFileSync(new URL('../artifacts/meaning-v2/selected.json.gz', import.meta.url))).toString()) as RankedCandidate
const original = JSON.parse(gunzipSync(readFileSync(new URL('../artifacts/meaning-v1/selected.json.gz', import.meta.url))).toString()) as RankedCandidate
const puzzle = getDailyPuzzleForVersion('2026-09-25', 'letter-strike-7', 11)
const archived = getDailyPuzzleForVersion(puzzle.puzzleId, 'letter-strike-7', 10)

test('archived CHAOS v11 retains its corrected complete dictionary and unchanged physical puzzle', () => {
  assert.equal(puzzle.puzzleVersion, 11)
  assert.equal(puzzle.gameVersion, 'letter-strike-7')
  assert.equal(puzzle.encounter.id, 'daily-chaos-2026-09-25-v11')
  assert.deepEqual(puzzle.encounter, selected.candidate.encounter)
  const { id: _oldId, meaningLexicon: oldMeanings, ...oldRules } = archived.encounter
  const { id: _newId, meaningLexicon: meanings, ...newRules } = puzzle.encounter
  const { enemy: oldEnemy, ...oldPhysical } = oldRules
  const { enemy: newEnemy, ...newPhysical } = newRules
  const { semanticRelations: _oldRelations, ...oldConcept } = oldEnemy
  const { semanticRelations: _newRelations, ...newConcept } = newEnemy
  assert.deepEqual(newPhysical, oldPhysical)
  assert.deepEqual(newConcept, oldConcept)
  assert.ok(meanings && oldMeanings)
  assert.equal(meanings.dictionaryVersion, 'wyrmle-defined-dictionary-v2')
  assert.equal(meanings.profileVersion, 'semantic-profiles-v2-chaos')
  assert.equal(Object.keys(meanings.words).length, 29719)
  const corrections = Object.keys(oldMeanings.words).filter(word => !isDeepStrictEqual(meanings.words[word], oldMeanings.words[word]))
  assert.deepEqual(corrections.sort(), [
    'BALANCE', 'BALANCES', 'CALM', 'CALMED', 'CALMER', 'CALMEST', 'CALMING', 'CALMNESS', 'CALMNESSES', 'CALMS',
    'CLARITIES', 'CLARITY', 'COHERENCE', 'COHERENCES', 'COHERENCIES', 'COHERENCY', 'COHERENT', 'COHERENTLY',
    'CONSISTENT', 'COOL', 'COOLER', 'COOLEST', 'EASINESS', 'HEARTSEASE', 'HEARTSEASES', 'METHOD', 'METHODS',
    'SEAMLESS', 'SERENE', 'SERENELY', 'SERENER', 'SERENEST', 'SERENITIES', 'SERENITY', 'STABILITY', 'SYSTEM',
    'SYSTEMATIC', 'SYSTEMATISE', 'SYSTEMATISED', 'SYSTEMATISING', 'SYSTEMISE', 'SYSTEMISED', 'SYSTEMISING', 'SYSTEMS',
  ].sort(), 'All other previously stored records must remain exactly unchanged.')
  assert.equal(corrections.filter(word => oldMeanings.words[word].relation !== meanings.words[word].relation).length, 33)
  for (const word of corrections) assert.equal(meanings.words[word].relation, 'opposite', word)
  assert.equal(meanings.words.CALM.senseId, 'oewn-calm__5.00.00.composed.00')
  assert.equal(meanings.words.CALM.definition, 'not agitated; without losing self-possession')
  for (const word of ['AND', 'HER', 'SHE', 'HIM', 'THE', 'THEIR', 'THIS', 'THOSE']) {
    assert.equal(oldMeanings.words[word], undefined, `${word} exercises a newly filled coverage gap.`)
    assert.equal(meanings.words[word].source, 'wiktionary-en')
    assert.equal(meanings.words[word].relation, 'unrelated')
    assert.ok(meanings.words[word].definition.trim())
  }
  assert.equal(isMeaningCompilationCurrent(puzzle.encounter), false, 'The archived sparse profile must not masquerade as a model assessment.')
  assert.ok(Object.isFrozen(meanings.words))
  assert.equal(selected.validation.accepted, true)
  assert.equal(puzzle.difficulty, selected.difficulty!.label)
  assert.equal(selected.analysis.minimumTurnsProven, false)
  assert.ok(selected.analysis.refillPressure!.winsOnReducedBoard >= 10)
  assert.ok(selected.analysis.regenImportance! > 0)
  for (const key of ['analysis', 'winningLines', 'construction', 'packedMeanings']) assert.equal(key in puzzle.encounter, false)
})

test('v11 independently covers every legal physical opening and replays a familiar win after every new and existing word', () => {
  const certificate = selected.analysis.openingSafety!
  assert.equal(isOpeningSafetyCertificateCurrent(puzzle.encounter, certificate), true)
  assert.equal(certificate.scope, 'all-valid-openings')
  assert.equal(certificate.openingVocabulary.scope, 'full-dictionary')
  assert.equal(certificate.enumeration.vocabularyComplete, true)
  assert.equal(certificate.unknownSelections, 0)
  assert.equal(certificate.unsafeSelections, 0)
  const initial = createLetterStrikeGame(puzzle.encounter)
  const discovered = discoverValidMoves(initial)
  assert.equal(discovered.complete, true)
  assert.equal(discovered.vocabularyComplete, true)
  const selectionKey = (word: string, tileIds: readonly number[]) => `${word}:${tileIds.join(',')}`
  const expected = new Set(discovered.moves.map(move => selectionKey(move.word, move.tileIds)))
  const replayed = new Set<string>()
  const words = new Set<string>()
  for (const result of certificate.results) for (const opening of result.openings) {
    const key = selectionKey(opening.word, opening.tileIds)
    assert.equal(replayed.has(key), false, `Duplicate certificate selection ${key}`)
    replayed.add(key)
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
  }
  assert.deepEqual(replayed, expected, 'The certificate must enumerate exactly the complete physical move set.')
  assert.equal(replayed.size, certificate.enumeration.requiredSelections)
  assert.ok(replayed.size > original.analysis.openingSafety!.enumeration.requiredSelections)
  for (const word of ['AND', 'HER', 'SHE', 'NOR']) assert.ok(words.has(word), word)
  assert.equal(initial.playedWords.length, 0)
})

test('v10 proof cannot certify v11 and v11 proof rejects changed or omitted supplemental definitions', () => {
  assert.equal(isOpeningSafetyCertificateCurrent(archived.encounter, original.analysis.openingSafety!), true)
  assert.equal(isOpeningSafetyCertificateCurrent(puzzle.encounter, original.analysis.openingSafety!), false)
  const meanings = puzzle.encounter.meaningLexicon!
  const certificate = selected.analysis.openingSafety!
  const missing = { ...meanings.words }
  delete missing.AND
  for (const words of [missing, { ...meanings.words, AND: { ...meanings.words.AND, definition: 'Changed after certification.' } }]) {
    const changed = { ...puzzle.encounter, meaningLexicon: { ...meanings, words } }
    assert.equal(isMeaningCompilationCurrent(changed), false)
    assert.equal(isOpeningSafetyCertificateCurrent(changed, certificate), false)
  }
})
