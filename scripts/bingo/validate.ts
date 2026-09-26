import assert from 'node:assert/strict'
import { createLetterStrikeGame, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../../src/game/letterStrike.ts'
import { selectWordIds } from '../../src/generator/constructRefill.ts'
import { packMeaningLexicon, unpackMeaningLexicon } from '../../src/game/meaningPacking.ts'
import { bingoArmour } from './generate.ts'
import type { analyseBingo } from './generate.ts'

/** Validate the transported puzzle, with the same engine used by the browser. */
export function validateBingo(encounter: LetterStrikeEncounter, answer: string, analysis: ReturnType<typeof analyseBingo>) {
  assert.equal(encounter.startingTiles.length, 16)
  assert.equal(encounter.refillQueue.length, 24)
  assert.equal(encounter.finiteRefills, true)
  assert.deepEqual(encounter.enemyLetters, bingoArmour(encounter.enemy.word, answer))
  assert.ok(analysis.counterFamilies >= 4 && analysis.repeatedCounterRoutes >= 4
    && analysis.resistedFamilies >= 2 && analysis.sustainedPositions >= 2
    && analysis.sustainedFinalPositions >= 2, 'Insufficient ordinary routes')
  const meaningLexicon = unpackMeaningLexicon(packMeaningLexicon(encounter.meaningLexicon!))
  const { words: originalWords, ...originalHeader } = encounter.meaningLexicon!
  const { words: transportedWords, ...transportedHeader } = meaningLexicon
  assert.deepEqual(transportedHeader, originalHeader)
  assert.deepEqual(Object.keys(transportedWords), Object.keys(originalWords))
  // Compare one record at a time: a failed whole-lexicon assertion can spend
  // gigabytes building a diff of thousands of otherwise identical meanings.
  for (const word of Object.keys(originalWords)) assert.deepEqual(transportedWords[word], originalWords[word], word)
  const bingoLemmas = new Set(analysis.bingos.map(word => meaningLexicon.words[word].lemma))
  for (const startingResolve of [3, 4, 5]) {
    const initial = createLetterStrikeGame({ ...encounter, meaningLexicon, startingResolve })
    const ids = selectWordIds(initial.tiles, answer)
    assert.ok(ids)
    assert.equal(submitLetterStrike(initial, ids).status, 'won')
    let diverseCounterWins = 0
    for (const { witness } of analysis.routes) {
      if (!witness) continue
      assert.ok(witness.words.length >= 2 && witness.words.length <= 3)
      const lemmas = witness.words.map(word => meaningLexicon.words[word].lemma)
      assert.equal(new Set(lemmas).size, lemmas.length, 'Ordinary route repeats a word family')
      assert.ok(lemmas.every(lemma => !bingoLemmas.has(lemma)), 'Ordinary route uses a bingo family')
      let state = initial
      for (const [turn, tileIds] of witness.tileIds.entries()) {
        state = submitLetterStrike(state, tileIds)
        assert.equal(state.error, null)
        const move = state.playedWords.at(-1)!
        assert.equal(move.word, witness.words[turn])
        assert.equal(move.semanticLabel, witness.labels[turn])
        assert.equal(move.strikes, witness.hits[turn])
      }
      assert.equal(state.status, 'won', witness.words.join(' → '))
      if (state.playedWords.filter(move => move.semanticLabel === 'COUNTER').length >= 2) diverseCounterWins++
    }
    assert.ok(diverseCounterWins >= 4, 'Fewer than four replayed wins with different counter families')
  }
}
