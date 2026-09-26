import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { analyseSemanticJourney, semanticJourneyKey } from '../src/generator/semanticJourney.ts'
import { replenishSemanticChoices } from '../src/generator/discoveryDesign.ts'
import { canSpell } from '../src/generator/constructBoard.ts'
import { createRandom } from '../src/generator/random.ts'
import { validatePuzzle } from '../src/generator/validate.ts'
import { scorePuzzle } from '../src/generator/score.ts'
import type { RankedCandidate } from '../src/generator/generate.ts'
import { findSpecialOpeningHints } from '../src/generator/strategyHints.ts'
import { placeSpecialTiles } from '../src/generator/placeSpecialTiles.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'

const saved = JSON.parse(gunzipSync(readFileSync(new URL('../artifacts/meaning-v3/selected.json.gz', import.meta.url))).toString()) as RankedCandidate
const encounter = saved.candidate.encounter
const journey = analyseSemanticJourney(encounter, saved.analysis.winningLines)

test('the player-reported one-counter-then-neutral problem is detected by real replay', () => {
  const halcyonRuns = journey.chipAwayRuns.filter(run => run.opening === 'HALCYON')
  assert.equal(halcyonRuns.length, 2)
  for (const run of halcyonRuns) {
    let state = createLetterStrikeGame(encounter)
    for (const [turn, move] of run.moves.entries()) {
      state = submitLetterStrike(state, move.tileIds)
      assert.equal(state.error, null)
      assert.equal(state.playedWords.at(-1)!.semanticLabel, turn === 0 ? 'COUNTER' : 'NEUTRAL')
    }
    assert.equal(state.status, 'won')
  }
  assert.ok(journey.chipAwayWinRate! > 0.2)
  const analysis = { ...saved.analysis, semanticJourney: journey }
  const validation = validatePuzzle(saved.candidate, analysis, { requireSustainedSemantics: true })
  assert.ok(validation.reasons.some(reason => reason.code === 'easy-neutral-chip-away'))
  assert.ok(validation.reasons.some(reason => reason.code === 'fading-enemy-theme'))
  assert.ok(scorePuzzle(saved.candidate, analysis).components.find(component => component.name === 'neutralChipAway')!.contribution < 0)
})

test('journey branches include resisted and neutral choices and reach the late game', () => {
  assert.equal(journey.exhaustive, false)
  assert.ok(journey.positions.some(position => position.depth >= 3))
  const labels = new Set(journey.positions.filter(position => position.depth === 1).map(position => {
    const state = submitLetterStrike(createLetterStrikeGame(encounter), position.prefix[0].tileIds)
    return state.playedWords[0].semanticLabel
  }))
  assert.deepEqual(labels, new Set(['COUNTER', 'NEUTRAL', 'RESISTED']))
  assert.ok(journey.positions[0].discoveryWords.includes('HALCYON'), 'Optional literary discoveries must survive the commonness cutoff.')
  assert.ok(journey.byDepth.at(-1)!.counterChoiceRate < journey.byDepth[0].counterChoiceRate,
    'A strong opening must not disguise later exhausted counter choices.')
})

test('meaning bonuses disappear at one remaining HP without inventing a missing advantage', () => {
  const lastHit = { ...encounter, enemyLetters: [{ ...encounter.enemyLetters[0], initialHits: 1, hitsRemaining: 1 }] }
  const report = analyseSemanticJourney(lastHit, [], { maxDepth: 1, statesPerDepth: 2 })
  assert.equal(report.byDepth[0].meaningAdvantageRate, null)
  assert.equal(report.sustainedWinningRouteRate, null)
  assert.equal(report.routes.length, 0)
})

test('an exhausted board is reported as a counter drought, not a successful empty sample', () => {
  const barren = { ...encounter, startingTiles: encounter.startingTiles.map(tile => ({ ...tile, letter: 'Z' })) }
  // Remove the frozen dictionary: this fixture tests traversal, not compilation validity.
  const { meaningLexicon: _meanings, ...fixture } = barren
  const report = analyseSemanticJourney(fixture)
  assert.equal(report.positions[0].counterLemmas, 0)
  assert.equal(report.laterCounterChoiceRate, null)
  assert.equal(report.chipAwayRuns.every(run => run.status === 'playing'), true)
})

