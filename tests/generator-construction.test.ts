import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPartsOfSpeech } from '../src/game/dictionary.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import { canSpell, overlappingLetters } from '../src/generator/constructBoard.ts'
import { createCandidate, generateForEnemy, generatePuzzle } from '../src/generator/generate.ts'
import type { GenerationOptions } from '../src/generator/generate.ts'
import { localLexicalProvider } from '../src/generator/lexicalProvider.ts'
import { mutateCandidate, mutationKinds } from '../src/generator/mutate.ts'
import { buildWordPools } from '../src/generator/wordPools.ts'
import { solvePuzzle } from '../src/generator/solve.ts'
import { validatePuzzle } from '../src/generator/validate.ts'

const quickOptions: GenerationOptions = {
  candidateCount: 2,
  refinementRounds: 0,
  analysis: {
    solver: {
      maxStates: 3, beamWidth: 2, maxMovesPerState: 12, maxSelectionsPerState: 200,
      vocabulary: localLexicalProvider.vocabulary().map(entry => entry.word),
    },
    includeCounterfactuals: false,
    maxReasonableStates: 0,
    maxFinalStates: 0,
  },
}

test('seeded construction shares anchor letters, keeps 16 identities and guarantees opening anchors', () => {
  assert.deepEqual(overlappingLetters(['CHEER', 'CHEERY']).sort(), [...'CHEERY'].sort())
  for (let seed = 0; seed < 6; seed += 1) {
    const candidate = createCandidate('melancholy', `construction-test:${seed}`)
    assert.deepEqual(candidate, createCandidate('MELANCHOLY', `construction-test:${seed}`))
    assert.equal(candidate.encounter.startingTiles.length, 16)
    assert.equal(new Set(candidate.encounter.startingTiles.map(tile => tile.id)).size, 16)
    assert.equal(candidate.encounter.startingTiles.filter(tile => tile.gem === 'ward').length, 1)
    assert.equal(candidate.encounter.startingTiles.filter(tile => tile.gem === 'strike').length, 1)
    for (const anchor of candidate.anchors.filter(anchor => anchor.expected === 'opening')) {
      assert.equal(canSpell(anchor.word, candidate.encounter.startingTiles.map(tile => tile.letter)), true, anchor.word)
    }
    assert.doesNotThrow(() => createLetterStrikeGame(candidate.encounter))
  }
  assert.notDeepEqual(createCandidate('MELANCHOLY', 'construction-test:0').encounter.startingTiles,
    createCandidate('MELANCHOLY', 'construction-test:1').encounter.startingTiles)
})

test('purposeful refill plans replay through the actual game with identical words and board slots', () => {
  let wins = 0
  for (let seed = 0; seed < 6; seed += 1) {
    const candidate = createCandidate('MELANCHOLY', `construction-test:${seed}`)
    let state = createLetterStrikeGame(candidate.encounter)
    const trace = candidate.construction
    assert.equal(trace.plannedWords.length, trace.plannedTileIds.length)
    assert.equal(trace.refillBlocks.length, trace.plannedTileIds.length)
    for (const [index, ids] of trace.plannedTileIds.entries()) {
      const preview = previewLetterStrike(state, ids)
      assert.equal(preview.valid, true, `${candidate.seed}: ${preview.error}`)
      assert.equal(preview.word, trace.plannedWords[index])
      const block = trace.refillBlocks[index]
      assert.equal(block.offset, state.refillIndex)
      assert.equal(candidate.encounter.refillQueue.slice(block.offset, block.offset + ids.length), block.letters)
      const before = state
      state = submitLetterStrike(state, ids)
      assert.equal(state.refillIndex, before.refillIndex + ids.length)
      const used = new Set(ids)
      const untouched = before.tiles.filter(tile => !used.has(tile.id))
      for (const tile of untouched) assert.deepEqual(state.tiles.find(item => item.id === tile.id), tile)
    }
    wins += Number(state.status === 'won')
  }
  assert.ok(wins > 0, 'At least one construction witness in the fixed sample must beat MELANCHOLY.')
})

test('serialized candidates carry complete deterministic local semantic and grammar annotations', () => {
  const candidate = createCandidate('MELANCHOLY', 'serialized-lexicon')
  const pools = buildWordPools('MELANCHOLY')
  const restored = JSON.parse(JSON.stringify(candidate))
  assert.deepEqual(restored.encounter.enemy.semanticRelations, pools.semanticRelations)
  assert.deepEqual(restored.encounter.wordPartsOfSpeech, pools.wordPartsOfSpeech)
  assert.ok(restored.encounter.enemy.semanticRelations.opposite.includes('COMEDY'))
  assert.ok(restored.encounter.enemy.semanticRelations.similar.includes('GLOOMY'))
  assert.deepEqual(restored.encounter.wordPartsOfSpeech.GLOOMY, ['adjective'])
  assert.deepEqual(createLetterStrikeGame(restored.encounter), createLetterStrikeGame(candidate.encounter))
})

