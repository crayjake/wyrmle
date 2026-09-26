import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike.ts'
import { getEncounterSemanticRelation } from '../game/meaningLexicon.ts'
import { selectWordIds } from './constructRefill.ts'
import { findPlayableWords } from './findMoves.ts'
import { getGenerationWordCommonness } from './familiarity.ts'
import { sha256 } from './sha256.ts'
import { stateKey } from './stateKey.ts'

type Route = { moves: readonly { word: string; tileIds: readonly number[] }[] }
type Step = { word: string; tileIds: number[] }
type Choice = Step & { lemma: string; label: 'COUNTER' | 'RESISTED' | 'NEUTRAL'; commonness: number; netHits: number; meaningGain: number }
export type SemanticJourneyOptions = {
  maxDepth?: number
  statesPerDepth?: number
  wordCommonness?: (word: string) => number | null
}
export type JourneyPosition = {
  depth: number
  prefix: Step[]
  board: string
  remainingHits: number
  lives: number
  counterWords: string[]
  counterLemmas: number
  familiarCounterLemmas: number
  advantagedCounterLemmas: number
  resistedWords: string[]
  salientWords: string[]
  /** Less frequent than the most familiar resisted word, not a claim about human difficulty. */
  discoveryWords: string[]
  /** All remaining letter types are present, but the resisted meaning yields no damage. */
  temptingResistedFinishers: string[]
  counterFinishers: string[]
}
export type SemanticJourney = {
  version: 1
  encounterKey: string
  scope: 'bounded-branch-sample-and-exact-route-replays'
  exhaustive: false
  sampling: { maxDepth: number; statesPerDepth: number; counterCommonness: number; familiarCommonness: number; source: string }
  positions: JourneyPosition[]
  byDepth: { depth: number; states: number; counterChoiceRate: number; resistedPresenceRate: number; meaningAdvantageRate: number | null }[]
  laterCounterChoiceRate: number | null
  laterResistedPresenceRate: number | null
  laterMeaningAdvantageRate: number | null
  routes: { words: string[]; counterTurns: number[]; advantagedCounterTurns: number[]; neutralTail: number; newCounterWords: string[] }[]
  sustainedWinningRouteRate: number | null
  /** A witnessed easy fallback is evidence against the design; its absence proves nothing. */
  chipAwayRuns: { opening: string | null; policy: 'familiar' | 'damage'; moves: Step[]; status: LetterStrikeState['status'] }[]
  chipAwayWinRate: number | null
}

const COUNTER_COMMONNESS = 0.4 // Includes optional discoveries such as HALCYON.
const FAMILIAR_COMMONNESS = 0.5
const fraction = <T>(values: T[], predicate: (value: T) => boolean): number | null => values.length
  ? values.filter(predicate).length / values.length : null
export const semanticJourneyKey = (encounter: LetterStrikeEncounter) => sha256(stateKey(createLetterStrikeGame(encounter)))

/** This is a design diagnostic, separate from semantic correctness and solvability.
 * It deliberately samples resisted and ordinary words, including zero-hit bait,
 * instead of calling the solver's damage-first moves a model of human attention.
 * Each word tries two physical selections (save/use specials); never an all-path proof.
 */
