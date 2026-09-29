import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { puzzleProfiles, avoidsLessAnswer } from '../scripts/puzzles/profiles.ts'
import { getMeaningSense } from '../scripts/lib/wordMeanings.ts'

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
  assert.equal(existsSync('artifacts/puzzles/2099-01-01'), false)
  assert.deepEqual(paths.map(path => readFileSync(path, 'utf8')), before)
  assert.throws(() => execFileSync(process.execPath, ['scripts/generate-puzzle.ts', '--profile', 'gentle-armoured', '--date', '2026-09-29'], { stdio: 'pipe' }), /Date already occupied/)
})
