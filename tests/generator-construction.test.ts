import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPartsOfSpeech } from '../src/game/dictionary.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import { canSpell, overlappingLetters } from '../src/generator/constructBoard.ts'
import { createCandidate } from '../src/generator/generate.ts'
import { currentLexicalProvider } from '../src/generator/lexicalProvider.ts'
import { mutateCandidate, mutationKinds } from '../src/generator/mutate.ts'
import { buildWordPools } from '../src/generator/wordPools.ts'
import { isMeaningCompilationCurrent } from '../src/generator/meaningCompiler.ts'
import { createStructuralCandidate, structuralWords } from './generator-fixture.ts'

test('seeded construction shares anchor letters, keeps 16 identities and guarantees opening anchors', () => {
  assert.deepEqual(overlappingLetters(['CHEER', 'CHEERY']).sort(), [...'CHEERY'].sort())
  for (let seed = 0; seed < 6; seed += 1) {
    const candidate = createStructuralCandidate('melancholy', `construction-test:${seed}`)
    assert.deepEqual(candidate, createStructuralCandidate('MELANCHOLY', `construction-test:${seed}`))
    assert.equal(candidate.encounter.startingTiles.length, 16)
    assert.equal(new Set(candidate.encounter.startingTiles.map(tile => tile.id)).size, 16)
    assert.equal(candidate.encounter.startingTiles.filter(tile => tile.gem === 'ward').length, 1)
    assert.equal(candidate.encounter.startingTiles.filter(tile => tile.gem === 'strike').length, 1)
    for (const anchor of candidate.anchors.filter(anchor => anchor.expected === 'opening')) {
      assert.equal(canSpell(anchor.word, candidate.encounter.startingTiles.map(tile => tile.letter)), true, anchor.word)
    }
    assert.doesNotThrow(() => createLetterStrikeGame(candidate.encounter))
    assert.ok(Object.keys(candidate.encounter.meaningLexicon!.words).some(word => !structuralWords.has(word)),
      'The fixture bounds construction, not the compiled gameplay dictionary.')
  }
  assert.notDeepEqual(createStructuralCandidate('MELANCHOLY', 'construction-test:0').encounter.startingTiles,
    createStructuralCandidate('MELANCHOLY', 'construction-test:1').encounter.startingTiles)
})

test('purposeful refill plans replay through the actual game with identical words and board slots', () => {
  let wins = 0
  for (let seed = 0; seed < 6; seed += 1) {
    const candidate = createStructuralCandidate('MELANCHOLY', `construction-test:${seed}`)
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

test('legacy-bonus serialized candidates retain their deterministic semantic and grammar annotations', () => {
  const candidate = createCandidate('MELANCHOLY', 'serialized-lexicon', { scoringMode: 'legacy-bonuses' })
  const pools = buildWordPools('MELANCHOLY', currentLexicalProvider, { grammarPolicy: 'any-recognized' })
  const restored = JSON.parse(JSON.stringify(candidate))
  assert.deepEqual(restored.encounter.enemy.semanticRelations, pools.semanticRelations)
  assert.deepEqual(restored.encounter.wordPartsOfSpeech, pools.wordPartsOfSpeech)
  assert.ok(restored.encounter.enemy.semanticRelations.opposite.includes('COMEDY'))
  assert.ok(restored.encounter.enemy.semanticRelations.similar.includes('GLOOMY'))
  assert.deepEqual(restored.encounter.wordPartsOfSpeech.GLOOMY, ['adjective'])
  assert.deepEqual(createLetterStrikeGame(restored.encounter), createLetterStrikeGame(candidate.encounter))
})

test('default serialized candidates carry the complete definition-backed meaning table without type or length bonuses', () => {
  const candidate = createCandidate('ANGER', 'serialized-meanings', { refillLimit: 12 })
  const restored = JSON.parse(JSON.stringify(candidate))
  assert.equal(restored.provenance.generatorVersion, 'letter-strike-generator-5')
  assert.equal(restored.construction.design, 'sustained-discovery')
  assert.equal(restored.encounter.meaningLexicon.policy, 'defined-only')
  assert.ok(Object.keys(restored.encounter.meaningLexicon.words).length > 0)
  assert.deepEqual(restored.encounter.meaningLexicon, candidate.encounter.meaningLexicon)
  assert.equal(isMeaningCompilationCurrent(restored.encounter), true)
  assert.deepEqual(restored.encounter.grammarModifiers, {})
  assert.equal(Object.hasOwn(restored.encounter, 'longWordRule'), false)
  assert.deepEqual(createLetterStrikeGame(restored.encounter), createLetterStrikeGame(candidate.encounter))
})

test('every unlimited mutation primitive is deterministic, preserves encounter validity and clears obsolete proof IDs', () => {
  const source = createStructuralCandidate('MELANCHOLY', 'mutation-primitives')
  // Give armour-copy an actual alternative: the first L is armoured, its copy is not.
  let firstL = true
  source.encounter.enemyLetters = source.encounter.enemyLetters.map(letter => {
    if (letter.letter !== 'L') return letter
    const hits = firstL ? 2 : 1
    firstL = false
    return { ...letter, initialHits: hits, hitsRemaining: hits }
  })
  const before = structuredClone(source)
  for (const kind of mutationKinds.filter(kind => kind !== 'refill-length')) {
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
