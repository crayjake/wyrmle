import assert from 'node:assert/strict'
import { test } from 'node:test'
import dictionaryData from '../src/lexicon/data/meaning-dictionary-v1.json' with { type: 'json' }
import { getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'
import { getWordMeanings } from '../scripts/lib/wordMeanings.ts'
import { isDictionaryWord } from '../src/game/dictionary.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import type { PuzzleMeaningLexicon, PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import { analysePuzzle } from '../src/generator/analyse.ts'
import { createCandidate } from '../src/generator/generate.ts'
import { compilePuzzleMeanings, isMeaningCompilationCurrent, meaningLexicalProvider, withCompiledMeanings } from '../src/generator/meaningCompiler.ts'
import { mutateCandidate, mutationKinds } from '../src/generator/mutate.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import { encounterRuleKey } from '../src/generator/stateKey.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'
import { validatePuzzle } from '../src/generator/validate.ts'

function fixture(board = 'CHEERFULANGRYCAT', refill = 'DIRTYWORRY'): LetterStrikeEncounter {
  assert.equal(board.length, 16)
  return {
    id: 'meaning-compiler-fixture',
    enemy: { word: 'ANGER', definition: 'A feeling of displeasure or hostility.', partOfSpeech: 'noun',
      semanticRelations: { opposite: ['ANGRY'], similar: ['CHEERFUL'], related: [] } },
    enemyLetters: [...'ANGER'].map((letter, index) => ({ id: `enemy-${index}`, letter, initialHits: 1, hitsRemaining: 1 })),
    startingTiles: [...board].map((letter, id) => ({ id, letter, type: 'normal' })),
    startingResolve: 5, finiteRefills: true, refillQueue: refill, minimumWordLength: 3,
    grammarModifiers: { adjective: 1 }, longWordRule: { minimumLength: 6, bonusStrikes: 1 },
    tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true } },
  }
}

function candidate(encounter: LetterStrikeEncounter): CandidatePuzzle {
  return { id: encounter.id, seed: 'meaning-compiler-fixture', enemyWord: encounter.enemy.word, encounter,
    goal: { archetypes: [], description: 'Independent compiler fixture.' }, anchors: [],
    construction: { method: 'overlapping-multisets-and-lookahead', plannedWords: [], plannedTileIds: [], refillBlocks: [], mutations: [] },
    provenance: { generatorVersion: 'test', lexicalProvider: 'test' } }
}

// Independent oracle: take one physical character out of a string per use.
// This does not call the compiler's count-array matcher or dictionary iterator.
function independentlyFits(word: string, encounter: LetterStrikeEncounter): boolean {
  if (word.length < encounter.minimumWordLength || word.length > encounter.startingTiles.length || !/^[A-Z]+$/.test(word)) return false
  let remaining = encounter.startingTiles.map(tile => tile.letter).join('').toUpperCase() + encounter.refillQueue.toUpperCase()
  for (const letter of word) {
    const index = remaining.indexOf(letter)
    if (index === -1) return false
    remaining = remaining.slice(0, index) + remaining.slice(index + 1)
  }
  return true
}

function selection(encounter: LetterStrikeEncounter, word: string): number[] {
  const ids: number[] = []
  for (const letter of word) {
    const tile = encounter.startingTiles.find(tile => tile.letter === letter && !ids.includes(tile.id))
    assert.ok(tile, `Missing ${letter} for ${word}`)
    ids.push(tile.id)
  }
  return ids
}

test('compilation covers every defined spelling in the complete physical supply, independently of solver budgets', () => {
  const encounter = fixture()
  const compiled = compilePuzzleMeanings(encounter)
  const expected = Object.keys(dictionaryData.words).filter(word => independentlyFits(word, encounter)).sort()
  assert.deepEqual(Object.keys(compiled.words), expected)
  assert.ok(expected.length > 100, 'The compiler must go well beyond the small construction anchor list.')
  assert.ok(compiled.words.DIRTY, 'A word using refill letters needs its meaning before those letters arrive.')
  assert.ok(!independentlyFits('DIRTY', { ...encounter, refillQueue: '' }))
  assert.equal(compiled.dictionaryVersion, MEANING_DICTIONARY_VERSION)
  assert.deepEqual(compilePuzzleMeanings(encounter), compiled, 'Compiling the same puzzle is deterministic.')
  assert.deepEqual(compilePuzzleMeanings({ ...encounter, startingTiles: [...encounter.startingTiles].reverse(),
    refillQueue: [...encounter.refillQueue].reverse().join('') }), compiled, 'Physical supply counts, not refill order, define this complete superset.')
})

