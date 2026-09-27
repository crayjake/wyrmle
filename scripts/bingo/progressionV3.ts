/** Bingo-first v3: conservative, reproducible difficulty gates, not a model of every player's vocabulary. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../../src/game/letterStrike.ts'
import { selectWordIds } from '../../src/generator/constructRefill.ts'
import { getGenerationWordZipf } from '../../src/generator/familiarity.ts'
import { rateRoute, replayRoute, wordEffort, searchEasierRoute } from './routeDifficulty.ts'
import type { RouteWitness } from './routeDifficulty.ts'

export const progressionV3Policy = {
  version: 3, minimumGap: .4, threeWordMaxEffort: 4.8, threeWordMinimumZipf: 2.8,
  twoWordPositionBudget: 20000, threeWordPositionBudget: 12000,
} as const
const epsilon = 1e-8
const emptyRoute = (): RouteWitness => ({ words: [], tileIds: [], labels: [], hits: [] })
export function encounterFingerprint(encounter: LetterStrikeEncounter): string {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .filter(([, v]) => v !== undefined).map(([k, v]) => [k, canonical(v)])) : value
  return createHash('sha256').update(JSON.stringify(canonical(encounter))).digest('hex')
}
function vocabulary(encounter: LetterStrikeEncounter) {
  return Object.entries(encounter.meaningLexicon!.words).map(([word, meaning]) => {
    const counts = new Map<number, number>(); let mask = 0
    for (const letter of word) { const n = letter.charCodeAt(0) - 65; counts.set(n, (counts.get(n) ?? 0) + 1); mask |= 1 << n }
    return { word, family: meaning.lemma, counter: meaning.relation === 'opposite', cost: wordEffort(word),
      zipf: getGenerationWordZipf(word) ?? 0, counts: [...counts], mask }
  }).sort((a, b) => a.cost - b.cost || Number(b.counter) - Number(a.counter) || a.word.localeCompare(b.word))
}
function boardCounts(state: LetterStrikeState) {
  const counts = new Uint8Array(26), remaining = new Uint8Array(26); let mask = 0, hp = 0
  for (const { letter } of state.tiles) if (letter) { const n = letter.charCodeAt(0) - 65; counts[n]++; mask |= 1 << n }
  for (const l of state.enemyLetters) { remaining[l.letter.charCodeAt(0) - 65] += l.hitsRemaining; hp += l.hitsRemaining }
  return { counts, remaining, mask, hp }
}
const addMove = (path: RouteWitness, word: string, ids: number[], label: string, hits: number): RouteWitness => ({
  words: [...path.words, word], tileIds: [...path.tileIds, ids], labels: [...path.labels, label], hits: [...path.hits, hits],
})

/** Enumerate every admitted starting bingo, including obscure forms and alternative answers. */
export function startingBingos(encounter: LetterStrikeEncounter) {
  const state = createLetterStrikeGame({ ...encounter, startingResolve: 1 }), board = boardCounts(state)
  return vocabulary(encounter).flatMap(choice => {
    if (choice.mask & ~board.mask || choice.counts.some(([n, count]) => board.counts[n] < count)) return []
    const ids = selectWordIds(state.tiles, choice.word)!, preview = previewLetterStrike(state, ids)
    if (!preview.valid || preview.enemyLetters.some(l => l.hitsRemaining)) return []
    const witness = addMove(emptyRoute(), choice.word, ids, preview.semanticLabel, preview.strikes)
    replayRoute(encounter, witness)
    return [{ ...rateRoute([choice.word]), witness }]
  })
}

/** Exhaustive cheapest exact two-word win. No frequency floor, family exclusion,
 * positive-hit requirement or counter-first assumption: repeated words and zero-hit
 * refill moves are included. Identical normal tile copies are interchangeable. */
