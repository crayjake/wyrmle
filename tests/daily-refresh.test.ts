import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import profiles from '../scripts/bingo/freshProfiles.json' with { type: 'json' }
import history from '../scripts/bingo/published-history.json' with { type: 'json' }
import original from '../artifacts/daily-month-2026-09-26/schedule.json' with { type: 'json' }
import { freshnessIssues, puzzleIdentity } from '../scripts/bingo/freshness.ts'
import type { PuzzleIdentity } from '../scripts/bingo/freshness.ts'
import { createBingoMeanings, bingoProfileVersion } from '../scripts/bingo/meanings.ts'
import { getMeaningSense } from '../scripts/lib/wordMeanings.ts'
import { dailySchedule, decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { getPuzzleGuide } from '../src/daily/guides.ts'

test('27 September through 16 October have twenty fresh enemies, bingo families and boards', () => {
  const window = dailySchedule.filter(entry => entry.date >= '2026-09-27' && entry.date <= '2026-10-16')
  assert.equal(window.length, 20)
  assert.equal(new Set(window.map(entry => entry.enemy)).size, 20)
  const ids = new Set(window.map(entry => entry.id))
  const before = history.filter(entry => !ids.has(entry.id))
  const batch: PuzzleIdentity[] = []
  for (const entry of window) {
    assert.ok(!before.some(old => old.enemy === entry.enemy), `Fresh enemy required for this replacement: ${entry.enemy}`)
    const payload = JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8'))
    const encounter = decodeScheduledPuzzle(payload, entry)
    const identity = puzzleIdentity(entry.id, encounter)
    assert.deepEqual(freshnessIssues(identity, [...before, ...batch]), [], entry.id)
    assert.ok(identity.bingos.includes(getPuzzleGuide(entry.id)!.answer))
    assert.ok(history.some(old => JSON.stringify(old) === JSON.stringify(identity)), 'Remember published puzzle after retirement')
    if (entry.date === '2026-09-29') {
      assert.equal(entry.enemy, 'DEAR')
      assert.equal(encounter.counterRules?.kind, 'antonym')
      assert.equal(encounter.counterRules.partOfSpeech, 'adjective')
    } else {
      const profile = profiles.find(p => p.enemy === entry.enemy)!
      assert.equal(encounter.meaningLexicon!.profileVersion, bingoProfileVersion(profile))
    }
    batch.push(identity)
  }
  for (const entry of original.filter(entry => entry.date < '2026-09-27' || entry.date > '2026-10-16')) {
    assert.deepEqual(dailySchedule.find(next => next.date === entry.date), entry, 'Preserve dates outside the requested window')
  }
})

test('fresh profiles pin the intended enemy and answer senses and avoid known homographs', () => {
  const traps: Record<string, [string, string, string][]> = {
    END: [['CLOSE', 'similar', 'finish or terminate']],
    IGNITE: [['FIREMAN', 'opposite', 'tries to extinguish'], ['SPARK', 'similar', 'burning substance']],
    POOR: [['BROKE', 'similar', 'lacking funds'], ['SUPPORT', 'opposite', 'financially']],
    TENSE: [['JITTERS', 'similar', 'nervousness']],
    SAD: [['CONSOLE', 'opposite', 'emotional strength'], ['SOB', 'similar', 'weep']],
  }
  for (const profile of profiles) {
    assert.ok(getMeaningSense(profile.enemySense))
    const m = createBingoMeanings(profile)
    assert.equal(m.meanings[profile.enemy].relation, 'similar', profile.enemy)
    assert.equal(m.meanings[profile.bingo].relation, 'opposite', profile.bingo)
    assert.equal(profile.hints.length, 3)
    for (const [word, relation, definition] of traps[profile.enemy] ?? []) {
      assert.equal(m.meanings[word].relation, relation)
      assert.ok(m.meanings[word].definition.includes(definition), `${profile.enemy}/${word}: wrong sense`)
    }
  }
})
