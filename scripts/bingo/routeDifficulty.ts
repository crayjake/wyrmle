/** Vocabulary-effort primitives shared with bingo-first v3. The original audit
 * searches below retain their documented restricted scope; they are not proofs
 * of the cheapest unrestricted two-word win (see progressionV3.ts). */
import assert from 'node:assert/strict'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../../src/game/letterStrike.ts'
import { getGenerationWordZipf } from '../../src/generator/familiarity.ts'
import { selectWordIds } from '../../src/generator/constructRefill.ts'

export const experimentalEffort = { comfortableZipf: 4.5, rarityWeight: 2, freeLength: 5, lengthWeight: .6 } as const
export function wordEffort(word: string, lengthWeight: number = experimentalEffort.lengthWeight) {
  const zipf = getGenerationWordZipf(word) ?? 0
  return experimentalEffort.rarityWeight * Math.max(0, experimentalEffort.comfortableZipf - zipf)
    + lengthWeight * Math.max(0, word.length - experimentalEffort.freeLength)
}
export type RouteWitness = { words: string[]; tileIds: number[][]; labels: string[]; hits: number[] }
export function rateRoute(words: readonly string[]) {
  assert.ok(words.length > 0)
  const zipfs = words.map(word => getGenerationWordZipf(word) ?? 0)
  return { words: [...words], zipfs, minZipf: Math.min(...zipfs), maxLength: Math.max(...words.map(w => w.length)),
    effort: Number(Math.max(...words.map(w => wordEffort(w))).toFixed(4)),
    commonAndShort: zipfs.every(z => z >= 3.5) && words.every(w => w.length <= 8) }
}

export function ordinaryRoute(witness: RouteWitness, encounter: LetterStrikeEncounter, bingoFamilies: ReadonlySet<string>) {
  const families = witness.words.map(w => encounter.meaningLexicon!.words[w].lemma)
  return witness.words.length >= 2 && witness.words.length <= 3 && witness.hits.every(hit => hit > 0)
    && new Set(families).size === families.length && families.every(family => !bingoFamilies.has(family))
    && witness.labels.filter(label => label === 'COUNTER').length >= (witness.words.length === 3 ? 2 : 1)
}

export function replayRoute(encounter: LetterStrikeEncounter, witness: RouteWitness) {
  assert.equal(witness.tileIds.length, witness.words.length)
  assert.equal(witness.labels.length, witness.words.length)
  assert.equal(witness.hits.length, witness.words.length)
  let state = createLetterStrikeGame({ ...encounter, startingResolve: witness.words.length })
  for (const [index, ids] of witness.tileIds.entries()) {
    state = submitLetterStrike(state, ids)
    assert.equal(state.error, null)
    const move = state.playedWords.at(-1)!
    assert.equal(move.word, witness.words[index]); assert.equal(move.semanticLabel, witness.labels[index])
    assert.equal(move.strikes, witness.hits[index])
  }
  assert.equal(state.status, 'won')
  return state
}

/** Keep the actual first two moves fixed, then inspect every admitted finisher.
 * No frequency floor: report whether uncommon vocabulary is forced here. */
export function inspectThirdWords(encounter: LetterStrikeEncounter, witness: RouteWitness, bingos: readonly string[]) {
  assert.equal(witness.words.length, 3)
  replayRoute(encounter, witness)
  const lexicon = encounter.meaningLexicon!.words
  const excluded = new Set(bingos.map(word => lexicon[word].lemma))
  let state = createLetterStrikeGame({ ...encounter, startingResolve: 3 })
  for (const ids of witness.tileIds.slice(0, 2)) state = submitLetterStrike(state, ids)
  assert.equal(state.status, 'playing')
  const finishers = Object.keys(lexicon).flatMap(word => {
    const ids = selectWordIds(state.tiles, word)
    if (!ids) return []
    const preview = previewLetterStrike(state, ids)
    if (!preview.valid || preview.strikes < 1 || preview.enemyLetters.some(letter => letter.hitsRemaining > 0)) return []
    const route = { words: [...witness.words.slice(0, 2), word], tileIds: [...witness.tileIds.slice(0, 2), ids],
      labels: [...witness.labels.slice(0, 2), preview.semanticLabel], hits: [...witness.hits.slice(0, 2), preview.strikes] }
    if (!ordinaryRoute(route, encounter, excluded)) return []
    const final = submitLetterStrike(state, ids)
    assert.equal(final.error, null)
    assert.equal(final.status, 'won')
    return [{ ...rateRoute([word]), relation: lexicon[word].relation, definition: lexicon[word].definition, witness: route }]
  }).sort((a, b) => a.effort - b.effort || a.words[0].localeCompare(b.words[0]))
  return { prefix: witness.words.slice(0, 2), savedFinisher: rateRoute(witness.words.slice(2)),
    finisherCount: finishers.length, familiarFinisherCount: finishers.filter(f => f.commonAndShort).length,
    finishers, scope: 'All admitted finishers with distinct non-bingo families and at least two counters across the three productive moves.' }
}

