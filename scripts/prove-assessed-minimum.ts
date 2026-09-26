import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { discoverValidMoves, findPlayableWords } from '../src/generator/findMoves.ts'
import { stateKey } from '../src/generator/stateKey.ts'
const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node scripts/prove-assessed-minimum.ts REVIEWED.json PROOF.json')
const selected = JSON.parse(readFileSync(input, 'utf8'))
const encounter = selected.candidate.encounter
const initial = createLetterStrikeGame(encounter)
const line = selected.analysis.winningLines.find((line: { turns: number }) => line.turns === 3)
assert.ok(line, 'A three-word witness is required.')
let witness = initial
for (const move of line.moves) witness = submitLetterStrike(witness, move.tileIds)
assert.equal(witness.status, 'won')
const openings = discoverValidMoves(initial)
assert.ok(openings.complete && openings.vocabularyComplete)
const seen = new Set<string>()
let finishingWords = 0, finishingSelections = 0
for (const first of openings.moves) {
  assert.notEqual(first.resultingState.status, 'won', `One-word win: ${first.word}`)
  const state = first.resultingState
  if (state.status !== 'playing') continue
  const key = stateKey(state)
  if (seen.has(key)) continue
  seen.add(key)
  const needed = new Map<string, number>()
  for (const cell of state.enemyLetters) needed.set(cell.letter, (needed.get(cell.letter) ?? 0) + cell.hitsRemaining)
  // Every hit needs a matching selected physical tile; Revive cannot reduce this bound.
  const words = findPlayableWords(state).filter(word => [...needed].every(([letter, count]) =>
    [...word].filter(character => character === letter).length >= count))
  const second = discoverValidMoves(state, { vocabulary: words })
  assert.ok(second.complete)
  const winner = second.moves.find(move => move.resultingState.status === 'won')
  assert.ok(!winner, `Two-word win: ${first.word} -> ${winner?.word}`)
  finishingWords += words.length
  finishingSelections += second.legalSelectionsExamined
  if (seen.size % 1000 === 0) console.log(JSON.stringify({successors:seen.size, finishingSelections}))
}
const proof = { encounterId: encounter.id, encounterKey: stateKey(initial), provenMinimumWords:3,
  openingSelections:openings.legalSelectionsExamined, distinctSuccessors:seen.size,
  finishingWords, finishingSelections, witness:line.moves,
  method:'Complete dictionary physical openings; exhaust every second word with enough copies to hit all remaining health; replay a three-word win.' }
writeFileSync(output,JSON.stringify(proof,null,2)+'\n')
console.log(JSON.stringify({ encounterId: encounter.id, provenMinimumWords: 3, openingSelections: proof.openingSelections, distinctSuccessors: seen.size, finishingSelections, witness: line.moves.map((move: {word:string}) => move.word) }, null, 2))
