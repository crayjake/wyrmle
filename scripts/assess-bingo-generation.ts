/** Reproducible authoring experiment. Writes reports only; no game, daily or model-cache edits. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { bingoEncounter } from '../src/experimental/bingo/puzzle.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { EnemyLetter, LetterStrikeEncounter, LetterStrikeState } from '../src/game/letterStrike.ts'
import { meaningLexicalProvider as provider, withCompiledMeanings } from '../src/generator/meaningCompiler.ts'
import { semanticAssessmentProvider } from '../src/generator/semanticAssessments.ts'
import { semanticRefinementProvider } from '../src/generator/semanticRefinement.ts'
import { letterCounts, canSpell, constructBoard, overlappingLetters } from '../src/generator/constructBoard.ts'
import { constructRefill, selectWordIds } from '../src/generator/constructRefill.ts'
import { rankDiscoveryAnchors, rankThematicAnchors } from '../src/generator/discoveryDesign.ts'
import { buildWordPools } from '../src/generator/wordPools.ts'
import { createRandom } from '../src/generator/random.ts'
import { findPlayableWords } from '../src/generator/findMoves.ts'
import { getGenerationWordCommonness } from '../src/generator/familiarity.ts'

const directory = 'artifacts/bingo-feasibility-2026-09-26'
const started = performance.now()
const frequency = (word: string) => getGenerationWordCommonness(word) ?? 0
const hp = (state: LetterStrikeState) => state.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)
const round = (value: number) => Math.round(value * 1000) / 1000
const settings = { seedsPerPair: 2, familiarCounterRoots: 4, highDamageCounterRoots: 4, neutralRoots: 2, resistedRoots: 2,
  beamWidth: 12, childrenPerState: 8, maximumTurns: 5, refillLength: 24,
  counterCommonness: 0.4, ordinaryCommonness: 0.5, minimumCounterLength: 4 }

/** Each enemy position has at most one armour layer; repeated non-enemy letters do not count. */
function armourFromBingo(enemy: string, bingo: string): EnemyLetter[] {
  assert.ok(canSpell(enemy, [...bingo]))
  const spare = letterCounts(bingo)
  for (const letter of enemy) spare.set(letter, spare.get(letter)! - 1)
  return [...enemy].map((letter, index) => {
    const armoured = spare.get(letter)! > 0
    if (armoured) spare.set(letter, spare.get(letter)! - 1)
    const hits = armoured ? 2 : 1
    return { id: `enemy-${index}`, letter, initialHits: hits, hitsRemaining: hits }
  })
}
// Check duplicate enemy positions as well as the actual single-letter examples.
assert.deepEqual(armourFromBingo('EER', 'EEEERR').map(letter => letter.initialHits), [2, 2, 2])
assert.equal(armourFromBingo('CHAOS', 'ORCHESTRATES').filter(letter => letter.initialHits === 2).length, 1)

const inventory = provider.enemyWords().map(enemy => {
  const entry = provider.getEntry(enemy)!
  const words = entry.counters.filter(word => word.length <= 16 && canSpell(enemy, [...word]))
  const meanings = semanticRefinementProvider.refine(enemy, Object.fromEntries(words.map(word =>
    [word, semanticAssessmentProvider.word(enemy, word)]))).words
  const candidates = words.map(word => ({ word, lemma: meanings[word].lemma,
    armour: armourFromBingo(enemy, word).filter(letter => letter.initialHits === 2).map(letter => letter.letter),
    freeTiles: 16 - word.length, commonness: frequency(word), definition: meanings[word].definition,
    evidence: meanings[word].evidence,
  })).sort((a, b) => b.commonness - a.commonness || a.word.localeCompare(b.word))
  const eligible = candidates.filter(candidate => candidate.armour.length >= 2)
  return { enemy, letterCoveringSpellings: words.length, letterCoveringLemmas: new Set(candidates.map(c => c.lemma)).size,
    twoArmourSpellings: eligible.length, twoArmourLemmas: new Set(eligible.map(c => c.lemma)).size,
    twoArmourObservedSpellings: eligible.filter(c => c.commonness > 0).length,
    twoArmourAtLeastPointFour: eligible.filter(c => c.commonness >= 0.4).length, candidates }
})

