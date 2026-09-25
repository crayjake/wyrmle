import assert from 'node:assert/strict'
import test from 'node:test'
import { auditEncounterLexicon, isLexicalAuditCurrent } from '../src/generator/lexicalAudit.ts'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { findPlayableWords } from '../src/generator/findMoves.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import { createLetterStrikeGame } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import { currentLexicalRules, getEncounterWordClassification } from '../src/game/lexicalRules.ts'

function fixture(): LetterStrikeEncounter {
  return {
    id: 'lexical-audit-fixture',
    enemy: { word: 'A', definition: 'Audit fixture.', partOfSpeech: 'noun',
      semanticRelations: { opposite: ['BAY'], similar: ['BAD'], related: ['YEA'] } },
    enemyLetters: [{ id: 'enemy-0', letter: 'A', initialHits: 1, hitsRemaining: 1 }],
    startingResolve: 1,
    startingTiles: [...'AALBAYEDQQQQQQQQ'].map((letter, id) => ({ id, letter, type: 'normal' })),
    // HOPES is included in the supply, but these letters cannot be drawn before
    // this one-Resolve encounter ends. The audit must not call it reachable.
    refillQueue: 'A'.repeat(16) + 'HOPEST'.repeat(10),
    minimumWordLength: 3,
    lexicalRules: { ...currentLexicalRules },
    grammarModifiers: { adjective: 1 },
    tileEffects: { ward: { strike: false, preventResolveLoss: true }, strike: { strike: true, preventResolveLoss: false } },
  }
}

function candidate(encounter: LetterStrikeEncounter): CandidatePuzzle {
  return { id: encounter.id, seed: 'audit-test', enemyWord: encounter.enemy.word, encounter,
    goal: { archetypes: [], description: 'Lexical audit test.' }, anchors: [],
    construction: { method: 'overlapping-multisets-and-lookahead', plannedWords: [], plannedTileIds: [], refillBlocks: [], mutations: [] },
    provenance: { generatorVersion: 'test', lexicalProvider: 'test' } }
}

const boundedOptions = {
  solver: { maxStates: 1, maxMovesPerState: 1, maxSelectionsPerState: 1, vocabulary: ['BAY'] },
  includeCounterfactuals: false, maxReasonableStates: 0, wordCommonness: () => 0.8,
}

test('lexical audit covers every legal opening spelling, independently of physical selections', () => {
  const encounter = fixture()
  const audit = auditEncounterLexicon(encounter, { includeEntries: true })
  const expected = findPlayableWords(createLetterStrikeGame(encounter)).sort()
  const actual = audit.entries!.filter(entry => entry.openingPlayable).map(entry => entry.word)
  assert.deepEqual(actual, expected)
  assert.equal(audit.opening.words, expected.length)
  assert.equal(audit.opening.dictionaryEnumerationComplete, true)
  assert.equal(audit.dictionaryWordsScanned, audit.dictionary.words)
  assert.ok(audit.dictionaryWordsScanned > 250_000)
  assert.ok(actual.includes('AAL'), 'Accepted dictionary words without POS are still audited.')
  assert.equal(new Set(actual).size, actual.length, 'Duplicate tile choices do not inflate spelling counts.')
  for (const entry of audit.entries!) {
    const { word, openingPlayable: _opening, ...classification } = entry
    assert.deepEqual(classification, getEncounterWordClassification(encounter, word))
  }
})

test('full refill audit is an explicit supply superset and respects letter multiplicity and board capacity', () => {
  const encounter = fixture()
  const audit = auditEncounterLexicon(encounter, { includeEntries: true })
  const byWord = new Map(audit.entries!.map(entry => [entry.word, entry]))
  assert.ok(byWord.has('HOPES'))
  assert.equal(byWord.get('HOPES')!.openingPlayable, false)
  assert.equal(audit.supply.reachableBoardsExhaustive, false)
  assert.equal(audit.supply.dictionaryEnumerationComplete, true)
  assert.equal(audit.supply.physicalLetterCounts.P, 10)
  assert.ok(audit.supply.words > audit.opening.words)
  assert.equal(byWord.has('BALL'), false, 'One physical L cannot supply two Ls.')
  assert.ok(audit.entries!.every(entry => entry.word.length >= 3 && entry.word.length <= 16))
  assert.equal(audit.entries!.length, audit.supply.words)
})

