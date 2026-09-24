import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import { discoverValidMoves, findPlayableWords } from '../src/generator/findMoves.ts'

// Offline exhaustive audit for the selected DESPAIR snapshot, not client code.
const encounter: LetterStrikeEncounter = JSON.parse(await readFile(
  new URL('../src/daily/puzzles/2026-09-24-v6.json', import.meta.url), 'utf8'))
const initial = createLetterStrikeGame(encounter)
let witness = initial
for (const ids of [[1, 14, 9, 13, 15, 7], [18, 11, 20, 21], [5, 25, 0, 10, 22, 4]]) {
  witness = submitLetterStrike(witness, ids)
  if (witness.error) throw new Error(witness.error)
}
if (witness.status !== 'won') throw new Error('The three-word upper bound is no longer valid.')
const openings = discoverValidMoves(initial)
if (!openings.complete || !openings.vocabularyComplete) throw new Error('Incomplete opening enumeration.')
let checked = 0, possibleFinishingWords = 0, secondSelections = 0
for (const first of openings.moves) {
  if (first.resultingState.status === 'won') throw new Error('Found a one-word win; the three-word minimum claim is false.')
  const state = first.resultingState
  if (state.status !== 'playing') continue
  const needed = new Map<string, number>()
  for (const letter of state.enemyLetters) needed.set(letter.letter, (needed.get(letter.letter) ?? 0) + letter.hitsRemaining)
  // Every hit requires its own matching tile. A word missing any required
  // letter copy cannot win; no heuristic score or vocabulary cap prunes here.
  const words = findPlayableWords(state).filter(word => [...needed].every(([letter, count]) =>
    [...word].filter(character => character === letter).length >= count))
  const finishes = discoverValidMoves(state, { vocabulary: words })
  if (!finishes.complete) throw new Error('Incomplete physical finishing selections.')
  if (finishes.moves.some(move => move.resultingState.status === 'won')) {
    throw new Error('Found a two-word win; the three-word minimum claim is false.')
  }
  checked++
  possibleFinishingWords += words.length
  secondSelections += finishes.legalSelectionsExamined
  if (checked % 1000 === 0) console.log(`Checked ${checked}/${openings.moves.length} openings`)
}
const proof = {
  openingSelections: openings.legalSelectionsExamined, checked, possibleFinishingWords, secondSelections,
  wins: [], provenMinimumWords: 3, encounterId: encounter.id,
  encounterHash: createHash('sha256').update(JSON.stringify(encounter)).digest('hex'),
  reason: 'Full dictionary physical openings and every possible finishing word/selection exhausted; independently replayed three-word upper bound.',
}
await writeFile(new URL('../src/generator/data/daily-depth-proof.json', import.meta.url), JSON.stringify(proof, null, 2) + '\n')
console.log(proof)