const pairs = [['CHAOS', 'CHOREOGRAPHS'], ['ANGER', 'ENDEARING'], ['ANGER', 'ENCOURAGEMENT'],
  ['CRUELTY', 'RESPECTFULLY'], ['FEAR', 'SAFEGUARDED']] as const
function construct(enemy: string, bingo: string, seedIndex: number) {
  const timer = performance.now()
  const seed = `bingo-feasibility:${enemy}:${bingo}:${seedIndex}`
  const random = createRandom(seed)
  const pools = buildWordPools(enemy, provider, { minimumCounterCommonness: 0.4, maximumLength: 16 })
  const counters = rankDiscoveryAnchors(pools.counters, enemy).filter(entry => entry.word !== bingo)
  const resisted = rankThematicAnchors(pools.resisted, enemy)
  const anchors = [bingo]
  for (const pool of [resisted, counters, resisted, counters]) {
    const compatible = pool.filter(entry => entry.word.length >= 4 && !anchors.includes(entry.word)
      && overlappingLetters([...anchors, entry.word]).length <= 16)
    if (compatible.length) anchors.push(random.pick(compatible.slice(0, 8)).word)
  }
  const startingTiles = constructBoard(anchors, [...resisted, ...counters].map(entry => entry.word), random)
  const entry = provider.getEntry(enemy)!
  const shell: LetterStrikeEncounter = { id: seed,
    enemy: { word: enemy, definition: entry.definition, partOfSpeech: entry.partsOfSpeech[0], semanticRelations: pools.semanticRelations },
    startingTiles, enemyLetters: armourFromBingo(enemy, bingo), startingResolve: 5,
    refillQueue: 'E'.repeat(settings.refillLength), finiteRefills: true, minimumWordLength: 3,
    grammarModifiers: {}, tileEffects: bingoEncounter.tileEffects }
  // The same queue and board serve all life counts. Plan for three turns, then allow up to five.
  // Exclude one-word kills from planning: they supply no evidence about alternative routes.
  const planningWords = pools.all.filter(entry => !canSpell(enemy, [...entry.word])
    || !shell.enemyLetters.every(letter => (letterCounts(entry.word).get(letter.letter) ?? 0)
      >= (letterCounts(enemy).get(letter.letter) ?? 0) + shell.enemyLetters.filter(other => other.letter === letter.letter && other.initialHits === 2).length))
  const refill = constructRefill(shell, planningWords, random, 3, settings.refillLength, {
    counters: counters.slice(0, 32).map(entry => entry.word), resisted: resisted.slice(0, 32).map(entry => entry.word) })
  const encounter = withCompiledMeanings({ ...shell, refillQueue: refill.refillQueue })
  assert.equal(encounter.meaningLexicon!.words[bingo]?.relation, 'opposite')
  const state = createLetterStrikeGame(encounter)
  const ids = selectWordIds(state.tiles, bingo)!
  assert.equal(submitLetterStrike(state, ids).status, 'won')
  return { enemy, bingo, seed, anchors, encounter, constructionMilliseconds: round(performance.now() - timer), plannedWords: refill.construction.plannedWords }
}

type Choice = { word: string; ids: number[]; label: 'COUNTER' | 'NEUTRAL' | 'RESISTED'; hits: number; lemma: string; familiarity: number }
type Node = { state: LetterStrikeState; moves: Choice[] }
type PositionSample = { remainingHP: number; counters: number; advantagedCounters: number; resisted: number; neutral: number;
  salientWords: { word: string; label: Choice['label'] }[] }
