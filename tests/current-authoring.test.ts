import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { puzzleProfiles, avoidsLessAnswer } from '../scripts/puzzles/profiles.ts'
import { getMeaningSense } from '../scripts/lib/wordMeanings.ts'
import { wordEffort } from '../scripts/bingo/routeDifficulty.ts'
import { checkPublicationDates, publicationContext } from '../scripts/puzzles/publish.ts'
import { buildAntonymEncounter } from '../scripts/antonyms/build.ts'

test('current authoring uses reviewed same-type senses, ordinary reusable tiles and non-less answers', () => {
  for (const { profile } of puzzleProfiles) {
    assert.equal(profile.letters.length, 16, profile.id)
    assert.equal(profile.refills, '')
    assert.deepEqual(profile.powers, [])
    assert.equal(profile.family, undefined)
    assert.ok(avoidsLessAnswer(profile.bingo))
    const enemy = getMeaningSense(profile.sense)!
    for (const id of profile.roots) assert.equal(getMeaningSense(id)?.partOfSpeech, enemy.partOfSpeech, `${profile.id}: ${id}`)
  }
  for (const word of ['WATERLESS', 'SOUNDLESS', 'FEARLESSNESS', 'CARELESSLY']) assert.equal(avoidsLessAnswer(word), false)
  assert.equal(avoidsLessAnswer('BLESSED'), true)
})
test('the public authoring command dry-runs without changing manifests and rejects occupied dates', () => {
  const paths = ['src/daily/archive.json', 'src/daily/schedule.json', 'src/daily/guides.json']
  const before = paths.map(path => readFileSync(path, 'utf8'))
  const stdout = execFileSync(process.execPath, ['scripts/generate-puzzle.ts', '--profile', 'gentle-armoured', '--date', '2099-01-01', '--dry-run'], { encoding: 'utf8' })
  assert.match(stdout, /"dryRun": true/)
  assert.match(stdout, /28 two-helper paths/)
  const result = JSON.parse(stdout.slice(0, stdout.lastIndexOf('\n2099-01-01')))
  const helpers = puzzleProfiles.find(item => item.profile.id === 'gentle-armoured')!.helpers
  assert.equal(result.helperEffort, Math.max(...helpers.map(word => wordEffort(word))), 'Array indices must not change the length penalty')
  assert.equal(existsSync('artifacts/puzzles/2099-01-01'), false)
  assert.deepEqual(paths.map(path => readFileSync(path, 'utf8')), before)
  assert.throws(() => execFileSync(process.execPath, ['scripts/generate-puzzle.ts', '--profile', 'gentle-armoured', '--date', '2026-09-29'], { stdio: 'pipe' }), /Date already occupied/)
})
test('batch date checks reject collisions before any puzzle is published', () => {
  const context = publicationContext()
  assert.throws(() => checkPublicationDates(['2099-01-01', '2099-01-01'], context), /Duplicate/)
  assert.throws(() => checkPublicationDates(['2099-01-01', context.entries[0].date], context), /Date already occupied/)
  assert.throws(() => checkPublicationDates(['2026-02-30'], context), /real dates/)
  assert.doesNotThrow(() => checkPublicationDates(['2099-01-01', '2099-01-02'], context))
})
test('a sourced neutral correction repairs a false comparative without admitting a noun as an adjective counter', () => {
  const base = puzzleProfiles.find(item => item.profile.id === 'old')!.profile
  const noun = { definition: 'An unusually remarkable person or thing.', lemma: 'oner', partOfSpeech: 'noun' as const,
    senseId: 'wiktionary-en:oner:noun:1:91683963', sourceUrl: 'https://en.wiktionary.org/w/index.php?title=oner&oldid=91683963' }
  assert.throws(() => buildAntonymEncounter({ ...base, supplemental: { ONER: noun } }), /noun/)
  const corrected = buildAntonymEncounter({ ...base,
    roots: [...base.roots, 'oewn-one__5.00.00.united.00'],
    supplemental: { ONER: { ...noun, relation: 'unrelated' } } }).encounter.meaningLexicon!.words.ONER
  assert.equal(corrected.relation, 'unrelated')
  assert.deepEqual(corrected.partsOfSpeech, ['noun'])
  assert.equal(corrected.definition, noun.definition)
  assert.equal(corrected.lemma, 'oner')
})