test('audit reports known, ambiguous and unknown POS plus explicit semantic fallback without fabricating meaning', () => {
  const audit = auditEncounterLexicon(fixture(), { includeEntries: true })
  const aal = audit.entries!.find(entry => entry.word === 'AAL')!
  assert.deepEqual(aal.partsOfSpeech, [])
  assert.equal(aal.partOfSpeechSource, 'unknown')
  assert.equal(aal.semanticSource, 'unlisted')
  assert.equal(aal.relation, 'unrelated', 'This is the actual gameplay fallback, labeled as unlisted evidence.')
  const bay = audit.entries!.find(entry => entry.word === 'BAY')!
  assert.ok(bay.partsOfSpeech.length > 1)
  assert.equal(bay.relation, 'opposite')
  assert.equal(bay.semanticSource, 'curated-or-wordnet')
  assert.ok(audit.opening.partOfSpeechSources.wordnet > 0)
  assert.ok(audit.opening.partOfSpeechSources.morphology > 0)
  assert.ok(audit.opening.unknownPartOfSpeechWords > 0)
  assert.ok(audit.opening.unknownPartOfSpeechSamples.includes('AAL'))
  for (const counts of [audit.opening, audit.supply]) {
    assert.equal(counts.singlePartOfSpeechWords + counts.multiplePartsOfSpeechWords + counts.unknownPartOfSpeechWords, counts.words)
    assert.equal(Object.values(counts.partOfSpeechSources).reduce((sum, value) => sum + value, 0), counts.words)
    assert.equal(Object.values(counts.semanticRelations).reduce((sum, value) => sum + value, 0), counts.words)
    assert.equal(counts.semanticFallbackWords, counts.semanticSources.unlisted)
    assert.ok(counts.unknownPartOfSpeechSamples.length <= 20)
  }
  const curated = fixture()
  curated.wordPartsOfSpeech = { AAL: ['noun'] }
  const curatedAudit = auditEncounterLexicon(curated, { includeEntries: true })
  assert.equal(curatedAudit.entries!.find(entry => entry.word === 'AAL')!.partOfSpeechSource, 'curated')
  assert.equal(curatedAudit.opening.unknownPartOfSpeechWords, audit.opening.unknownPartOfSpeechWords - 1)
})

test('zero solver budgets and restricted solver vocabulary cannot truncate the annotation audit', () => {
  const encounter = fixture()
  const analysis = analysePuzzle(encounter, { ...boundedOptions, solver: { maxStates: 0, vocabulary: [] } })
  const audit = auditEncounterLexicon(encounter)
  assert.deepEqual(analysis.lexicalAudit, audit)
  assert.ok(analysis.lexicalAudit!.opening.words > 1)
  assert.equal(analysis.vocabularyComplete, false)
  assert.equal(analysis.lexicalAudit!.opening.dictionaryEnumerationComplete, true)
  assert.equal('entries' in analysis.lexicalAudit!, false, 'Normal analysis stores compact counts rather than every spelling.')
  const legacy = fixture()
  delete legacy.lexicalRules
  const legacyAnalysis = analysePuzzle(legacy, { ...boundedOptions, solver: { maxStates: 0 } })
  assert.equal('lexicalAudit' in legacyAnalysis, false, 'Archived analysis shapes remain unchanged.')
})

test('deterministic audit fingerprints detect changed dictionary, rules and annotation inputs', () => {
  const encounter = fixture()
  const audit = auditEncounterLexicon(encounter)
  assert.deepEqual(auditEncounterLexicon(encounter), audit)
  assert.equal(isLexicalAuditCurrent(encounter, audit), true)
  for (const mutate of [
    (value: LetterStrikeEncounter) => { value.refillQueue += 'Z' },
    (value: LetterStrikeEncounter) => { value.enemy.semanticRelations.opposite = ['BAD'] },
    (value: LetterStrikeEncounter) => { value.wordPartsOfSpeech = { AAL: ['noun'] } },
    (value: LetterStrikeEncounter) => { value.minimumWordLength = 4 },
    (value: LetterStrikeEncounter) => { value.startingTiles = value.startingTiles.map((tile, index) => index === 0 ? { ...tile, letter: 'Z' } : tile) },
  ]) {
    const changed = structuredClone(encounter)
    mutate(changed)
    assert.equal(isLexicalAuditCurrent(changed, audit), false)
  }
  const staleDictionary = structuredClone(audit)
  staleDictionary.dictionary.fingerprint = 'fnv1a32:00000000'
  assert.equal(isLexicalAuditCurrent(encounter, staleDictionary), false)
  const staleLexicon = structuredClone(audit)
  staleLexicon.lexicon!.version = 'old-version'
  assert.equal(isLexicalAuditCurrent(encounter, staleLexicon), false)
})

test('validator requires a current complete audit while unknown annotations remain review warnings', () => {
  const puzzle = candidate(fixture())
  const analysis = analysePuzzle(puzzle, boundedOptions)
  const overrides = {
    minimumWinningTurns: 1, minimumReasonableOpenings: 0, maximumPrematureDeadStateRate: 1,
    minimumFairnessCoverage: 0, maximumCriticalSinglePointLetters: 100,
    requireSemanticImportance: false, requireFamiliarWinningWitness: false,
  }
  const valid = validatePuzzle(puzzle, analysis, overrides)
  assert.equal(valid.accepted, true, JSON.stringify(valid.reasons))
  assert.ok(valid.warnings.some(warning => warning.code === 'unknown-parts-of-speech'))
  assert.ok(valid.warnings.some(warning => warning.code === 'unlisted-semantics'))
  const missing = structuredClone(analysis)
  delete missing.lexicalAudit
  assert.ok(validatePuzzle(puzzle, missing, overrides).reasons.some(reason => reason.code === 'missing-lexical-audit'))
  const stale = structuredClone(analysis)
  stale.lexicalAudit!.lexicon!.version = 'old-version'
  assert.ok(validatePuzzle(puzzle, stale, overrides).reasons.some(reason => reason.code === 'stale-lexical-audit'))
  const legacy = candidate(fixture())
  delete legacy.encounter.lexicalRules
  assert.equal(validatePuzzle(legacy, missing, overrides).accepted, true)
})
