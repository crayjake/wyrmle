import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import type { ReviewLine } from './analyse.ts'
import { counterfactualEncounter } from './analyse.ts'
import { discoverValidMoves } from './findMoves.ts'
import { getGenerationWordCommonness } from './familiarity.ts'
import { stateKey } from './stateKey.ts'

export type SemanticChoices = {
  encounterKey: string
  minimumCommonness: number
  openingEnumerationComplete: boolean
  familiarCounterOpenings: string[]
  familiarCounterOpeningLemmas: string[]
  multiHitCounterOpenings: string[]
  /** These words deal more hits than the same physical selection as neutral. */
  meaningBoostedOpenings: string[]
  winningCounterWords: string[]
  winningCounterLemmas: string[]
  familiarWinningOpenings: string[]
}

/** Count actual legal choices and replayed routes, keeping inflections distinct
 * from different meanings. This complete audit is for final authoring review.
 */
export function analyseSemanticChoices(encounter: LetterStrikeEncounter, lines: readonly ReviewLine[], minimumCommonness = 0.5): SemanticChoices {
  const initial = createLetterStrikeGame(encounter)
  const openings = discoverValidMoves(initial)
  const familiar = (word: string) => (getGenerationWordCommonness(word) ?? -1) >= minimumCommonness
  const unique = (words: string[]) => [...new Set(words)].sort()
  const lemmas = (words: string[]) => unique(words.map(word => encounter.meaningLexicon?.words[word]?.lemma.toUpperCase() ?? word))
  const familiarCounterOpenings = unique(openings.moves.filter(move => move.semanticLabel === 'COUNTER'
    && move.strikes > 0 && familiar(move.word)).map(move => move.word))
  const multiHitCounterOpenings = unique(openings.moves.filter(move => move.semanticLabel === 'COUNTER'
    && move.strikes > 1 && familiar(move.word)).map(move => move.word))
  const allNeutral = createLetterStrikeGame(counterfactualEncounter(encounter, 'semantic'))
  const meaningBoostedOpenings = unique(openings.moves.filter(move => move.semanticLabel === 'COUNTER'
    && move.strikes > 1 && familiar(move.word)
    && move.strikes > previewLetterStrike(allNeutral, move.tileIds).strikes).map(move => move.word))
  const counterWords: string[] = [], winningOpenings: string[] = []
  for (const line of lines) {
    let state = initial
    const words: string[] = []
    for (const move of line.moves) {
      const next = submitLetterStrike(state, move.tileIds)
      if (next.error || next.playedWords.length !== state.playedWords.length + 1
        || next.playedWords.at(-1)!.word !== move.word) throw new Error('Semantic choice audit requires replayable winning routes.')
      const played = next.playedWords.at(-1)!
      if (played.semanticLabel === 'COUNTER' && played.strikes > 0 && familiar(played.word)) words.push(played.word)
      state = next
    }
    if (state.status !== 'won') throw new Error('Semantic choice audit received a route without a win.')
    counterWords.push(...words)
    if (line.moves.every(move => familiar(move.word))) winningOpenings.push(line.moves[0].word)
  }
  return { encounterKey: stateKey(initial), minimumCommonness,
    openingEnumerationComplete: openings.complete && openings.vocabularyComplete,
    familiarCounterOpenings, familiarCounterOpeningLemmas: lemmas(familiarCounterOpenings), multiHitCounterOpenings, meaningBoostedOpenings,
    winningCounterWords: unique(counterWords), winningCounterLemmas: lemmas(counterWords), familiarWinningOpenings: unique(winningOpenings) }
}