export function analyseSemanticJourney(encounter: LetterStrikeEncounter, lines: readonly Route[] = [], options: SemanticJourneyOptions = {}): SemanticJourney {
  const maxDepth = options.maxDepth ?? 4, statesPerDepth = options.statesPerDepth ?? 6
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 8
    || !Number.isInteger(statesPerDepth) || statesPerDepth < 1 || statesPerDepth > 32) throw new Error('Journey sampling needs depth 1–8 and 1–32 states per depth.')
  const commonness = options.wordCommonness ?? getGenerationWordCommonness
  const initial = createLetterStrikeGame(encounter)
  // The same physical selection with just its meaning changed isolates the
  // semantic benefit, including armour, Hit and Revive interactions.
  const neutralEncounter: LetterStrikeEncounter = { ...encounter, enemy: { ...encounter.enemy,
    semanticRelations: { opposite: [], similar: [], related: [] } },
    ...(encounter.meaningLexicon ? { meaningLexicon: { ...encounter.meaningLexicon,
      words: Object.fromEntries(Object.entries(encounter.meaningLexicon.words).map(([word, entry]) => [word, { ...entry, relation: 'unrelated' as const }])) } } : {}),
  }
  const choiceCache = new Map<string, Choice[]>()
  const choices = (state: LetterStrikeState): Choice[] => {
    const key = stateKey(state)
    const cached = choiceCache.get(key)
    if (cached) return cached
    const result: Choice[] = findPlayableWords(state).flatMap(word => {
    const frequency = commonness(word)
    if (frequency === null || frequency < COUNTER_COMMONNESS) return []
    const relation = getEncounterSemanticRelation(encounter, word)
    if (relation !== 'opposite' && frequency < FAMILIAR_COMMONNESS) return []
    const selections = new Map<string, number[]>()
    for (const preferSpecials of [false, true]) {
      const ids = selectWordIds(state.tiles, word, preferSpecials)
      if (ids) selections.set(ids.join(','), ids)
    }
    return [...selections.values()].flatMap(tileIds => {
      const actual = previewLetterStrike(state, tileIds)
      if (!actual.valid) return []
      const netHits = actual.strikes - (actual.recoveries?.length ?? 0)
      const neutral = relation === 'opposite' ? previewLetterStrike({ ...state, encounter: neutralEncounter }, tileIds) : actual
      return [{ word, tileIds, lemma: encounter.meaningLexicon?.words[word]?.lemma.toUpperCase() ?? word,
        label: actual.semanticLabel, commonness: frequency, netHits,
        meaningGain: netHits - neutral.strikes + (neutral.recoveries?.length ?? 0) }]
    })
    })
    choiceCache.set(key, result)
    return result
  }
  const byFamiliarity = (a: Choice, b: Choice) => b.commonness - a.commonness || a.word.length - b.word.length || a.word.localeCompare(b.word)
  const uniqueWords = (items: Choice[]) => [...new Set(items.map(item => item.word))]
  const counter = (item: Choice) => item.label === 'COUNTER' && item.word.length >= 4 && item.netHits > 0
  const countLemmas = (items: Choice[]) => new Set(items.map(item => item.lemma)).size
  const positions: JourneyPosition[] = []
  const initialChoices = choices(initial)
  const initialCounterWords = new Set(initialChoices.filter(counter).map(item => item.word))
  let frontier: { state: LetterStrikeState; prefix: Step[] }[] = [{ state: initial, prefix: [] }]
  for (let depth = 0; depth <= maxDepth && frontier.length; depth++) {
    const next: typeof frontier[] = []
    for (const { state, prefix } of frontier) {
      const available = depth === 0 ? initialChoices : choices(state)
      const counters = available.filter(counter).sort(byFamiliarity)
      const resisted = available.filter(item => item.label === 'RESISTED' && item.word.length >= 4).sort(byFamiliarity)
      const remainingHits = state.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)
      const remainingLetters = [...new Set(state.enemyLetters.filter(letter => letter.hitsRemaining > 0).map(letter => letter.letter))]
      positions.push({ depth, prefix, board: state.tiles.map(tile => tile.letter || '.').join(''), remainingHits, lives: state.playerResolve,
        counterWords: uniqueWords(counters), counterLemmas: countLemmas(counters),
        familiarCounterLemmas: countLemmas(counters.filter(item => item.commonness >= FAMILIAR_COMMONNESS)),
        advantagedCounterLemmas: countLemmas(counters.filter(item => item.meaningGain > 0)),
        resistedWords: uniqueWords(resisted), salientWords: uniqueWords(available.filter(item => item.word.length >= 4).sort(byFamiliarity)).slice(0, 12),
        discoveryWords: uniqueWords(counters.filter(item => resisted.length && item.commonness + 0.1 < resisted[0].commonness)),
        temptingResistedFinishers: uniqueWords(resisted.filter(item => item.netHits === 0 && remainingLetters.every(letter => item.word.includes(letter)))),
        counterFinishers: uniqueWords(counters.filter(item => item.netHits === remainingHits)),
      })
      // Round-robin categories: ordinary, bait, counter; shortest and longest
      // ordinary choices expose different refill offsets. Damage never ranks bait.
      const neutral = available.filter(item => item.label === 'NEUTRAL').sort(byFamiliarity)
      const categories = [neutral, resisted, counters,
        [...neutral].sort((a, b) => b.word.length - a.word.length || byFamiliarity(a, b)),
        [...counters].sort((a, b) => b.meaningGain - a.meaningGain || byFamiliarity(a, b))]
      const offset = depth === 0 ? 0 : (depth + next.length) % categories.length
      const groups = [...categories.slice(offset), ...categories.slice(0, offset)]
      const branches: typeof frontier = [], seen = new Set<string>()
      for (let rank = 0; rank < 2; rank++) for (const group of groups) {
        const move = group[rank]
        if (!move) continue
        const successor = submitLetterStrike(state, move.tileIds)
        if (successor.status !== 'playing') continue
        const key = stateKey(successor)
        if (seen.has(key)) continue
        seen.add(key)
        branches.push({ state: successor, prefix: [...prefix, { word: move.word, tileIds: move.tileIds }] })
      }
      next.push(branches)
    }
    // Round-robin parents prevents the first opening swallowing the next layer.
    frontier = []
    const seen = new Set<string>()
    for (let rank = 0; rank < 10 && frontier.length < statesPerDepth; rank++) for (const branches of next) {
      const branch = branches[rank]
      if (!branch || frontier.length >= statesPerDepth) continue
      const key = stateKey(branch.state)
      if (!seen.has(key)) { seen.add(key); frontier.push(branch) }
    }
  }
  const hasChoices = (position: JourneyPosition) => position.counterLemmas >= 2 && position.familiarCounterLemmas >= 1
  const hasBait = (position: JourneyPosition) => position.resistedWords.length >= 2
  const hasAdvantage = (position: JourneyPosition) => position.advantagedCounterLemmas > 0
  const byDepth = [...new Set(positions.map(position => position.depth))].map(depth => {
    const layer = positions.filter(position => position.depth === depth)
    return { depth, states: layer.length, counterChoiceRate: fraction(layer, hasChoices)!, resistedPresenceRate: fraction(layer, hasBait)!,
      meaningAdvantageRate: fraction(layer.filter(position => position.remainingHits > 1), hasAdvantage) }
  })
  const routes: SemanticJourney['routes'] = lines.map(line => {
    let state = initial, neutralTail = 0
    const counterTurns: number[] = [], advantagedCounterTurns: number[] = [], newCounterWords: string[] = []
    for (const [index, move] of line.moves.entries()) {
      const preview = previewLetterStrike(state, move.tileIds)
      const next = submitLetterStrike(state, move.tileIds)
      if (!preview.valid || preview.word !== move.word || next.error
        || next.playedWords.length !== state.playedWords.length + 1) throw new Error('Semantic journey requires exactly replayable winning routes.')
      if (preview.semanticLabel === 'COUNTER' && preview.strikes > (preview.recoveries?.length ?? 0)) {
        counterTurns.push(index + 1)
        const neutral = previewLetterStrike({ ...state, encounter: neutralEncounter }, move.tileIds)
        if (preview.strikes - (preview.recoveries?.length ?? 0) > neutral.strikes - (neutral.recoveries?.length ?? 0)) advantagedCounterTurns.push(index + 1)
        if (!initialCounterWords.has(move.word)) newCounterWords.push(move.word)
      }
      neutralTail = preview.semanticLabel === 'NEUTRAL' ? neutralTail + 1 : 0
      state = next
    }
    if (state.status !== 'won') throw new Error('Semantic journey received a route without a win.')
    return { words: line.moves.map(move => move.word), counterTurns, advantagedCounterTurns, neutralTail, newCounterWords: [...new Set(newCounterWords)] }
  })
  const chipAwayRuns: SemanticJourney['chipAwayRuns'] = []
  const openers = initialChoices.filter(counter).sort((a, b) => b.netHits - a.netHits || byFamiliarity(a, b))
  const openingWords = uniqueWords(openers).slice(0, 4)
  for (const opening of [null, ...openingWords]) for (const policy of ['familiar', 'damage'] as const) {
    let state = initial
    const moves: Step[] = []
    if (opening) {
      const first = openers.find(move => move.word === opening)!
      moves.push({ word: first.word, tileIds: first.tileIds })
      state = submitLetterStrike(state, first.tileIds)
    }
    for (let turn = 0; turn < encounter.startingResolve + encounter.startingTiles.length && state.status === 'playing'; turn++) {
      const neutral = choices(state).filter(move => move.label === 'NEUTRAL' && move.netHits > 0 && move.commonness >= FAMILIAR_COMMONNESS)
        .sort((a, b) => (policy === 'damage' ? b.netHits - a.netHits : 0) || byFamiliarity(a, b))
      if (!neutral.length) break
      const move = neutral[0]
      moves.push({ word: move.word, tileIds: move.tileIds })
      state = submitLetterStrike(state, move.tileIds)
    }
    chipAwayRuns.push({ opening, policy, moves, status: state.status })
  }
  const later = positions.filter(position => position.depth > 0)
  return { version: 1, encounterKey: semanticJourneyKey(encounter), scope: 'bounded-branch-sample-and-exact-route-replays', exhaustive: false,
    sampling: { maxDepth, statesPerDepth, counterCommonness: COUNTER_COMMONNESS, familiarCommonness: FAMILIAR_COMMONNESS,
      source: options.wordCommonness ? 'supplied-authoring-commonness' : 'pinned-wordfreq' },
    positions, byDepth, laterCounterChoiceRate: fraction(later, hasChoices), laterResistedPresenceRate: fraction(later, hasBait),
    laterMeaningAdvantageRate: fraction(later.filter(position => position.remainingHits > 1), hasAdvantage), routes,
    sustainedWinningRouteRate: fraction(routes, route => route.counterTurns.length >= 2 && route.advantagedCounterTurns.some(turn => turn > 1) && route.neutralTail <= 1),
    chipAwayRuns, chipAwayWinRate: fraction(chipAwayRuns, run => run.status === 'won'),
  }
}
