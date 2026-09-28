import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { packDictionaryMeanings, packMeaningLexicon, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import dailySchedule from '../artifacts/bingo-hunt-daily-2026-09-29/previous-schedule.json' with { type: 'json' }
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { getPuzzleGuide } from '../src/daily/guides.ts'

const entry = dailySchedule.find(p => p.enemy === 'IGNITE')!
const original = JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')).encounter
const lexicon = unpackMeaningLexicon(original.meaningLexicon)

test('dictionary packing preserves every word, definition, sense and classification while reducing the payload', () => {
  const compact = packDictionaryMeanings(lexicon)
  assert.equal(compact.packingVersion, 'wyrmle-packed-meanings-3')
  const restored = unpackMeaningLexicon(JSON.parse(JSON.stringify(compact)))
  assert.deepEqual(restored, lexicon)
  assert.deepEqual(Object.keys(restored.words), Object.keys(lexicon.words))
  assert.ok(JSON.stringify(compact).length < JSON.stringify(packMeaningLexicon(lexicon)).length / 4)
  const encounter = { ...original, meaningLexicon: restored, startingResolve: 1 }
  const game = createLetterStrikeGame(encounter)
  assert.equal(submitLetterStrike(game, selectWordIds(game.tiles, getPuzzleGuide(entry.id)!.answer)!).status, 'won')
})

test('dictionary packing retains puzzle-specific neutral definitions and reasons verbatim', () => {
  const word = Object.keys(lexicon.words).find(w => lexicon.words[w].evidence === 'defined-neutral')!
  const edited = { ...lexicon, words: { ...lexicon.words, [word]: { ...lexicon.words[word], definition: 'A pinned alternate sense.', reason: 'Reviewed in context.' } } }
  assert.deepEqual(unpackMeaningLexicon(packDictionaryMeanings(edited)), edited)
  const oldDictionary = { ...lexicon, dictionaryVersion: 'older-frozen-version' }
  assert.equal(packDictionaryMeanings(oldDictionary).packingVersion, 'wyrmle-packed-meanings-1')
  assert.deepEqual(unpackMeaningLexicon(packDictionaryMeanings(oldDictionary)), oldDictionary)
})

test('corrupt dictionary envelopes fail closed rather than silently assigning meanings', () => {
  const mutations = [
    p => { p.labelled.lexicon.dictionaryVersion = 'other-version' },
    p => { p.labelled.packingVersion = 'wyrmle-packed-meanings-3' },
    p => { p.words.push(p.words[0]) },
    p => { p.words.push('ZZZZQWERTY') },
    p => { p.words.push('bad') },
    p => { p.words.push(42) },
    p => { p.neutralReason = null },
    p => { p.words = p.words.filter(w => !Object.hasOwn(p.labelled.words, w)) },
  ]
  for (const mutate of mutations) {
    const packed = structuredClone(packDictionaryMeanings(lexicon))
    mutate(packed)
    assert.throws(() => unpackMeaningLexicon(packed), /Invalid packed puzzle meanings/)
  }
})
