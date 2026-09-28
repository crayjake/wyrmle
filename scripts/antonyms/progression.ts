/** Exhaustive two-turn bottleneck check, including non-counters and POWER choices. */
import assert from 'node:assert/strict'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../../src/game/letterStrike.ts'
import { selectWordIds } from '../../src/generator/constructRefill.ts'
import { rateRoute, replayRoute, wordEffort } from '../bingo/routeDifficulty.ts'
import type { RouteWitness } from '../bingo/routeDifficulty.ts'

/** Ordinary copies are interchangeable; choosing or saving each POWER tile isn't. */
export function physicalChoices(state: LetterStrikeState, word: string): number[][] {
  const specials = state.tiles.filter(t => t.gem === 'power')
  const result: number[][] = []
  for (let mask = 0; mask < 2 ** specials.length; mask++) {
    const chosen = specials.filter((_, index) => mask & (1 << index))
    const allowed = state.tiles.filter(t => !t.gem || chosen.includes(t))
    const ids = selectWordIds(allowed, word)
    if (ids && chosen.every(t => ids.includes(t.id))) result.push(ids)
  }
  return result
}
const empty = (): RouteWitness => ({ words: [], tileIds: [], labels: [], hits: [] })
function append(path: RouteWitness, state: LetterStrikeState, ids: number[]) {
  const preview = previewLetterStrike(state, ids)
  return { words: [...path.words, preview.word], tileIds: [...path.tileIds, ids],
    labels: [...path.labels, preview.semanticLabel], hits: [...path.hits, preview.strikes] }
}
export function witnessFor(encounter: LetterStrikeEncounter, words: readonly string[]) {
  let state = createLetterStrikeGame(encounter), path = empty()
  for (const word of words) {
    assert.equal(state.status, 'playing', `${words}: ends early`)
    const ids = selectWordIds(state.tiles, word)
    assert.ok(ids, `Cannot spell ${word} after ${path.words}`)
    path = append(path, state, ids)
    state = submitLetterStrike(state, ids)
    assert.equal(state.error, null, `${word}: ${state.error}`)
  }
  assert.equal(state.status, 'won', `${words}: remains ${state.enemyLetters.filter(l => l.hitsRemaining).map(l => l.letter).join('')}`)
  replayRoute(encounter, path)
  return path
}

export function certifyProgression(encounter: LetterStrikeEncounter, planned: readonly (readonly string[])[]) {
  assert.ok(encounter.counterRules)
  assert.ok(encounter.startingTiles.every(t => t.type === 'normal' || t.gem === 'power'))
  assert.ok(Object.entries(encounter.tileEffects).every(([key, effect]) => ['strike', 'ward', 'power'].includes(key) && !effect.regenerate))
  const initial = createLetterStrikeGame(encounter)
  const lexicon = encounter.meaningLexicon!.words
  const vocabulary = Object.keys(lexicon).map(word => {
    const counts = new Map<string, number>()
    for (const letter of word) counts.set(letter, (counts.get(letter) ?? 0) + 1)
    return { word, cost: wordEffort(word), counts: [...counts] }
  }).sort((a,b) => a.cost - b.cost || a.word.localeCompare(b.word))
  const counters = vocabulary.filter(choice => lexicon[choice.word].relation === 'opposite')
  const playable = (state: LetterStrikeState, choices = vocabulary) => {
    const counts = new Map<string, number>()
    for (const t of state.tiles) counts.set(t.letter, (counts.get(t.letter) ?? 0) + 1)
    return choices.filter(w => w.counts.every(([letter,n]) => (counts.get(letter) ?? 0) >= n))
  }
  const bingos: RouteWitness[] = []
  const openings = playable(initial)
  for (const choice of openings) for (const ids of physicalChoices(initial, choice.word)) {
    const preview = previewLetterStrike(initial, ids)
    if (preview.valid && preview.enemyLetters.every(l => !l.hitsRemaining)) bingos.push(append(empty(), initial, ids))
  }
  assert.ok(bingos.length, 'No starting bingo')
  for (const bingo of bingos) replayRoute(encounter, bingo)
  const routes = planned.map(route => witnessFor(encounter, route))
  let best = routes.find(route => route.words.length === 2)!
  let cost = rateRoute(best.words).effort
  let positions = 0, previews = 0
  for (const opening of openings) {
    if (opening.cost >= cost - 1e-8) break
    for (const ids of physicalChoices(initial, opening.word)) {
      const state = submitLetterStrike(initial, ids)
      if (state.error || state.status !== 'playing') continue
      positions++
      const path = append(empty(), initial, ids)
      for (const finishing of playable(state, counters)) {
        if (finishing.cost >= cost - 1e-8) break
        // Only reviewed counters can finish; first moves may be ANY legal word.
        if (lexicon[finishing.word].relation !== 'opposite') continue
        for (const finalIds of physicalChoices(state, finishing.word)) {
          const preview = previewLetterStrike(state, finalIds); previews++
          if (preview.valid && preview.enemyLetters.every(l => !l.hitsRemaining)) {
            best = append(path, state, finalIds)
            cost = Math.max(opening.cost, finishing.cost)
          }
        }
      }
    }
  }
  replayRoute(encounter, best)
  const three = routes.find(route => route.words.length === 3)!
  const two = routes.find(route => route.words.length === 2)!
  const ratings = { three: rateRoute(three.words), two: rateRoute(best.words), bingo: rateRoute(bingos[0].words) }
  const bingoFamilies = new Set(bingos.map(route => lexicon[route.words[0]].lemma))
  const families = three.words.map(word => lexicon[word].lemma)
  const issues = []
  const twoFamilies = two.words.map(word => lexicon[word].lemma)
  if (new Set(twoFamilies).size !== 2 || twoFamilies.some(family => bingoFamilies.has(family))
    || two.hits.some(h => h < 1) || two.labels.some(l => l !== 'COUNTER')) issues.push('Planned two-word route needs distinct productive counter families, excluding bingos')
  if (rateRoute(two.words).effort + .4 > ratings.bingo.effort + 1e-8) issues.push('Planned two-word route must also be easier than every bingo')
  if (new Set(families).size !== 3 || families.some(family => bingoFamilies.has(family))
    || three.hits.some(h => h < 1) || three.labels.some(l => l !== 'COUNTER')) issues.push('Three-word route needs three distinct productive counter families, excluding bingos')
  if (ratings.three.minZipf < 2.8 || ratings.three.effort > 4.8) issues.push('Three-word route is too obscure')
  if (ratings.three.effort + .4 > ratings.two.effort + 1e-8) issues.push('Three-word route must be easier than the cheapest two-word win')
  if (ratings.two.effort + .4 > ratings.bingo.effort + 1e-8) issues.push('Cheapest bingo must be harder than the cheapest two-word win')
  return { passed: issues.length === 0, issues, ratings, bingos, routes, cheapestTwo: best, positions, previews,
    searchComplete: true, scope: 'All legal first moves, repeated words and POWER-selection variants; exact cheapest two-word bottleneck. Three-word witness uses distinct, familiar counter families. Word frequency and length are a difficulty proxy, not measured human solving difficulty.' }
}