test('compilation counts duplicate letters, enforces board/word length limits and excludes source-less dictionary entries', () => {
  const oneE = fixture('CHERFULANGRYCATX', '')
  assert.equal(compilePuzzleMeanings(oneE).words.CHEERFUL, undefined)
  assert.ok(compilePuzzleMeanings({ ...oneE, refillQueue: 'E' }).words.CHEERFUL)
  const longerMinimum = compilePuzzleMeanings({ ...fixture(), minimumWordLength: 5 })
  assert.ok(Object.keys(longerMinimum.words).every(word => word.length >= 5))
  assert.equal(longerMinimum.words.CAT, undefined)
  const tooLong = Object.keys(dictionaryData.words).find(word => word.length > 16 && /^[A-Z]+$/.test(word))!
  assert.ok(tooLong)
  const longSupply = fixture(tooLong.slice(0, 16), tooLong.slice(16))
  assert.equal(compilePuzzleMeanings(longSupply).words[tooLong], undefined, 'A word cannot use more tiles than the board holds.')
  assert.equal(isDictionaryWord('AWFY'), true)
  assert.equal(getDictionaryMeaning('AWFY'), undefined)
  const withMissingWordLetters = fixture('AWFYCAREFULANGER', '')
  assert.equal(compilePuzzleMeanings(withMissingWordLetters).words.AWFY, undefined, 'An old accepted spelling without source senses is not silently neutral.')
})

test('every stored definition and chosen sense is traceable to that spelling in the source catalog', () => {
  const compiled = compilePuzzleMeanings(fixture())
  for (const [word, entry] of Object.entries(compiled.words)) {
    const source = getWordMeanings(word).senses.find(sense => sense.id === entry.senseId)
    assert.ok(source, `${word}: chosen sense must belong to this spelling`)
    assert.ok(source.definitions.includes(entry.definition), `${word}: definition must retain source wording`)
    assert.equal(entry.lemma, source.lemma, `${word}: lemma must match the chosen source sense`)
    assert.ok(entry.partsOfSpeech.includes(source.partOfSpeech), `${word}: chosen sense POS must be retained`)
    assert.equal(entry.source, 'oewn-2025')
    assert.ok(entry.reason.trim(), `${word}: classification needs an explanation`)
  }
})

test('CHEERFUL counters anger, CAREFUL stays neutral and ANGRY is resisted with meaning-only engine hits', () => {
  const original = fixture()
  const before = structuredClone(original)
  const compiled = withCompiledMeanings(original)
  assert.deepEqual(original, before, 'Compiling must not change the archived encounter input.')
  assert.deepEqual(compiled.grammarModifiers, {})
  assert.equal(compiled.longWordRule, undefined)
  assert.ok(compiled.enemy.semanticRelations.opposite.includes('CHEERFUL'))
  assert.ok(compiled.enemy.semanticRelations.similar.includes('ANGRY'))
  assert.equal(compiled.meaningLexicon!.words.CAREFUL.relation, 'unrelated')
  const game = createLetterStrikeGame(compiled)
  for (const [word, label, hits] of [['CHEERFUL', 'COUNTER', 2], ['CAREFUL', 'NEUTRAL', 1], ['ANGRY', 'RESISTED', 0]] as const) {
    const ids = selection(compiled, word)
    const preview = previewLetterStrike(game, ids)
    assert.equal(preview.valid, true)
    assert.equal(preview.semanticLabel, label)
    assert.equal(preview.strikes, hits)
    assert.equal(preview.grammaticalModifier, 0)
    assert.equal(preview.longWordModifier, 0)
    assert.deepEqual(submitLetterStrike(game, ids).playedWords[0].preview, preview)
  }
  const roundTrip = JSON.parse(JSON.stringify(compiled)) as LetterStrikeEncounter
  assert.equal(isMeaningCompilationCurrent(roundTrip), true)
  assert.deepEqual(createLetterStrikeGame(roundTrip), game)
})