export function easiestTwoWordWin(encounter: LetterStrikeEncounter, budget = progressionV3Policy.twoWordPositionBudget) {
  assert.ok(Number.isSafeInteger(budget) && budget > 0)
  const choices = vocabulary(encounter)
  let best: RouteWitness | null = null, bestCost = Infinity, positions = 0, complete = true
  function visit(state: LetterStrikeState, path: RouteWitness, hardest: number) {
    if (positions >= budget) { complete = false; return }
    positions++
    const board = boardCounts(state), last = path.words.length === 1
    for (const choice of choices) {
      if (choice.cost >= bestCost - epsilon) break
      if (Math.max(hardest, choice.cost) >= bestCost - epsilon || choice.mask & ~board.mask
        || choice.counts.some(([n, count]) => board.counts[n] < count)) continue
      if (last && choice.counts.reduce((sum, [n, count]) => sum + Math.min(count, board.remaining[n]), 0) < board.hp) continue
      const ids = selectWordIds(state.tiles, choice.word)!, preview = previewLetterStrike(state, ids)
      if (!preview.valid) continue
      const won = preview.enemyLetters.every(l => l.hitsRemaining === 0)
      if (won !== last) continue
      const nextPath = addMove(path, choice.word, ids, preview.semanticLabel, preview.strikes)
      if (won) { best = nextPath; bestCost = Math.max(hardest, choice.cost); break }
      const next = submitLetterStrike(state, ids)
      if (next.status === 'playing') visit(next, nextPath, Math.max(hardest, choice.cost))
      if (!complete) return
    }
  }
  visit(createLetterStrikeGame({ ...encounter, startingResolve: 2 }), emptyRoute(), 0)
  const witness = best as RouteWitness | null
  if (witness) replayRoute(encounter, witness)
  return { witness, rating: witness && rateRoute(witness.words), positions, complete }
}

/** Find a counter-led three-word win below the proven two-word lower bound.
 * A successful witness suffices; exhausting this search is not required for acceptance. */
export function approachableThreeWordWin(encounter: LetterStrikeEncounter, bingos: readonly string[], ceiling: number,
  budget = progressionV3Policy.threeWordPositionBudget) {
  assert.ok(Number.isSafeInteger(budget) && budget > 0)
  const excluded = new Set(bingos.map(w => encounter.meaningLexicon!.words[w].lemma))
  const choices = vocabulary(encounter).filter(c => !excluded.has(c.family) && c.cost <= ceiling + epsilon
    && c.zipf >= progressionV3Policy.threeWordMinimumZipf)
  let found: RouteWitness | null = null, positions = 0, complete = true
  function visit(state: LetterStrikeState, path: RouteWitness, families: Set<string>, counters: number) {
    if (found) return
    if (positions >= budget) { complete = false; return }
    positions++
    const board = boardCounts(state), last = path.words.length === 2
    for (const choice of choices) {
      if (families.has(choice.family) || (!path.words.length && !choice.counter) || choice.mask & ~board.mask
        || choice.counts.some(([n, count]) => board.counts[n] < count)) continue
      const matching = choice.counts.reduce((sum, [n, count]) => sum + Math.min(count, board.remaining[n]), 0)
      if (!matching || last && (matching < board.hp || counters + Number(choice.counter) < 2)) continue
      const ids = selectWordIds(state.tiles, choice.word)!, preview = previewLetterStrike(state, ids)
      if (!preview.valid || preview.strikes < 1) continue
      const won = preview.enemyLetters.every(l => l.hitsRemaining === 0)
      if (won !== last) continue
      const nextPath = addMove(path, choice.word, ids, preview.semanticLabel, preview.strikes)
      if (won) { found = nextPath; return }
      const next = submitLetterStrike(state, ids)
      if (next.status === 'playing') visit(next, nextPath, new Set([...families, choice.family]), counters + Number(choice.counter))
      if (found || !complete) return
    }
  }
  visit(createLetterStrikeGame({ ...encounter, startingResolve: 3 }), emptyRoute(), new Set(), 0)
  const witness = found as RouteWitness | null
  if (witness) replayRoute(encounter, witness)
  return { witness, rating: witness && rateRoute(witness.words), positions, complete }
}