const familiarFirst = (a: Choice, b: Choice) => b.familiarity - a.familiarity || a.word.length - b.word.length || a.word.localeCompare(b.word)
function families(items: Choice[], maximum: number) {
  const seen = new Set<string>()
  return items.filter(item => { if (seen.has(item.lemma)) return false; seen.add(item.lemma); return true }).slice(0, maximum)
}
function analyse(encounter: LetterStrikeEncounter) {
  const timer = performance.now()
  const initial = createLetterStrikeGame({ ...encounter, startingResolve: 5 })
  const lexicon = encounter.meaningLexicon!.words
  const vocabulary = Object.keys(lexicon).filter(word => word.length >= (lexicon[word].relation === 'opposite' ? settings.minimumCounterLength : 3)
    && frequency(word) >= (lexicon[word].relation === 'opposite' ? settings.counterCommonness : settings.ordinaryCommonness))
  const key = (state: LetterStrikeState) => `${state.tiles.map(tile => `${tile.id}:${tile.letter}`).join(',')}|${state.refillIndex}|${state.enemyLetters.map(letter => letter.hitsRemaining).join('')}|${state.playerResolve}`
  const cache = new Map<string, Choice[]>()
  let movesInspected = 0
  function choices(state: LetterStrikeState) {
    const id = key(state)
    const existing = cache.get(id)
    if (existing) return existing
    const result = findPlayableWords(state, vocabulary).flatMap(word => {
      const ids = selectWordIds(state.tiles, word)!
      const preview = previewLetterStrike(state, ids)
      movesInspected++
      return preview.valid ? [{ word, ids, label: preview.semanticLabel, hits: preview.strikes,
        lemma: lexicon[word].lemma, familiarity: frequency(word) }] : []
    }).sort(familiarFirst)
    cache.set(id, result)
    return result
  }
  const available = choices(initial)
  // A guaranteed bingo must not conceal weak ordinary play. Exclude every initial
  // instant-win spelling throughout the alternative-route search, including later turns.
  const instantWins = findPlayableWords(initial).filter(word => lexicon[word].relation === 'opposite')
    .filter(word => {
      const ids = selectWordIds(initial.tiles, word)!
      return previewLetterStrike(initial, ids).strikes >= hp(initial)
    })
  const bingoWords = new Set(instantWins)
  const nonBingoCounters = available.filter(move => move.label === 'COUNTER' && move.hits > 0 && !bingoWords.has(move.word))
  const familiarCounters = families(nonBingoCounters, settings.familiarCounterRoots)
  const familiarLemmas = new Set(familiarCounters.map(move => move.lemma))
  const highDamageCounters = families(nonBingoCounters.filter(move => !familiarLemmas.has(move.lemma))
    .sort((a, b) => b.hits - a.hits || familiarFirst(a, b)), settings.highDamageCounterRoots)
  const roots = [
    ...familiarCounters, ...highDamageCounters,
    ...families(available.filter(move => move.label === 'NEUTRAL' && move.hits > 0), settings.neutralRoots),
    ...families(available.filter(move => move.label === 'RESISTED' && move.word.length >= 4), settings.resistedRoots),
  ]
  function replay(line: Choice[], lives: number) {
    let state = createLetterStrikeGame({ ...encounter, startingResolve: lives })
    for (const move of line) {
      if (state.status !== 'playing') break
      state = submitLetterStrike(state, move.ids)
      assert.equal(state.error, null)
      assert.equal(state.playedWords.at(-1)!.word, move.word)
    }
    return state
  }
  const describeLine = (line: Choice[]) => ({ words: line.map(move => move.word), tileIds: line.map(move => move.ids),
    labels: line.map(move => move.label), hits: line.map(move => move.hits) })
  const rootReports = roots.map(root => {
    const after = submitLetterStrike(initial, root.ids)
    const next = choices(after)
    const stock = letterCounts(after.tiles.map(tile => tile.letter).join('') + encounter.refillQueue.slice(after.refillIndex))
    const required = new Map<string, number>()
    for (const letter of after.enemyLetters) required.set(letter.letter, (required.get(letter.letter) ?? 0) + letter.hitsRemaining)
    const supplyDeficits = [...required].filter(([letter, needed]) => (stock.get(letter) ?? 0) < needed)
      .map(([letter, needed]) => ({ letter, needed, available: stock.get(letter) ?? 0 }))
    let frontier: Node[] = [{ state: after, moves: [root] }]
    let witness: Choice[] | null = null
    let expanded = 0
    for (let depth = 2; depth <= settings.maximumTurns && frontier.length && !witness; depth++) {
      const children: Node[] = []
      for (const node of frontier) {
        expanded++
        const options = choices(node.state).filter(move => !bingoWords.has(move.word))
        const winner = options.find(move => move.hits >= hp(node.state))
        if (winner) { witness = [...node.moves, winner]; break }
        if (depth === settings.maximumTurns) continue
        const productive = options.filter(move => move.hits > 0)
        const branches = families(productive.filter(move => move.label === 'COUNTER')
          .sort((a, b) => b.hits - a.hits || familiarFirst(a, b)), 5)
        branches.push(...families(productive.filter(move => move.label === 'NEUTRAL'), 3))
        for (const move of branches.slice(0, settings.childrenPerState)) {
          const state = submitLetterStrike(node.state, move.ids)
          if (state.status === 'playing') children.push({ state, moves: [...node.moves, move] })
        }
      }
      const seen = new Set<string>()
      frontier = children.sort((a, b) => hp(a.state) - hp(b.state)
        || b.moves.reduce((sum, move) => sum + move.familiarity, 0) - a.moves.reduce((sum, move) => sum + move.familiarity, 0))
        .filter(node => { const id = key(node.state); if (seen.has(id)) return false; seen.add(id); return true }).slice(0, settings.beamWidth)
    }
    if (witness) for (const lives of [3, 4, 5].filter(lives => lives >= witness!.length)) assert.equal(replay(witness, lives).status, 'won')
    if (supplyDeficits.length) assert.equal(witness, null)
    const chipRuns = ['familiar', 'shortest'].map(policy => {
      let state = after
      const moves = [root]
      while (state.status === 'playing') {
        const neutral = choices(state).filter(move => move.label === 'NEUTRAL' && move.hits > 0)
          .sort((a, b) => (policy === 'shortest' ? a.word.length - b.word.length : 0) || familiarFirst(a, b))
        const move = neutral[0]
        if (!move) break
        moves.push(move)
        state = submitLetterStrike(state, move.ids)
      }
      const winsAtLives = [3, 4, 5].filter(lives => replay(moves, lives).status === 'won')
      return { policy, ...describeLine(moves), statusWithFive: state.status, winsAtLives }
    })
    return { word: root.word, label: root.label, hits: root.hits, remainingHP: hp(after), supplyDeficits,
      nextCounterFamilies: new Set(next.filter(move => move.label === 'COUNTER' && move.hits > 0).map(move => move.lemma)).size,
      nextAdvantagedCounterFamilies: new Set(next.filter(move => move.label === 'COUNTER' && move.hits > 1).map(move => move.lemma)).size,
      nextResistedFamilies: new Set(next.filter(move => move.label === 'RESISTED' && move.word.length >= 4).map(move => move.lemma)).size,
      nextCounterExamples: families(next.filter(move => move.label === 'COUNTER' && move.hits > 1), 8).map(move => move.word),
      nextResistedExamples: families(next.filter(move => move.label === 'RESISTED' && move.word.length >= 4), 8).map(move => move.word),
      witness: witness ? describeLine(witness) : null, expanded, chipRuns }
  })
  // A matched per-depth sample across life budgets. These are live-board options, not guaranteed safe choices.
  let layer: LetterStrikeState[] = [initial]
  const layers: { nextTurn: number; positions: PositionSample[] }[] = []
  for (let depth = 0; depth < 5 && layer.length; depth++) {
    const positions = layer.map(state => {
      const options = choices(state).filter(move => !bingoWords.has(move.word))
      const counter = options.filter(move => move.label === 'COUNTER' && move.hits > 0)
      const resisted = options.filter(move => move.label === 'RESISTED' && move.word.length >= 4)
      return { remainingHP: hp(state), counters: new Set(counter.map(move => move.lemma)).size,
        advantagedCounters: new Set(counter.filter(move => move.hits > 1).map(move => move.lemma)).size,
        resisted: new Set(resisted.map(move => move.lemma)).size,
        neutral: new Set(options.filter(move => move.label === 'NEUTRAL').map(move => move.lemma)).size,
        salientWords: options.filter(move => move.word.length >= 4).slice(0, 12).map(move => ({ word: move.word, label: move.label })) }
    })
    layers.push({ nextTurn: depth + 1, positions })
    const groups = layer.map(state => {
      const options = choices(state).filter(move => !bingoWords.has(move.word))
      return ['RESISTED', 'COUNTER', 'NEUTRAL'].flatMap(label => families(options.filter(move => move.label === label && move.word.length >= 4), 2))
        .map(move => submitLetterStrike(state, move.ids)).filter(next => next.status === 'playing')
    })
    layer = []
    const seen = new Set<string>()
    for (let rank = 0; rank < 6 && layer.length < 8; rank++) for (const group of groups) {
      const state = group[rank]
      if (!state || layer.length >= 8 || seen.has(key(state))) continue
      seen.add(key(state)); layer.push(state)
    }
  }
  const byLives = [3, 4, 5].map(lives => {
    const rescued = rootReports.filter(root => root.witness && root.witness.words.length <= lives)
    const chipWins = rootReports.filter(root => root.chipRuns.some(run => run.winsAtLives.includes(lives)))
    const extendedChipWins = rootReports.filter(root => root.label === 'COUNTER'
      && root.chipRuns.some(run => run.words.length >= 3 && run.winsAtLives.includes(lives)))
    const supplyDead = rootReports.filter(root => root.supplyDeficits.length > 0)
    const later = layers.filter(layer => layer.nextTurn > 1 && layer.nextTurn <= lives).flatMap(layer => layer.positions)
    return { lives, sampledOpenings: roots.length, openingsWithWitness: rescued.length,
      unknownWithinBudget: roots.length - rescued.length - supplyDead.length, supplyDeadOpenings: supplyDead.length,
      counterThenNeutralWinningOpenings: chipWins.filter(root => root.label === 'COUNTER').length,
      counterThenTwoOrMoreNeutralsWinningOpenings: extendedChipWins.length,
      laterBoardsSampled: later.length, laterBoardsWithTwoCounterFamiliesAndBait: later.filter(p => p.counters >= 2 && p.resisted >= 1).length,
      laterBoardsWithMeaningAdvantage: later.filter(p => p.remainingHP > 1 && p.advantagedCounters > 0).length,
      laterBoardsWithMoreThanOneHP: later.filter(p => p.remainingHP > 1).length }
  })
  return { byLives, rootReports, layers, start: { familiarCounterFamilies: new Set(available.filter(move => move.label === 'COUNTER').map(move => move.lemma)).size,
    familiarResistedFamilies: new Set(available.filter(move => move.label === 'RESISTED' && move.word.length >= 4).map(move => move.lemma)).size,
    immediateWinningWords: instantWins,
    familiarImmediateWinningWords: available.filter(move => move.hits >= hp(initial)).map(move => move.word) },
    runtime: { milliseconds: round(performance.now() - timer), uniquePositionsInspected: cache.size, movesInspected } }
}