test('the compiled lexicon is deeply immutable and unsupported enemy profiles fail explicitly', () => {
  const compiled = compilePuzzleMeanings(fixture())
  assert.ok(Object.isFrozen(compiled))
  assert.ok(Object.isFrozen(compiled.words))
  for (const entry of Object.values(compiled.words)) {
    assert.ok(Object.isFrozen(entry))
    assert.ok(Object.isFrozen(entry.partsOfSpeech))
  }
  assert.throws(() => { (compiled.words.CHEERFUL as PuzzleWordMeaning).relation = 'similar' }, TypeError)
  assert.throws(() => compilePuzzleMeanings({ ...fixture(), enemy: { ...fixture().enemy, word: 'CAT' } }), /No reviewed semantic profile/)
})

test('recompilation detects removed/extra words, metadata drift and every altered meaning evidence field', () => {
  const original = withCompiledMeanings(fixture())
  assert.equal(isMeaningCompilationCurrent(original), true)
  assert.equal(isMeaningCompilationCurrent(fixture()), false)
  const changes: [string, (encounter: LetterStrikeEncounter, lexicon: PuzzleMeaningLexicon) => void][] = [
    ['missing word', (_, lexicon) => { delete (lexicon.words as Record<string, PuzzleWordMeaning>).CHEERFUL }],
    ['extra word', (_, lexicon) => { (lexicon.words as Record<string, PuzzleWordMeaning>).ZZZ = lexicon.words.CHEERFUL }],
    ['changed supply', encounter => { encounter.refillQueue += 'Z' }],
    ['changed board', encounter => { encounter.startingTiles[0].letter = 'Z' }],
    ...(['version', 'dictionaryVersion', 'profileVersion', 'policy', 'enemyWord', 'letterSupply'] as const).map(key =>
      [key, (_: LetterStrikeEncounter, lexicon: PuzzleMeaningLexicon) => { (lexicon as unknown as Record<string, unknown>)[key] = 'tampered' }] as const),
    ...(['minimumWordLength', 'maximumWordLength'] as const).map(key =>
      [key, (_: LetterStrikeEncounter, lexicon: PuzzleMeaningLexicon) => { lexicon[key]++ }] as const),
    ...(['definition', 'lemma', 'senseId', 'relation', 'reason', 'source', 'evidence'] as const).map(key =>
      [key, (_: LetterStrikeEncounter, lexicon: PuzzleMeaningLexicon) => { (lexicon.words.CHEERFUL as unknown as Record<string, unknown>)[key] = 'tampered' }] as const),
    ['partsOfSpeech', (_, lexicon) => { lexicon.words.CHEERFUL.partsOfSpeech = ['noun'] }],
  ]
  for (const [name, change] of changes) {
    const altered = structuredClone(original)
    change(altered, altered.meaningLexicon!)
    assert.equal(isMeaningCompilationCurrent(altered), false, name)
  }
  const reordered = structuredClone(original)
  reordered.meaningLexicon!.words = Object.fromEntries(Object.entries(reordered.meaningLexicon!.words).reverse())
  assert.equal(isMeaningCompilationCurrent(reordered), true, 'Record insertion order is not evidence tampering.')
})

test('new generation compiles meaning-only rules and every mutation refreshes their complete dictionary', () => {
  const source = createCandidate('ANGER', 'meaning-compiler-mutations', {
    includeRegenTile: true, refillLimit: 12,
    goal: { archetypes: ['grammar-twist', 'refill-planning'], description: 'An old requested grammar goal.' },
  })
  assert.equal(source.provenance.lexicalProvider, meaningLexicalProvider.id)
  assert.ok(source.goal.archetypes.includes('semantic-contrast'))
  assert.ok(!source.goal.archetypes.includes('grammar-twist'))
  assert.deepEqual(source.encounter.grammarModifiers, {})
  assert.equal(source.encounter.longWordRule, undefined)
  assert.equal(isMeaningCompilationCurrent(source.encounter), true)
  const before = JSON.stringify(source)
  for (const kind of mutationKinds) {
    const changed = mutateCandidate(source, `meaning-compiler:${kind}`, { kind, allowResolveMutation: true })
    assert.equal(isMeaningCompilationCurrent(changed.encounter), true, kind)
    assert.notEqual(changed.encounter.meaningLexicon, source.encounter.meaningLexicon, `${kind}: new immutable identity`)
    assert.ok(Object.isFrozen(changed.encounter.meaningLexicon), kind)
    assert.deepEqual(changed.encounter.grammarModifiers, {}, kind)
    assert.equal(changed.encounter.longWordRule, undefined, kind)
    assert.deepEqual(changed.construction.plannedTileIds, [], `${kind}: old construction is not a proof`)
    assert.doesNotThrow(() => createLetterStrikeGame(changed.encounter), kind)
  }
  assert.equal(JSON.stringify(source), before)
})