/** Search for easier witnesses on the unchanged board. Productive moves only,
 * distinct families, no starting-bingo family; this is not all-player-path search.
 * Normal copies use canonical IDs: tile layout is not part of this difficulty proxy.
 * Every returned route is independently replayed in the actual engine. */
export function searchEasierRoute(encounter: LetterStrikeEncounter, turns: 2 | 3,
  bingos: readonly string[], seed: RouteWitness | null, budget = 6000) {
  assert.ok(encounter.startingTiles.every(tile => tile.type === 'normal' && !tile.gem))
  assert.ok(Number.isSafeInteger(budget) && budget > 0)
  const lexicon = encounter.meaningLexicon!.words
  const excluded = new Set(bingos.map(word => lexicon[word].lemma))
  const vocabulary = Object.entries(lexicon).flatMap(([word, meaning]) => {
    if (excluded.has(meaning.lemma) || !['opposite', 'unrelated'].includes(meaning.relation)
      || (getGenerationWordZipf(word) ?? 0) < 2.4) return []
    const counts = new Map<number, number>()
    let mask = 0
    for (const letter of word) { const n = letter.charCodeAt(0) - 65; counts.set(n, (counts.get(n) ?? 0) + 1); mask |= 1 << n }
    return [{ word, family: meaning.lemma, counter: meaning.relation === 'opposite', cost: wordEffort(word), mask, counts: [...counts] }]
  }).sort((a, b) => a.cost - b.cost || Number(b.counter) - Number(a.counter) || a.word.length - b.word.length || a.word.localeCompare(b.word))
  let best = seed && ordinaryRoute(seed, encounter, excluded) ? seed : null
  if (best) assert.equal(best.words.length, turns)
  let bestCost = best ? rateRoute(best.words).effort : Infinity
  let positions = 0, previews = 0, cutoff = false, wins = 0
  const lowerBound = vocabulary[0]?.cost ?? Infinity
  function visit(state: LetterStrikeState, path: RouteWitness, used: Set<string>, hardest: number, counters: number) {
    if (bestCost <= lowerBound + 1e-8) return
    if (positions >= budget) { cutoff = true; return }
    positions++
    const counts = new Uint8Array(26)
    const remaining = new Uint8Array(26)
    let required = 0
    for (const letter of state.enemyLetters) {
      remaining[letter.letter.charCodeAt(0) - 65] += letter.hitsRemaining
      required += letter.hitsRemaining
    }
    let mask = 0
    for (const { letter } of state.tiles) if (letter) { const n = letter.charCodeAt(0) - 65; counts[n]++; mask |= 1 << n }
    const last = path.words.length === turns - 1
    for (const choice of vocabulary) {
      const cost = Math.max(hardest, choice.cost)
      if (choice.cost >= bestCost - 1e-8) break
      if (cost >= bestCost - 1e-8 || used.has(choice.family) || choice.mask & ~mask
        || choice.counts.some(([letter, count]) => counts[letter] < count)) continue
      // A tile cannot hit a different letter. This is only an upper bound;
      // the real engine still decides semantics, damage and whether it wins.
      const matching = choice.counts.reduce((sum, [letter, count]) => sum + Math.min(count, remaining[letter]), 0)
      if (!matching || (last && matching < required)) continue
      const count = counters + Number(choice.counter)
      if (count + (turns - path.words.length - 1) < (turns === 3 ? 2 : 1)) continue
      const ids = selectWordIds(state.tiles, choice.word)!
      const preview = previewLetterStrike(state, ids); previews++
      if (!preview.valid || preview.strikes < 1) continue
      const won = preview.enemyLetters.every(l => l.hitsRemaining === 0)
      if (won !== last) continue
      const nextPath = { words: [...path.words, choice.word], tileIds: [...path.tileIds, ids],
        labels: [...path.labels, preview.semanticLabel], hits: [...path.hits, preview.strikes] }
      if (won) {
        best = nextPath; bestCost = cost; wins++
        // Candidates are sorted by cost: no later finisher improves this prefix.
        break
      }
      const next = submitLetterStrike(state, ids)
      if (next.status !== 'playing') continue
      visit(next, nextPath, new Set([...used, choice.family]), cost, count)
      if (cutoff || bestCost <= lowerBound + 1e-8) return
    }
  }
  if (best) replayRoute(encounter, best)
  visit(createLetterStrikeGame({ ...encounter, startingResolve: turns }), { words: [], tileIds: [], labels: [], hits: [] }, new Set(), 0, 0)
  if (best) replayRoute(encounter, best)
  return { witness: best, rating: best && rateRoute(best.words), positions, previews, improvingWins: wins,
    searchComplete: !cutoff, scope: 'Zipf ≥ 2.4; positive-hit moves; canonical normal tile IDs; distinct families; no starting bingo family; ≥2 counters for three words. Effort is an uncalibrated bottleneck proxy, not measured human difficulty.' }
}