test('edited rules invalidate the journey and a shortened sample cannot satisfy the design gate', () => {
  const changed = structuredClone(saved.candidate)
  changed.encounter.refillQueue = [...changed.encounter.refillQueue].reverse().join('')
  assert.notEqual(semanticJourneyKey(changed.encounter), journey.encounterKey)
  assert.ok(validatePuzzle(changed, { ...saved.analysis, semanticJourney: journey }, { requireSustainedSemantics: true })
    .reasons.some(reason => reason.code === 'missing-semantic-journey'))
  assert.ok(validatePuzzle(saved.candidate, { ...saved.analysis, semanticJourney: { ...journey, sampling: { ...journey.sampling, maxDepth: 1 } } },
    { requireSustainedSemantics: true }).reasons.some(reason => reason.code === 'missing-semantic-journey'))
  assert.throws(() => analyseSemanticJourney(encounter, [{ moves: [{ word: 'HALCYON', tileIds: [0] }] }]), /replayable/)
  assert.throws(() => analyseSemanticJourney(encounter, [], { statesPerDepth: 0 }), /sampling/)
})

test('spare refills restore a thematic alternative while preserving the intended counter', () => {
  const block = replenishSemanticChoices([...'CALM'], ['S'], 4, ['CALMS', 'CLEAR'], ['CLAMOR'], createRandom('theme'))
  assert.equal(block.length, 4)
  assert.ok(canSpell('CALMS', [...'CALM', ...block]))
  assert.ok(canSpell('CLAMOR', [...'CALM', ...block]))
  assert.deepEqual(block, replenishSemanticChoices([...'CALM'], ['S'], 4, ['CALMS', 'CLEAR'], ['CLAMOR'], createRandom('theme')))
})

test('Hit probes find an actual resisted-opening win and respect a zero search budget', () => {
  const fixture: LetterStrikeEncounter = {
    id: 'special-probe-fixture', enemy: { word: 'CA', definition: 'test', partOfSpeech: 'noun',
      semanticRelations: { opposite: ['COW'], similar: ['CAT'], related: [] } },
    enemyLetters: [...'CA'].map((letter, index) => ({ id: `enemy-${index}`, letter, initialHits: 1, hitsRemaining: 1 })),
    startingTiles: [...'CATCOWZZZZZZZZZZ'].map((letter, id) => ({ id, letter, type: id === 1 ? 'gem' : 'normal', ...(id === 1 ? { gem: 'strike' as const } : {}) })),
    startingResolve: 3, minimumWordLength: 3, refillQueue: 'E'.repeat(64), grammarModifiers: {},
    tileEffects: { strike: { strike: true, preventResolveLoss: false } },
  }
  const options = { vocabulary: ['CAT', 'COW'], wordCommonness: () => 1, maxStates: 20 }
  const result = findSpecialOpeningHints(fixture, options)
  assert.equal(result.hints.length, 1)
  let state = createLetterStrikeGame(fixture)
  for (const ids of result.hints[0]) state = submitLetterStrike(state, ids)
  assert.equal(state.status, 'won')
  assert.equal(state.playedWords[0].semanticLabel, 'RESISTED')
  assert.deepEqual(findSpecialOpeningHints(fixture, { ...options, maxStates: 0 }), { hints: [], statesExplored: 0 })
})

test('multiple Revive placement is deterministic and retains distinct physical special tiles', () => {
  const board = [...'CHAOSCHAOSCALMER'].map((letter, id) => ({ id, letter, type: 'normal' as const }))
  for (const regenTileCount of [0, 1, 2, 3]) {
    const placed = placeSpecialTiles(board, 'CHAOS', ['CALMS'], ['CHAOS'], createRandom('revives'), { regenTileCount, includeRegenTile: true })
    assert.equal(placed.filter(tile => tile.gem === 'regen').length, regenTileCount)
    assert.equal(placed.filter(tile => tile.gem === 'ward').length, 1)
    assert.equal(placed.filter(tile => tile.gem === 'strike').length, 1)
    assert.equal(new Set(placed.map(tile => tile.id)).size, 16)
    assert.deepEqual(placed, placeSpecialTiles(board, 'CHAOS', ['CALMS'], ['CHAOS'], createRandom('revives'), { regenTileCount }))
  }
  assert.ok(board.every(tile => tile.type === 'normal'))
})
