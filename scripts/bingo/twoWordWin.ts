import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../../src/game/letterStrike.ts'
import { findPlayableWords } from '../../src/generator/findMoves.ts'
import { selectWordIds } from '../../src/generator/constructRefill.ts'
import { getGenerationWordCommonness } from '../../src/generator/familiarity.ts'

/** An actual two-life win, using different families and no starting bingo family. */
export function findTwoWordWin(encounter: LetterStrikeEncounter, bingos: readonly string[]) {
  const lexicon = encounter.meaningLexicon!.words
  const excluded = new Set(bingos.map(word => lexicon[word].lemma))
  const vocabulary = Object.keys(lexicon).filter(word => !excluded.has(lexicon[word].lemma)
    && (getGenerationWordCommonness(word) ?? 0) >= 0.35)
  const initial = createLetterStrikeGame({ ...encounter, startingResolve: 2 })
  for (const first of findPlayableWords(initial, vocabulary)) {
    const ids = selectWordIds(initial.tiles, first)!
    const preview = previewLetterStrike(initial, ids)
    if (!preview.valid || !preview.strikes) continue
    const next = submitLetterStrike(initial, ids)
    if (next.status !== 'playing') continue
    for (const second of findPlayableWords(next, vocabulary)) {
      if (lexicon[second].lemma === lexicon[first].lemma) continue
      const finalIds = selectWordIds(next.tiles, second)!
      const finalPreview = previewLetterStrike(next, finalIds)
      if (finalPreview.strikes < next.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)) continue
      const final = submitLetterStrike(next, finalIds)
      if (final.status === 'won') return { words: [first, second], tileIds: [ids, finalIds],
        labels: [preview.semanticLabel, finalPreview.semanticLabel], hits: [preview.strikes, finalPreview.strikes] }
    }
  }
  return null
}