mkdirSync(directory, { recursive: true })
writeFileSync(`${directory}/inventory.json`, JSON.stringify(inventory, null, 2) + '\n')
const candidates: (Omit<ReturnType<typeof construct>, 'encounter'> & {
  board: string; refills: string; armour: string[]; enemyHP: number; meaningWords: number; analysis: ReturnType<typeof analyse>;
})[] = []
for (const [enemy, bingo] of pairs) for (let index = 0; index < settings.seedsPerPair; index++) {
  const generated = construct(enemy, bingo, index)
  const analysis = analyse(generated.encounter)
  const { encounter, ...construction } = generated
  const candidate = { ...construction, board: encounter.startingTiles.map(tile => tile.letter).join(''), refills: encounter.refillQueue,
    armour: encounter.enemyLetters.filter(letter => letter.initialHits === 2).map(letter => letter.letter),
    enemyHP: hp(createLetterStrikeGame(encounter)), meaningWords: Object.keys(encounter.meaningLexicon!.words).length,
    analysis }
  candidates.push(candidate)
  writeFileSync(`${directory}/candidates.json`, JSON.stringify(candidates, null, 2) + '\n')
  console.log(JSON.stringify({ seed: generated.seed, byLives: analysis.byLives, runtime: analysis.runtime }))
}
const control = analyse(bingoEncounter)
const chipControl = [3, 4, 5].map(lives => {
  let state = createLetterStrikeGame({ ...bingoEncounter, startingResolve: lives })
  for (const word of ['CALMS', 'HEN', 'OAR', 'SEA']) {
    if (state.status !== 'playing') break
    const ids = selectWordIds(state.tiles, word)!
    assert.ok(ids)
    state = submitLetterStrike(state, ids)
    assert.equal(state.error, null)
  }
  return { lives, words: state.playedWords.map(move => move.word), status: state.status, livesLeft: state.playerResolve }
})
// Check the actual distinction between LIFE (player) and REVIVE (enemy), rather
// than treating both as a generic fourth turn. L is spare to ORCHESTRATES; S is mandatory.
const specialControls = (['ward', 'regen'] as const).map(gem => {
  const markedTile = bingoEncounter.startingTiles.find(tile => tile.letter === (gem === 'ward' ? 'L' : 'S'))!
  const encounter: LetterStrikeEncounter = { ...bingoEncounter, startingResolve: 3,
    startingTiles: bingoEncounter.startingTiles.map(tile => tile.id === markedTile.id ? { ...tile, type: 'gem', gem } : tile),
    tileEffects: { ...bingoEncounter.tileEffects, regen: { strike: false, preventResolveLoss: false, regenerate: true } } }
  let state = createLetterStrikeGame(encounter)
  const line = gem === 'ward' ? ['CALMS', 'HEN', 'OAR', 'SEA'] : ['ORCHESTRATES']
  for (const word of line) {
    const ids = selectWordIds(state.tiles, word)!
    assert.ok(ids)
    state = submitLetterStrike(state, ids)
    assert.equal(state.error, null)
  }
  assert.equal(state.status, gem === 'ward' ? 'won' : 'playing')
  assert.equal(state.playerResolve, gem === 'ward' ? 0 : 2)
  assert.equal(hp(state), gem === 'ward' ? 0 : 1)
  return { gem, letter: markedTile.letter, words: line, status: state.status, livesLeft: state.playerResolve, enemyHP: hp(state) }
})
const aggregate = [3, 4, 5].map(lives => {
  const rows = candidates.map(candidate => candidate.analysis.byLives.find(row => row.lives === lives)!)
  const sum = (field: keyof typeof rows[number]) => rows.reduce((n, row) => n + row[field], 0)
  return { lives, candidates: candidates.length, sampledOpenings: sum('sampledOpenings'), witnessedWinningOpenings: sum('openingsWithWitness'),
    unknownWithinBudget: sum('unknownWithinBudget'), counterThenNeutralWinningOpenings: sum('counterThenNeutralWinningOpenings'),
    supplyDeadOpenings: sum('supplyDeadOpenings'), counterThenTwoOrMoreNeutralsWinningOpenings: sum('counterThenTwoOrMoreNeutralsWinningOpenings'),
    laterBoardsSampled: sum('laterBoardsSampled'), laterBoardsWithTwoCounterFamiliesAndBait: sum('laterBoardsWithTwoCounterFamiliesAndBait'),
    laterBoardsWithMeaningAdvantage: sum('laterBoardsWithMeaningAdvantage'), laterBoardsWithMoreThanOneHP: sum('laterBoardsWithMoreThanOneHP') }
})
const semanticSpotChecks = [
  { enemy: 'ANGER', word: 'FERMENTING', concern: 'The stored agitation/excitement sense does not establish an antidote to anger. The explanation jumps to DELIGHT.' },
  { enemy: 'DESPAIR', word: 'PATRONISED', concern: 'Being a regular customer does not establish hope or encouragement. The explanation substitutes ENCOURAGE.' },
].map(({ enemy, word, concern }) => ({ enemy, word, concern,
  stored: semanticRefinementProvider.refine(enemy, { [word]: semanticAssessmentProvider.word(enemy, word) }).words[word] }))
const report = { scope: 'bingo-first-feasibility-study-not-published-content', dailyPublicationReady: false,
  node: process.version, settings, aggregate, control: { ...control, chipControl, specialControls },
  semanticSpotChecks,
  totalMilliseconds: round(performance.now() - started),
  limitations: [
    'Existing model-labelled pools are proposals, not independently certified semantic truth. No new contextual model review was performed.',
    'Two fixed seeds for each of five hand-selected enemy/bingo pairs; no random sample of all enemies or player study.',
    'One canonical physical selection per word; bounded beam, familiar vocabulary, and productive continuations only. Search misses remain unknown. A separate missing-letter-supply check can prove a particular post-opening state impossible.',
    'All three life counts reuse the same board and 24-letter finite queue planned for three turns. This isolates life count, not the best separately optimised design for each budget.',
    'Witness depth is the shortest found within this bounded search, not a certified minimum.',
    'All opening instant-win spellings are excluded throughout alternative-route searches and board sampling; a bingo alone cannot make a candidate pass.',
    'Category mix is measured on sampled reachable boards, including losing trajectories; it does not establish safe continuations or human salience.',
  ] }
writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ aggregate, chipControl, totalMilliseconds: report.totalMilliseconds }))