test('validation rejects definition tampering even when solver rule keys correctly remain identical', () => {
  const original = withCompiledMeanings(fixture())
  const analysis = analysePuzzle(original, {
    solver: { maxStates: 0, vocabulary: ['CHEERFUL', 'CAREFUL', 'ANGRY'] },
    includeCounterfactuals: false, maxReasonableStates: 0, maxFinalStates: 0,
  })
  const changed = structuredClone(original)
  changed.meaningLexicon!.words.CHEERFUL.definition = 'A fabricated source definition.'
  assert.equal(encounterRuleKey(changed), encounterRuleKey(original))
  assert.ok(!validatePuzzle(candidate(original), analysis).reasons.some(reason => reason.code === 'stale-or-incomplete-meanings'))
  assert.ok(validatePuzzle(candidate(changed), analysis).reasons.some(reason => reason.code === 'stale-or-incomplete-meanings'))
  const removedTable = candidate({ ...original, meaningLexicon: undefined })
  removedTable.provenance.generatorVersion = 'letter-strike-generator-3'
  assert.ok(validatePuzzle(removedTable, analysis).reasons.some(reason => reason.code === 'missing-puzzle-meanings'))
})

test('semantic analysis uses the compiled scoring table instead of legacy relation mirrors', () => {
  const compiled = withCompiledMeanings(fixture())
  const options = {
    solver: { maxStates: 0, vocabulary: ['CHEERFUL', 'CAREFUL', 'ANGRY'] },
    includeCounterfactuals: false, maxReasonableStates: 0, maxFinalStates: 0,
  }
  const withoutMirror = { ...compiled, enemy: { ...compiled.enemy,
    semanticRelations: { opposite: [], similar: [], related: [] } } }
  assert.equal(isMeaningCompilationCurrent(withoutMirror), true)
  const active = analysePuzzle(withoutMirror, options).counterfactuals.find(item => item.mechanic === 'semantic')!
  assert.equal(active.present, true)
  assert.notEqual(active.evidence, 'absent')

  const neutralTable: LetterStrikeEncounter = { ...compiled, meaningLexicon: {
    ...compiled.meaningLexicon!, words: Object.fromEntries(Object.entries(compiled.meaningLexicon!.words)
      .map(([word, meaning]) => [word, { ...meaning, relation: 'unrelated' as const }])) } }
  const absent = analysePuzzle(neutralTable, options).counterfactuals.find(item => item.mechanic === 'semantic')!
  assert.equal(absent.present, false)
  assert.equal(absent.importance, 0)
})

test('meaning-only quality scoring values semantic decisions and awards no grammar relevance', () => {
  const compiled = withCompiledMeanings(fixture())
  const measured = analysePuzzle(compiled, {
    solver: { maxStates: 0, vocabulary: ['CHEERFUL', 'CAREFUL', 'ANGRY'] },
    includeCounterfactuals: false, maxReasonableStates: 0, maxFinalStates: 0,
  })
  const analysis = { ...measured, semanticMechanicImportance: 0.5, grammarImportance: 0.5 }
  const score = scorePuzzle(candidate(compiled), analysis)
  assert.equal(score.components.find(component => component.name === 'semanticChoices')!.weight, 20)
  assert.equal(score.components.find(component => component.name === 'grammarRelevance')!.contribution, 0)
  const withoutMeaning = scorePuzzle(candidate(compiled), { ...analysis, semanticMechanicImportance: 0 })
  assert.ok(score.rawTotal > withoutMeaning.rawTotal)
  const legacy = scorePuzzle(candidate({ ...compiled, meaningLexicon: undefined }), analysis)
  assert.ok(legacy.components.find(component => component.name === 'grammarRelevance')!.contribution > 0)
})
