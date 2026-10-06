import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { dailySchedule, decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'

const encounterFor = (profile: string) => {
  const entry = dailySchedule.find(entry => entry.id.startsWith(`puzzle-${profile}-`))
  assert.ok(entry, `Missing reviewed puzzle: ${profile}`)
  return decodeScheduledPuzzle(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')), entry)
}

test('new boards recognise reviewed shorter antonyms beyond the planned helper pair', () => {
  const examples: [string, string[]][] = [
    ['autumn-hostile-hospitable', ['SOCIABLE', 'SOCIAL']],
    ['autumn-dry-drippy', ['WATERY', 'MISTY']],
    ['autumn-fit-afflicted', ['STRICKEN']],
    ['autumn-fact-fabrication', ['FABLE', 'STORY', 'TALE']],
    ['autumn-hide-published', ['TOLD']],
    ['oct26-inert-energetic', ['ALERT', 'AGILE', 'VITAL']],
    ['oct26-rude-cultured', ['COURTEOUS']],
    ['oct26-polar-tropical', ['TROPIC']],
    ['steady-unsteady', ['UNSTABLE']],
  ]
  for (const [profile, words] of examples) {
    const encounter = encounterFor(profile)
    for (const word of words) {
      const meaning = encounter.meaningLexicon!.words[word]
      assert.equal(meaning?.relation, 'opposite', `${profile}: ${word}`)
      assert.deepEqual(meaning.partsOfSpeech, [encounter.enemy.partOfSpeech])
    }
  }
})

test('new frozen meanings do not turn nouns or unrelated inflections into counters', () => {
  const examples: [string, string[]][] = [
    ['oct26-inert-energetic', ['LIVER', 'LIVEST']],
    ['oct26-integrate-disintegrate', ['RIPED', 'RIPING', 'TEARED']],
    ['autumn-erect-recumbent', ['PRONEST']],
    ['torn-incorporated', ['ONER']],
    ['tied-sectioned', ['CUTER']],
  ]
  for (const [profile, words] of examples) {
    const encounter = encounterFor(profile)
    for (const word of words) assert.equal(encounter.meaningLexicon!.words[word]?.relation, 'unrelated', `${profile}: ${word}`)
  }
  assert.deepEqual(encounterFor('torn-incorporated').meaningLexicon!.words.ONER.partsOfSpeech, ['noun'])
})
