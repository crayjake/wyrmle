import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDailyPuzzle, getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { inspectPuzzleMeaning } from '../src/generator/inspectMeaning.ts'

const puzzle = getDailyPuzzle('2026-09-25')

test('DEV inspection distinguishes a defined word outside the finite supply from a missing dictionary definition', () => {
  const where = inspectPuzzleMeaning(puzzle.encounter, ' where ')
  assert.equal(where?.word, 'WHERE')
  assert.equal(where?.kind, 'outside-supply')
  assert.ok(where && 'meaning' in where && where.meaning.definition.trim())
  assert.ok(where && 'message' in where && where.message.includes('complete starting and refill letters'))
  assert.equal(inspectPuzzleMeaning(puzzle.encounter, 'XYZQZZ')?.kind, 'undefined')
  assert.equal(inspectPuzzleMeaning(puzzle.encounter, ' '), null)
})

test('DEV inspection identifies word-length limits separately from supply or dictionary gaps', () => {
  const tooShort = inspectPuzzleMeaning(puzzle.encounter, 'AN')
  assert.equal(tooShort?.kind, 'outside-length')
  assert.ok(tooShort && 'meaning' in tooShort && tooShort.meaning.definition.trim())
})

test('DEV inspection exposes stale compiled coverage and preserves actual stored semantic evidence', () => {
  const archived = getDailyPuzzleForVersion(puzzle.puzzleId, 'letter-strike-7', 10)
  const missing = inspectPuzzleMeaning(archived.encounter, 'AND')
  assert.equal(missing?.kind, 'missing-record')
  assert.ok(missing && 'message' in missing && missing.message.includes('needs recompiling'))
  const current = inspectPuzzleMeaning(puzzle.encounter, 'AND')
  assert.equal(current?.kind, 'stored')
  assert.ok(current && 'meaning' in current && 'evidence' in current.meaning)
  assert.equal(current.meaning.evidence, 'defined-neutral')
  assert.equal(current.meaning, puzzle.encounter.meaningLexicon!.words.AND)
})