test('every mutation primitive is deterministic, preserves encounter validity and clears obsolete proof IDs', () => {
  const source = createCandidate('MELANCHOLY', 'mutation-primitives')
  // Give armour-copy an actual alternative: the first L is armoured, its copy is not.
  let firstL = true
  source.encounter.enemyLetters = source.encounter.enemyLetters.map(letter => {
    if (letter.letter !== 'L') return letter
    const hits = firstL ? 2 : 1
    firstL = false
    return { ...letter, initialHits: hits, hitsRemaining: hits }
  })
  const before = structuredClone(source)
  for (const kind of mutationKinds) {
    const options = { kind, allowResolveMutation: true }
    const mutation = mutateCandidate(source, `primitive:${kind}`, options)
    assert.deepEqual(mutation, mutateCandidate(source, `primitive:${kind}`, options), kind)
    assert.doesNotThrow(() => createLetterStrikeGame(mutation.encounter), kind)
    assert.equal(mutation.encounter.startingTiles.length, 16, kind)
    assert.equal(mutation.provenance.parentId, source.id)
    assert.deepEqual(mutation.construction.plannedTileIds, [])
    assert.notDeepEqual(mutation.encounter, source.encounter)
    for (const anchor of mutation.anchors.filter(anchor => anchor.expected === 'opening')) {
      assert.equal(canSpell(anchor.word, mutation.encounter.startingTiles.map(tile => tile.letter)), true)
    }
    if (kind === 'starting-letter') assert.notDeepEqual(mutation.encounter.startingTiles, source.encounter.startingTiles)
    if (kind === 'refill-letter') assert.notEqual(mutation.encounter.refillQueue, source.encounter.refillQueue)
    if (kind === 'armour-copy') assert.notDeepEqual(mutation.encounter.enemyLetters, source.encounter.enemyLetters)
    if (kind === 'resolve') assert.notEqual(mutation.encounter.startingResolve, source.encounter.startingResolve)
    if (kind === 'anchor') {
      assert.notDeepEqual(mutation.anchors, source.anchors)
      for (const anchor of mutation.anchors.filter(anchor => anchor.expected === 'opening')) {
        const parts = mutation.encounter.wordPartsOfSpeech?.[anchor.word] ?? getPartsOfSpeech(anchor.word) ?? []
        if (anchor.roles.includes('counter')) assert.ok(mutation.encounter.enemy.semanticRelations.opposite.includes(anchor.word))
        if (anchor.roles.includes('resisted')) assert.ok(mutation.encounter.enemy.semanticRelations.similar.includes(anchor.word))
        if (anchor.roles.includes('grammar')) {
          assert.equal(parts.length, 1)
          assert.ok((mutation.encounter.grammarModifiers?.[parts[0]] ?? 0) > 0)
        }
      }
    }
  }
  assert.deepEqual(source, before)
  assert.equal(mutateCandidate(source, 'disabled-resolve', { kind: 'resolve' }).encounter.startingResolve, source.encounter.startingResolve)
})

test('ranked bounded generation and automatic enemy choice reproduce the same seed', () => {
  const first = generateForEnemy('MELANCHOLY', 'ranking-repeat', quickOptions)
  const second = generateForEnemy('MELANCHOLY', 'ranking-repeat', quickOptions)
  assert.deepEqual(second, first)
  assert.equal(first.attempted, 2)
  assert.equal(first.ranked.length, 2)
  for (let index = 1; index < first.ranked.length; index += 1) {
    const previous = first.ranked[index - 1]
    const current = first.ranked[index]
    assert.ok(Number(previous.validation.accepted) >= Number(current.validation.accepted))
    if (previous.validation.accepted === current.validation.accepted) assert.ok(previous.quality.total >= current.quality.total)
  }
  const provider = { ...localLexicalProvider, enemyWords: () => ['MELANCHOLY', 'DESPAIR', 'XERO'] }
  const autoOptions = { ...quickOptions, provider, candidateCount: 1 }
  const auto = generatePuzzle('auto-repeat', autoOptions)
  assert.deepEqual(generatePuzzle('auto-repeat', autoOptions), auto)
  assert.ok(['MELANCHOLY', 'DESPAIR'].includes(auto.enemyWord!))
  assert.ok(auto.enemyRejections.some(enemy => enemy.word === 'XERO'))
  assert.ok(auto.ranked.every(item => item.candidate.encounter.startingTiles.length === 16))
})

