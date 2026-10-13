import assert from 'node:assert/strict'
import test from 'node:test'
import { bingoQualityIssue } from '../scripts/puzzles/answerQuality.ts'
import { puzzleProfiles } from '../scripts/puzzles/profiles.ts'
import { replacementProfilesA } from '../scripts/puzzles/replacements-a.ts'
import { preparePuzzle } from '../scripts/puzzles/publish.ts'
import { getMeaningSense } from '../scripts/lib/wordMeanings.ts'

test('bingo selection rejects keeping the enemy intact by adding or removing an affix', () => {
  for (const [enemy, answer] of [
    ['INTEGRATE', 'DISINTEGRATE'], ['ABLE', 'INCAPABLE'],
    ['TRUE', 'TRUENESS'], ['UNCLEAN', 'CLEAN'], ['FAIR', 'FAIRER'],
    ['used', 'unused'],
  ]) assert.ok(bingoQualityIssue(enemy, answer), `${enemy} / ${answer}`)
})

test('pinned lemmas prevent inflections disguising a shared enemy root', () => {
  for (const [enemy, answer, enemyLemma, answerLemma] of [
    ['AGREED', 'DISAGREES', 'agree', 'disagree'],
    ['CHARGES', 'DISCHARGED', 'charge', 'discharge'],
  ]) {
    assert.equal(enemy.includes(answer) || answer.includes(enemy), false,
      'The surface spellings alone must not be a containment example')
    assert.ok(bingoQualityIssue(enemy, answer, enemyLemma, answerLemma), `${enemy} / ${answer}`)
  }
})

test('changing a negative prefix or a reviewed related root is still a trivial bingo', () => {
  for (const [enemy, answer] of [
    ['INHUMAN', 'HUMANITARIAN'], ['MOBILE', 'IMMOVABLE'],
    ['LEGAL', 'ILLEGITIMATE'],
  ]) assert.ok(bingoQualityIssue(enemy, answer), `${enemy} / ${answer}`)
})

test('the existing less-answer exclusion also applies to related endings', () => {
  for (const answer of ['WATERLESS', 'FEARLESSNESS', 'CARELESSLY', 'FEARLESSNESSES']) {
    assert.match(bingoQualityIssue('WET', answer) ?? '', /-less/, answer)
  }
})

test('legitimate rearrangements may share letters and use unrelated negative prefixes', () => {
  for (const [enemy, answer] of [
    ['BAD', 'ADMIRABLE'], ['BAD', 'FORMIDABLE'], ['FIT', 'DEFICIENT'],
    ['EASE', 'EXASPERATE'], ['GALL', 'ALLAYING'], ['HIRE', 'DISCHARGE'],
    ['SURE', 'PRECARIOUS'], ['GENTLE', 'UNRELENTING'],
  ]) assert.equal(bingoQualityIssue(enemy, answer), undefined, `${enemy} / ${answer}`)
})

test('the authoring registry no longer offers rejected primary answers', () => {
  assert.ok(puzzleProfiles.length > 20, 'Keep the valid reviewed authoring profiles available')
  for (const { profile } of puzzleProfiles) {
    const enemy = getMeaningSense(profile.sense)!
    assert.equal(bingoQualityIssue(profile.enemy, profile.bingo, enemy.lemma), undefined, profile.id)
  }
  const ids = new Set(puzzleProfiles.map(({ profile }) => profile.id))
  for (const id of ['oct26-integrate-disintegrate', 'oct26-inhuman-humanitarian',
    'oct26-mobile-immovable', 'oct26-legal-illegitimate']) assert.equal(ids.has(id), false, id)
})

test('an affix antonym can help, but cannot become an alternate bingo when armour is removed', () => {
  const selected = replacementProfilesA.find(({ profile }) => profile.enemy === 'FIT')!
  assert.ok(selected)
  assert.equal(selected.profile.armour?.[1], 2)
  const prepared = preparePuzzle(selected, '2099-02-01')
  assert.deepEqual(prepared.report.startingBingos.map(({ word }) => word), ['DEFICIENT'])
  assert.ok(prepared.counters.includes('UNFIT'), 'A useful antonym must remain accepted as a helper')
  assert.ok(prepared.report.removalProof.branches.some(({ first }) => first === 'UNFIT'))
  assert.deepEqual(prepared.report.witnesses.at(-1), ['POOR', 'UNFIT', 'DEFICIENT'])

  // This preserves the reviewed primary answer, board and semantic profile.
  // Without the extra I requirement, the shorter UNFIT also clears the enemy.
  assert.throws(() => preparePuzzle({ ...selected,
    profile: { ...selected.profile, armour: {} },
  }, '2099-02-01'), (error: unknown) => error instanceof Error
    && /UNFIT/.test(error.message) && /prefix|suffix|root|affix/i.test(error.message))
})