export function assessProgressionV3(encounter: LetterStrikeEncounter) {
  assert.ok(encounter.meaningLexicon && encounter.startingTiles.every(t => t.type === 'normal' && !t.gem),
    'V3 search requires a frozen lexicon and interchangeable normal tiles')
  assert.ok(encounter.finiteRefills, 'V3 requires a finite, deterministic refill queue')
  assert.deepEqual(encounter.grammarModifiers, {}, 'V3 difficulty search assumes the current rules without grammar bonuses')
  const bingos = startingBingos(encounter), two = easiestTwoWordWin(encounter)
  // Keep a separate ordinary two-word route: finding a shorter form of the
  // bingo is a legal shortcut, but must not be the only intermediate challenge.
  const twoWordRoute = searchEasierRoute(encounter, 2, bingos.map(b => b.words[0]), null)
  const ceiling = Math.min(progressionV3Policy.threeWordMaxEffort, (two.rating?.effort ?? 0) - progressionV3Policy.minimumGap)
  const three = approachableThreeWordWin(encounter, bingos.map(b => b.words[0]), ceiling)
  const issues: string[] = []
  if (!bingos.length) issues.push('No starting bingo.')
  if (!two.complete) issues.push('Two-word lower bound is unproven: search budget exhausted.')
  if (!two.rating) issues.push('No two-word win.')
  if (two.rating && bingos.length && two.rating.effort + progressionV3Policy.minimumGap > bingos[0].effort + epsilon)
    issues.push('An available bingo is too easy relative to the easiest two-word solution.')
  if (!twoWordRoute.rating || !bingos.length
    || twoWordRoute.rating.effort + progressionV3Policy.minimumGap > bingos[0].effort + epsilon)
    issues.push('No distinct, non-bingo two-word route comfortably easier than every starting bingo.')
  if (!three.witness) issues.push('No familiar, counter-led three-word route below the two-word lower bound was found.')
  return { version: 3 as const, policy: progressionV3Policy, fingerprint: encounterFingerprint(encounter),
    accepted: !issues.length, issues, bingos, two, twoWordRoute, three,
    scope: 'Every admitted starting bingo and the cheapest exact two-word win under a frequency/length bottleneck score; a counter-led three-word witness at least 0.4 easier. Two-word search includes repeated families, neutral and zero-hit refill moves. Three-word search requires distinct non-bingo families, positive hits and at least two counters. Normal tile copies use canonical selections. This is a vocabulary proxy, not a guarantee of subjective discovery difficulty or of every possible three-word route.' }
}
export type ProgressionV3 = ReturnType<typeof assessProgressionV3>
export type SemanticReviewV3 = {
  fingerprint: string; verdict: 'approved' | 'rejected'; enemyConcept: string;
  bingoConcepts: Record<string, string>; routeVocabulary: string; reviewer: string;
}
/** Publication never trusts a stale pass flag. Recompute on the decoded asset and
 * require an explicit review of the enemy reading, every bingo and route vocabulary. */
export function validateProgressionV3(encounter: LetterStrikeEncounter, review: SemanticReviewV3) {
  assert.ok(review, 'V3 publication requires a semanticReview with an enemy concept, every bingo explanation and route vocabulary review')
  const result = assessProgressionV3(encounter)
  assert.equal(review.fingerprint, result.fingerprint, 'V3 semantic review is stale for this board, refills or lexicon')
  assert.equal(review.verdict, 'approved', 'V3 semantic review rejected the puzzle')
  assert.ok(review.enemyConcept?.trim() && review.routeVocabulary?.trim() && review.reviewer?.trim(), 'Incomplete V3 meaning review')
  for (const bingo of result.bingos) assert.ok(review.bingoConcepts[bingo.words[0]]?.trim(), `Unreviewed bingo: ${bingo.words[0]}`)
  assert.deepEqual(result.issues, [], 'V3 difficulty progression failed')
  return result
}