test('punctuation and long mutation seeds retain distinct reversible candidate identities', () => {
  const colon = createCandidate('MELANCHOLY', 'same:seed')
  const dash = createCandidate('MELANCHOLY', 'same-seed')
  assert.notEqual(colon.id, dash.id)
  assert.equal(decodeURIComponent(colon.id.slice('generated-melancholy-'.length)), 'same:seed')
  const suffix = 'identical-suffix-that-is-longer-than-twenty-four-characters'
  const first = mutateCandidate(colon, `first:${suffix}`, { kind: 'tile-swap' })
  const second = mutateCandidate(colon, `second:${suffix}`, { kind: 'tile-swap' })
  assert.notEqual(first.id, second.id)
  assert.notEqual(mutateCandidate(colon, 'same:seed').id, mutateCandidate(colon, 'same-seed').id)
  let descendant = colon
  for (let generation = 0; generation < 12; generation += 1) {
    const previousId = descendant.id
    descendant = mutateCandidate(descendant, `generation:${generation}`, { kind: 'tile-swap' })
    assert.equal(descendant.provenance.parentId, previousId)
    assert.equal(descendant.provenance.rootId, colon.id)
    assert.ok(descendant.id.length < colon.id.length + 30)
  }
})

test('automatic fallback reports aggregate progress and keep zero still recognizes acceptance', () => {
  const progress: number[] = []
  const provider = { ...localLexicalProvider, enemyWords: () => ['MELANCHOLY', 'DESPAIR'] }
  const rejected = generatePuzzle('fallback-progress', {
    ...quickOptions, provider, candidateCount: 1,
    validation: { minimumWinningTurns: 100 },
    onProgress: event => progress.push(event.attempted),
  })
  assert.equal(rejected.attempted, 2)
  assert.deepEqual(progress, [1, 2])
  assert.equal(rejected.ranked.length, 2)
  assert.equal(rejected.acceptedCount, 0)
  const accepted = generatePuzzle('auto-keep-zero', {
    ...quickOptions, provider, candidateCount: 1, keep: 0,
    goal: { archetypes: [], description: 'Review result suppression does not change acceptance.' },
    validation: { minimumWinningTurns: 1, minimumReasonableOpenings: 0, requireSemanticImportance: false,
      minimumIntendedMechanicImportance: 0, maximumCriticalSinglePointLetters: 100,
      maximumPrematureDeadStateRate: 1, requireFamiliarWinningWitness: false },
  })
  assert.equal(accepted.attempted, 1)
  assert.equal(accepted.acceptedCount, 1)
  assert.deepEqual(accepted.accepted, [])
})

test('a parent winning trace is only a proposal when the mutated physical board changes', () => {
  const candidate = createCandidate('MELANCHOLY', 'construction-test:0')
  const oldIds = candidate.construction.plannedTileIds
  assert.ok(oldIds.length > 0)
  const mutated = structuredClone(candidate.encounter)
  const firstSelection = new Set(oldIds[0])
  mutated.startingTiles = mutated.startingTiles.map(tile => firstSelection.has(tile.id) ? { ...tile, letter: 'Z' } : tile)
  const result = solvePuzzle(mutated, { maxStates: 0, hintLine: oldIds })
  assert.equal(result.solvable, null)
  assert.deepEqual(result.winningLines, [])
})

test('greedy-trap validation separates absent tradeoffs from unproved observed alternatives', () => {
  const result = generateForEnemy('MELANCHOLY', 'greedy-gate', { ...quickOptions, candidateCount: 1 })
  const ranked = result.ranked[0]
  const candidate = { ...ranked.candidate, goal: { archetypes: ['greedy-trap'] as const, description: 'A declared trap needs evidence.' } }
  const absent = validatePuzzle({ ...candidate, goal: { ...candidate.goal, archetypes: [...candidate.goal.archetypes] } },
    { ...ranked.analysis, greedyTrapStrength: 0 })
  assert.ok(absent.reasons.some(reason => reason.code === 'missing-greedy-tradeoff'))
  const unproved = validatePuzzle({ ...candidate, goal: { ...candidate.goal, archetypes: [...candidate.goal.archetypes] } },
    { ...ranked.analysis, greedyTrapStrength: 0.25, isStrongestImmediateOptimal: null })
  assert.ok(unproved.warnings.some(reason => reason.code === 'greedy-trap-unproved'))
  assert.equal(unproved.reasons.some(reason => reason.code === 'missing-greedy-tradeoff'), false)
})
