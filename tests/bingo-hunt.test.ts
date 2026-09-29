import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { conceptPreviews, conceptProgressKey, decodeConceptPuzzle } from '../src/experimental/concepts/catalog.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { getStrikeSummary } from '../src/components/strikeSummary.ts'
import { readBingoProgress, resumeBingoAttempt, saveBingoAttempt, restartBingoAttempt } from '../src/experimental/bingo/progress.ts'
import { winStars } from '../src/game/rating.ts'
import { certifyHuntProgressCompatibility, inspectHuntRemovals, planHuntRemovals } from '../scripts/antonyms/hunt.ts'
import { allHuntProfiles, armouredHuntProfiles, huntProfiles, threeCopyHunt } from '../scripts/antonyms/huntProfiles.ts'
import { evaluateLetterStrike } from '../src/game/letterStrike.ts'
import { buildAntonymEncounter } from '../scripts/antonyms/build.ts'
import { validateBingoHunt } from '../src/game/bingoHunt.ts'
import { openChallenge, saveChallenge, restartChallenge } from '../src/daily/challengeProgress.ts'
import { wordEffort } from '../scripts/bingo/routeDifficulty.ts'

const entries = conceptPreviews.filter(entry => entry.bingoHunt)
const encounter = (id: string) => {
  const entry = entries.find(entry => entry.id === id)!
  return decodeConceptPuzzle(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')), entry)
}
const sorted = (text: string) => [...text].sort().join('')
function play(state: LetterStrikeState, word: string) {
  const ids = selectWordIds(state.tiles, word)
  assert.ok(ids, word)
  const next = submitLetterStrike(state, ids)
  assert.equal(next.error, null, word)
  return next
}

test('hunt wins in 1/2/3 guesses award 3/2/1 stars without damage or refills', () => {
  assert.equal(entries.length, 11)
  assert.deepEqual(entries.map(entry => entry.id), allHuntProfiles.map(({ profile }) => `hunt-${profile.id}`))
  for (const { profile, helpers } of allHuntProfiles) {
    const id = `hunt-${profile.id}`
    const initial = createLetterStrikeGame(encounter(id)), answer = initial.encounter.bingoHunt!.answer
    for (let guesses = 1; guesses <= 3; guesses++) {
      let game = initial
      for (const word of [...helpers.slice(0, guesses - 1), answer]) game = play(game, word)
      assert.equal(game.status, 'won')
      assert.equal(game.playedWords.length, guesses)
      assert.equal(winStars(guesses), 4 - guesses)
      assert.equal(game.playerResolve, 3 - guesses)
      assert.equal(game.refillIndex, 0)
      assert.equal(game.nextTileId, initial.nextTileId)
      assert.deepEqual(game.enemyLetters, initial.enemyLetters)
      assert.ok(game.playedWords.every(move => move.strikes === 0 && move.preview.hits.length === 0))
    }
  }
})

test('armour is optional in generated hunts and cannot demand missing answer copies', () => {
  for (const { profile } of armouredHuntProfiles) {
    const { encounter: built } = buildAntonymEncounter(profile)
    const published = encounter(`hunt-${profile.id}`)
    assert.deepEqual(built.enemyLetters, published.enemyLetters)
    const slots = Object.keys(profile.armour!).map(Number)
    assert.equal(built.enemyLetters.filter(letter => letter.initialHits > 1).length, slots.length)
    const plain = buildAntonymEncounter({ ...profile, armour: undefined }).encounter
    assert.ok(plain.enemyLetters.every(letter => letter.initialHits === 1))
    assert.doesNotThrow(() => createLetterStrikeGame({ ...plain, bingoHunt: published.bingoHunt }))
    // A two-armour board also works with either armour slot enabled alone.
    for (let mask = 0; mask < 2 ** slots.length; mask++) {
      const positions = slots.filter((_, index) => mask & (1 << index))
      const variant = { ...published, enemyLetters: plain.enemyLetters.map((letter, index) => ({ ...letter,
        initialHits: positions.includes(index) ? 2 : 1, hitsRemaining: positions.includes(index) ? 2 : 1 })) }
      assert.equal(play(createLetterStrikeGame(variant), profile.bingo).status, 'won')
    }
    const invalid = structuredClone(published)
    // All three answers have only one copy of their enemy's first letter.
    invalid.enemyLetters[0].initialHits = invalid.enemyLetters[0].hitsRemaining = 2
    assert.throws(() => createLetterStrikeGame(invalid), /Bingo hunt/)
  }
  for (const armour of [{ '-1': 2 }, { 3: 2 }, { '0.5': 2 }, { 1: 1 }, { 1: 2.5 }, { 1: 17 }]) {
    assert.throws(() => buildAntonymEncounter({ ...huntProfiles[2].profile, armour }), /armour|Armour/)
  }
  // Two E slots use two separate copies; armouring either needs a third E.
  // Exercise only the target-inventory validator, independently of semantics.
  const source = encounter('hunt-wet')
  const e = source.enemyLetters.find(letter => letter.letter === 'E')!
  const repeated = { ...source, enemyLetters: [e, { ...e, id: 'another-E' }] }
  assert.doesNotThrow(() => validateBingoHunt(repeated))
  for (const index of [0, 1]) {
    const invalid = structuredClone(repeated)
    invalid.enemyLetters[index].initialHits = invalid.enemyLetters[index].hitsRemaining = 2
    assert.throws(() => validateBingoHunt(invalid), /Bingo hunt/)
  }
})

test('armoured hunt previews distinguish one copy from two and helpers never wear armour down', () => {
  for (const [id, helper, letter] of [
    ['hunt-wet-armoured', 'PARCHED', 'E'], ['hunt-dim-armoured', 'LIT', 'I'], ['hunt-big-armoured', 'LITTLE', 'I'],
  ]) {
    const initial = createLetterStrikeGame(encounter(id)), target = initial.enemyLetters.find(slot => slot.letter === letter)!
    const idsForHelper = selectWordIds(initial.tiles, helper)
    assert.ok(idsForHelper, helper)
    const preview = previewLetterStrike(initial, idsForHelper)
    assert.equal(preview.valid, true)
    assert.equal(preview.bingoHunt!.won, false)
    assert.deepEqual(preview.bingoHunt!.matchingHits.filter(hit => hit.enemyLetterId === target.id)
      .map(hit => [hit.hitsBefore, hit.hitsAfter]), [[2, 1]])
    const after = play(initial, helper)
    assert.equal(after.playerResolve, 2)
    assert.deepEqual(after.enemyLetters, initial.enemyLetters)
    const bingo = previewLetterStrike(after, selectWordIds(after.tiles, after.encounter.bingoHunt!.answer)!)
    assert.equal(bingo.bingoHunt!.won, true)
    assert.deepEqual(bingo.bingoHunt!.matchingHits.filter(hit => hit.enemyLetterId === target.id)
      .map(hit => [hit.hitsBefore, hit.hitsAfter]), [[2, 1], [1, 0]])
    assert.deepEqual(bingo.enemyLetters, initial.enemyLetters)
    // The pure scorer must not count the same physical copy twice either.
    const ids = selectWordIds(initial.tiles, initial.encounter.bingoHunt!.answer)!
    const tiles = ids.map(id => ({ ...initial.tiles.find(tile => tile.id === id)! }))
    const copies = tiles.filter(tile => tile.letter === letter)
    copies[1].id = copies[0].id
    assert.equal(evaluateLetterStrike(initial, tiles).bingoHunt!.won, false)
  }
})

test('three-copy armour is generated, counted per physical tile and required within one noun antonym', () => {
  const profile = { ...huntProfiles[3].profile, id: 'three-copy-fixture', enemy: 'LOUDNESS',
    definition: 'the magnitude of sound', sense: 'oewn-loudness__1.07.00..',
    bingo: 'SOUNDLESSNESS', letters: 'SOUNDLESSNESSQIT', armour: { 6: 3 },
    roots: ['oewn-soundlessness__1.07.00..', 'oewn-quiet__1.07.02..', 'oewn-quietness__1.07.00..'], wordOnly: [] }
  const built = buildAntonymEncounter(profile).encounter
  const spareIds = selectWordIds(built.startingTiles, 'QIT')!
  const current = { ...built, bingoHunt: { answer: profile.bingo, removalOrder: spareIds } }
  const initial = createLetterStrikeGame(current)
  assert.equal(initial.enemyLetters[6].initialHits, 3)
  assert.deepEqual(current.meaningLexicon!.words.SOUNDLESSNESS.partsOfSpeech, ['noun'])
  const preview = previewLetterStrike(initial, selectWordIds(initial.tiles, 'QUIETNESS')!)
  assert.equal(preview.valid, true)
  assert.equal(preview.bingoHunt!.won, false)
  assert.deepEqual(preview.bingoHunt!.matchingHits.filter(hit => hit.enemyLetterId === 'enemy-6')
    .map(hit => [hit.hitsBefore, hit.hitsAfter]), [[3, 2], [2, 1]])
  const after = play(initial, 'QUIETNESS')
  assert.deepEqual(after.enemyLetters, initial.enemyLetters)
  const won = play(after, profile.bingo)
  assert.equal(won.status, 'won')
  const hits = won.playedWords.at(-1)!.preview.bingoHunt!.matchingHits
  assert.deepEqual(hits.filter(hit => hit.enemyLetterId === 'enemy-6').map(hit => [hit.hitsBefore, hit.hitsAfter]), [[3, 2], [2, 1], [1, 0]])
  assert.equal(new Set(hits.filter(hit => hit.letter === 'S').map(hit => hit.tileId)).size, 4)
  const four = structuredClone(current)
  four.enemyLetters[6].initialHits = four.enemyLetters[6].hitsRemaining = 4
  assert.equal(play(createLetterStrikeGame(four), profile.bingo).status, 'won')
  for (const copies of [0, 1.5, 5, 17]) {
    const bad = structuredClone(current)
    bad.enemyLetters[6].initialHits = bad.enemyLetters[6].hitsRemaining = copies
    assert.throws(() => createLetterStrikeGame(bad), /starting hits|Bingo hunt/)
  }
})

test('published FEAR uses three E copies, noun antonyms and distinct familiar follow-ups', () => {
  const current = encounter('hunt-fear-armoured')
  const { profile, preferredHelpers } = threeCopyHunt
  assert.deepEqual(current.enemyLetters.map(letter => letter.initialHits), [1, 3, 1, 1])
  const plan = planHuntRemovals(buildAntonymEncounter(profile).encounter, profile.bingo, preferredHelpers)
  assert.deepEqual(plan.encounter.bingoHunt, current.bingoHunt)
  assert.ok(plan.review.minPreferredFamilies >= 2)
  assert.equal(plan.review.pathsChecked, 40)
  const initial = createLetterStrikeGame(current)
  // Genuine reviewed antonyms must not be excluded just for sharing an enemy prefix.
  assert.ok(!current.counterRules!.excludedWords.includes('FEARLESSNESS'))
  for (const word of ['FEAR', 'FEARS', 'FEARLESS', 'NERVES']) {
    const preview = previewLetterStrike(initial, selectWordIds(initial.tiles, word)!)
    assert.equal(preview.valid, false, word)
  }
  for (const word of preferredHelpers) {
    assert.deepEqual(current.meaningLexicon!.words[word].partsOfSpeech, ['noun'])
    assert.equal(previewLetterStrike(initial, selectWordIds(initial.tiles, word)!).valid, true)
  }
  const preview = previewLetterStrike(initial, selectWordIds(initial.tiles, 'EASE')!)
  assert.deepEqual(preview.bingoHunt!.matchingHits.filter(hit => hit.letter === 'E')
    .map(hit => [hit.hitsBefore, hit.hitsAfter]), [[3, 2], [2, 1]])
  const won = play(initial, profile.bingo)
  assert.equal(won.status, 'won')
  assert.equal(won.playedWords[0].preview.bingoHunt!.matchingHits.filter(hit => hit.letter === 'E').length, 3)
})

test('Hard accepts dictionary misses but removes tiles only for antonyms, without relaxing bingo rules', () => {
  const initial = createLetterStrikeGame(encounter('hunt-dim-armoured'))
  let game = initial
  for (const word of ['LITER', 'AIL']) {
    const ids = selectWordIds(game.tiles, word)!
    assert.ok(ids, word)
    assert.equal(previewLetterStrike(game, ids).valid, false)
    const preview = previewLetterStrike(game, ids, { hardGuess: true })
    assert.equal(preview.valid, true)
    assert.notEqual(preview.semanticLabel, 'COUNTER')
    assert.equal(preview.bingoHunt!.won, false)
    assert.equal(preview.resolveCost, 1)
    assert.deepEqual(preview.bingoHunt!.removedTileIds, [])
    game = submitLetterStrike(game, ids, { hardGuess: true })
    assert.deepEqual(game.tiles, initial.tiles)
    assert.deepEqual(game.enemyLetters, initial.enemyLetters)
    assert.equal(game.playedWords.at(-1)!.hardGuess, true)
  }
  assert.equal(game.playerResolve, 1)
  assert.equal(game.tiles.filter(tile => tile.letter).length, 16)
  const answerIds = selectWordIds(game.tiles, game.encounter.bingoHunt!.answer)!
  assert.equal(submitLetterStrike(game, answerIds, { hardGuess: true }).status, 'won')
  assert.equal(submitLetterStrike(game, selectWordIds(game.tiles, 'DIAL')!, { hardGuess: true }).status, 'lost')
  // A non-antonym containing all the enemy letters is still not a bingo.
  const plain = createLetterStrikeGame(encounter('hunt-dim'))
  assert.equal(submitLetterStrike(plain, selectWordIds(plain.tiles, 'ADMIRE')!, { hardGuess: true }).status, 'playing')
  assert.equal(submitLetterStrike(initial, selectWordIds(initial.tiles, 'DIM')!, { hardGuess: true }).playerResolve, 2)
  const nonword = selectWordIds(initial.tiles, 'ILM')!
  const ids = selectWordIds(initial.tiles, 'AIL')!
  for (const invalid of [nonword, [ids[0], ids[0], ids[0]], [999, 998, 997]]) {
    const result = submitLetterStrike(initial, invalid, { hardGuess: true })
    assert.ok(result.error)
    assert.equal(result.playerResolve, 3)
    assert.deepEqual(result.tiles, initial.tiles)
  }
  const repeat = submitLetterStrike(game, selectWordIds(game.tiles, 'AIL')!, { hardGuess: true })
  assert.match(repeat.error!, /Already tried/)
  assert.equal(repeat.playerResolve, 1)
  const wrong = submitLetterStrike(initial, selectWordIds(initial.tiles, 'LITER')!, { hardGuess: true })
  const right = submitLetterStrike(wrong, selectWordIds(wrong.tiles, 'LIT')!, { hardGuess: true })
  assert.equal(right.playerResolve, 1)
  const firstHelper = play(initial, 'LIT')
  assert.deepEqual(right.tiles, firstHelper.tiles, 'a miss must not advance the spare-removal schedule')
  const wrongAfterRight = submitLetterStrike(firstHelper, selectWordIds(firstHelper.tiles, 'AIL')!, { hardGuess: true })
  assert.deepEqual(wrongAfterRight.tiles, firstHelper.tiles)
  const twoHelpers = submitLetterStrike(firstHelper, selectWordIds(firstHelper.tiles, 'LIGHT')!, { hardGuess: true })
  assert.equal(sorted(twoHelpers.tiles.map(tile => tile.letter).join('')), sorted(initial.encounter.bingoHunt!.answer))
})

test('daily and preview saves replay mixed Hard/Normal moves without refunds or rule changes', () => {
  const entry = entries.find(entry => entry.id === 'hunt-dim-armoured')!
  const current = encounter(entry.id)
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) } }
  const date = '2026-10-02'
  let { record, game } = openChallenge(date, entry.asset, current, storage)
  game = submitLetterStrike(game, selectWordIds(game.tiles, 'LITER')!, { hardGuess: true })
  record = saveChallenge(record, game, true, storage)
  assert.equal(record.run.moves[0].hardGuess, true)
  assert.deepEqual(openChallenge(date, entry.asset, current, storage).game, game)
  game = play(game, 'LIT')
  record = saveChallenge(record, game, true, storage)
  assert.equal(record.run.moves[1].hardGuess, undefined)
  assert.deepEqual(openChallenge(date, entry.asset, current, storage).game, game)
  const key = conceptProgressKey(entry)
  assert.equal(saveBingoAttempt(key, game, true, 1, storage), true)
  assert.deepEqual(resumeBingoAttempt(key, current, storage).game, game)
  const changed = structuredClone(game)
  delete changed.playedWords[0].hardGuess
  assert.throws(() => saveChallenge(record, changed, true, storage), /one attempt/)
  assert.throws(() => restartChallenge(record, storage), /one attempt/)
  game = play(game, current.bingoHunt!.answer)
  record = saveChallenge(record, game, true, storage)
  assert.equal(record.bestWords, 3)
  assert.equal(openChallenge(date, entry.asset, current, storage).game.status, 'won')
})

test('armoured comparisons reproduce every removal branch and keep their own saved progress', () => {
  for (const { profile, helpers, preferredHelpers } of armouredHuntProfiles) {
    const current = encounter(`hunt-${profile.id}`)
    const plan = planHuntRemovals(buildAntonymEncounter(profile).encounter, profile.bingo, preferredHelpers)
    assert.deepEqual(plan.encounter.bingoHunt, current.bingoHunt)
    assert.ok(plan.review.minPreferredFamilies >= 1)
    const entry = entries.find(entry => entry.id === `hunt-${profile.id}`)!
    const original = entries.find(candidate => candidate.id === entry.id.replace('-armoured', ''))!
    assert.equal(original.enemy, entry.enemy)
    assert.notEqual(conceptProgressKey(entry), conceptProgressKey(original))
    assert.doesNotThrow(() => decodeConceptPuzzle(JSON.parse(readFileSync(`public/${entry.asset}`, 'utf8')),
      { ...entry, armour: Object.fromEntries(Object.entries(entry.armour!).reverse()) }))
    const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) } }
    const key = conceptProgressKey(entry)
    const game = play(createLetterStrikeGame(current), helpers[0])
    saveBingoAttempt(key, game, true, 1, storage)
    assert.deepEqual(resumeBingoAttempt(key, current, storage).game, game)
    assert.deepEqual(game.enemyLetters, current.enemyLetters)
    const partial = structuredClone(current)
    partial.enemyLetters.find(letter => letter.initialHits === 2)!.hitsRemaining = 1
    assert.throws(() => createLetterStrikeGame(partial), /starting hits/)
    assert.throws(() => decodeConceptPuzzle(current, { ...entry, armour: undefined }), /Wrong preview/)
  }
})

test('hunt previews matching enemy letters, with all red only for a valid bingo and no committed damage', () => {
  const initial = createLetterStrikeGame(encounter('hunt-alert'))
  for (const [word, matching] of [['SLOW', 'L'], ['IDLE', 'EL'], ['INERT', 'ERT'], ['LETHARGIC', 'AELRT']]) {
    const ids = selectWordIds(initial.tiles, word)!
    const preview = previewLetterStrike(initial, ids)
    assert.equal(preview.valid, true)
    assert.equal(sorted(preview.bingoHunt!.matchingHits.map(hit => hit.letter).join('')), matching)
    assert.equal(new Set(preview.bingoHunt!.matchingHits.map(hit => hit.enemyLetterId)).size, matching.length)
    assert.ok(preview.bingoHunt!.matchingHits.every(hit => hit.hitsBefore === 1 && hit.hitsAfter === 0))
    assert.equal(preview.bingoHunt!.won, matching.length === initial.enemyLetters.length)
    assert.deepEqual(preview.hits, [])
    assert.equal(preview.strikes, 0)
    assert.deepEqual(preview.enemyLetters, initial.enemyLetters)
    assert.deepEqual(submitLetterStrike(initial, ids).enemyLetters, initial.enemyLetters)
  }
  for (const word of ['ALERT', 'CAT']) {
    const preview = previewLetterStrike(initial, selectWordIds(initial.tiles, word)!)
    assert.equal(preview.valid, false)
    assert.deepEqual(preview.bingoHunt!.matchingHits, [])
    assert.equal(preview.bingoHunt!.won, false)
  }
  const after = play(initial, 'INERT')
  assert.deepEqual(previewLetterStrike(after, selectWordIds(after.tiles, 'INERT')!).bingoHunt!.matchingHits, [])
  assert.deepEqual(previewLetterStrike(initial, []).bingoHunt!.matchingHits, [])
  // One E must not light up two separate E targets in a future hunt.
  const target = initial.enemyLetters.find(letter => letter.letter === 'E')!
  const duplicateTargets = { ...initial, enemyLetters: [target, { ...target, id: 'second-E' }] }
  const preview = previewLetterStrike(duplicateTargets, selectWordIds(initial.tiles, 'LETHARGIC')!)
  assert.equal(preview.bingoHunt!.matchingHits.length, 1)
  assert.equal(preview.bingoHunt!.won, false)
})

test('every accepted helper path preserves all answer copies and leaves its exact anagram on the final life', () => {
  for (const entry of entries) {
    const initial = createLetterStrikeGame(encounter(entry.id)), rule = initial.encounter.bingoHunt!
    const words = Object.keys(initial.encounter.meaningLexicon!.words)
    let checked = 0
    for (const first of words) {
      const ids = selectWordIds(initial.tiles, first)
      if (!ids || !previewLetterStrike(initial, ids).valid) continue
      const after = submitLetterStrike(initial, ids)
      if (after.status === 'won') continue
      assert.equal(after.tiles.filter(tile => !tile.letter).length, Math.ceil(rule.removalOrder.length / 2))
      assert.ok(selectWordIds(after.tiles, rule.answer))
      const otherFamilies = new Set<string>()
      for (const second of words) {
        const secondIds = selectWordIds(after.tiles, second)
        if (!secondIds || !previewLetterStrike(after, secondIds).valid) continue
        const final = submitLetterStrike(after, secondIds)
        if (final.status === 'won') continue
        const family = initial.encounter.meaningLexicon!.words[second].lemma
        if (family !== initial.encounter.meaningLexicon!.words[first].lemma) otherFamilies.add(family)
        checked++
        assert.equal(final.playerResolve, 1)
        assert.equal(sorted(final.tiles.map(tile => tile.letter).join('')), sorted(rule.answer))
        assert.equal(play(final, rule.answer).status, 'won')
      }
      assert.ok(otherFamilies.size > 0, `${entry.id}: ${first} must leave another helper family`)
    }
    assert.ok(checked > 0, entry.id)
  }
})

test('hunt generation chooses removal groups with familiar follow-ups after every opening', () => {
  for (const [id, preferred, minimum] of [
    ['hunt-alert', ['SLOW', 'TIRED', 'IDLE', 'INERT'], 2],
    ['hunt-true', ['WRONG', 'UNREAL', 'INCORRECT'], 1],
  ] as const) {
    const current = encounter(id)
    const plan = planHuntRemovals(current, current.bingoHunt!.answer, preferred)
    assert.deepEqual(plan.encounter.bingoHunt, current.bingoHunt)
    assert.ok(plan.review.minPreferredFamilies >= minimum)
    assert.equal(plan.review.candidatesChecked, id === 'hunt-alert' ? 35 : 20)
    assert.ok(plan.review.pathsChecked > 0)
    const entry = entries.find(entry => entry.id === id)!
    const old = decodeConceptPuzzle(JSON.parse(readFileSync(`public/previews/concepts/${id}-${entry.progressRevision}.json`, 'utf8')), entry)
    assert.equal(inspectHuntRemovals(old, preferred).minPreferredFamilies, 0, 'old removal order had dead ends')
  }
  const current = encounter('hunt-alert')
  assert.throws(() => planHuntRemovals(current, current.bingoHunt!.answer, ['INERT']), /No removal plan preserves/)
  const afterSlow = play(createLetterStrikeGame(current), 'SLOW')
  for (const word of ['IDLE', 'TIRED', 'INERT']) {
    assert.equal(play(afterSlow, word).playerResolve, 1, word)
  }
})

test('updated hunt revisions retain old progress and replay every old physical-tile sequence', () => {
  const updated = entries.filter(entry => entry.progressRevision)
  assert.equal(updated.length, 2)
  for (const entry of updated) {
    const oldEntry = { ...entry, revision: entry.progressRevision, progressRevision: undefined }
    const old = decodeConceptPuzzle(JSON.parse(readFileSync(`public/previews/concepts/${entry.id}-${entry.progressRevision}.json`, 'utf8')), oldEntry)
    const current = encounter(entry.id)
    assert.ok(certifyHuntProgressCompatibility(old, current).movesChecked > 0)
    assert.equal(conceptProgressKey(entry), conceptProgressKey(oldEntry))
    const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value) } }
    const oldStart = createLetterStrikeGame(old), key = conceptProgressKey(oldEntry)
    saveBingoAttempt(key, play(oldStart, entry.guide.answer), true, 1, storage)
    restartBingoAttempt(key, 3, storage)
    saveBingoAttempt(key, play(oldStart, entry.id === 'hunt-alert' ? 'SLOW' : 'WRONG'), true, 1, storage)
    const restored = resumeBingoAttempt(conceptProgressKey(entry), current, storage)
    assert.equal(restored.started, true)
    assert.equal(restored.game.playedWords.length, 1)
    assert.equal(restored.game.playerResolve, 2)
    assert.equal(readBingoProgress(conceptProgressKey(entry), storage).bestWords, 1)
    const changed = structuredClone(current)
    changed.startingTiles[0].letter = 'Z'
    assert.throws(() => certifyHuntProgressCompatibility(old, changed))
  }
})

test('five new hunts reproduce their removal plans and keep familiar alternatives after every opening', () => {
  const additions = huntProfiles.filter(profile => !profile.progressRevision)
  assert.deepEqual(additions.map(({ profile }) => profile.enemy), ['WET', 'LOUD', 'DIM', 'THIN', 'BIG'])
  for (const { profile, preferredHelpers, helpers } of additions) {
    const current = encounter(`hunt-${profile.id}`)
    const plan = planHuntRemovals(current, profile.bingo, preferredHelpers)
    assert.deepEqual(plan.encounter.bingoHunt, current.bingoHunt)
    assert.ok(plan.review.minPreferredFamilies >= 1)
    assert.ok(plan.review.pathsChecked > 0)
    const initial = createLetterStrikeGame(current)
    for (const word of Object.keys(current.meaningLexicon!.words)) {
      const ids = selectWordIds(initial.tiles, word)
      if (ids && previewLetterStrike(initial, ids).bingoHunt?.won) {
        assert.ok(wordEffort(word) >= Math.max(...helpers.map(wordEffort)) + .4, `${word}: easier than the helper route`)
      }
    }
    const entry = entries.find(entry => entry.id === `hunt-${profile.id}`)!
    const key = conceptProgressKey(entry)
    const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value) } }
    let game = play(createLetterStrikeGame(current), helpers[0])
    saveBingoAttempt(key, game, true, 1, storage)
    assert.deepEqual(resumeBingoAttempt(key, current, storage).game, game)
    game = play(play(game, helpers[1]), profile.bingo)
    saveBingoAttempt(key, game, true, 1, storage)
    assert.equal(readBingoProgress(key, storage).bestWords, 3)
    restartBingoAttempt(key, 3, storage)
    saveBingoAttempt(key, play(createLetterStrikeGame(current), profile.bingo), true, 1, storage)
    assert.equal(readBingoProgress(key, storage).bestWords, 1)
  }
})

test('new hunts accept reviewed adjective meanings, including common omissions, without accepting verbs or nouns', () => {
  for (const [id, accepted, rejected] of [
    ['hunt-wet', ['DRY', 'DRIER', 'ARID', 'PARCHED'], ['DRIES', 'WATERY']],
    ['hunt-loud', ['QUIET', 'SILENT', 'LOW', 'MUTED', 'THIN'], ['MUTES', 'WILD']],
    ['hunt-dim', ['BRIGHT', 'BRILLIANT', 'LAMBENT', 'LIGHT', 'LIT'], ['ILLUMINATE', 'LITER', 'DULL']],
    ['hunt-dim-armoured', ['BRIGHT', 'LIGHT', 'LIT'], ['ILLUMINATE', 'LITER', 'DULL']],
    ['hunt-thin', ['THICK', 'DENSE', 'VISCOUS', 'HEAVY'], ['THICKEN', 'STICKY']],
    ['hunt-big', ['LITTLE', 'TINY', 'MINUTE', 'MINI', 'SLIM'], ['MINIS', 'BULGING']],
  ] as const) {
    const game = createLetterStrikeGame(encounter(id))
    for (const word of [...accepted, ...rejected]) {
      const ids = selectWordIds(game.tiles, word)
      assert.ok(ids, `${id}: ${word} must be on the actual board`)
      const preview = previewLetterStrike(game, ids)
      assert.equal(preview.valid, (accepted as readonly string[]).includes(word), `${id}: ${word}`)
      if (preview.valid) assert.deepEqual(game.encounter.meaningLexicon!.words[word].partsOfSpeech, ['adjective'])
    }
  }
  assert.equal(encounter('hunt-big').meaningLexicon!.words.MINI.source, 'wiktionary-en')
  const wrongType = structuredClone(encounter('hunt-big-armoured'))
  wrongType.meaningLexicon!.words.NEGLIGIBLE.partsOfSpeech = ['noun']
  assert.throws(() => createLetterStrikeGame(wrongType), /part of speech/)
  assert.deepEqual(encounter('hunt-dim-armoured').meaningLexicon!.words.LITER.partsOfSpeech, ['noun'])
})

test('invalid meanings and repeats spend no lives, reveal no spare tiles, and do not enter the log', () => {
  const initial = createLetterStrikeGame(encounter('hunt-alert'))
  const neutral = Object.keys(initial.encounter.meaningLexicon!.words).find(word => {
    return initial.encounter.meaningLexicon!.words[word].relation !== 'opposite' && selectWordIds(initial.tiles, word)
  })!
  const invalid = submitLetterStrike(initial, selectWordIds(initial.tiles, neutral)!)
  assert.match(invalid.error!, /No life lost/)
  assert.deepEqual({ ...invalid, error: null }, initial)
  const first = play(initial, 'INERT')
  const repeated = submitLetterStrike(first, selectWordIds(first.tiles, 'INERT')!)
  assert.match(repeated.error!, /Already tried/)
  assert.deepEqual({ ...repeated, error: null }, first)
  const ids = selectWordIds(initial.tiles, 'SLOW')!
  assert.equal(previewLetterStrike(initial, [...ids, ids[0]]).valid, false)
  const preview = previewLetterStrike(initial, ids)
  assert.deepEqual(initial.tiles, initial.encounter.startingTiles)
  assert.equal(preview.strikes, 0)
  assert.equal(getStrikeSummary(preview, 3, 'ALERT', initial.encounter.counterRules)?.hits, '4 spare tiles removed')
})

test('hunt saves replay removals exactly, keep their best stars, and remain separate from classic previews', () => {
  const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  const entry = entries[0], key = conceptProgressKey(entry), start = createLetterStrikeGame(encounter(entry.id))
  const first = play(start, 'SLOW')
  saveBingoAttempt(key, first, true, 1, storage)
  assert.deepEqual(resumeBingoAttempt(key, start.encounter, storage).game, first)
  const won = play(play(first, 'INERT'), entry.guide.answer)
  saveBingoAttempt(key, won, true, 1, storage)
  restartBingoAttempt(key, 3, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 3)
  saveBingoAttempt(key, play(start, entry.guide.answer), true, 1, storage)
  assert.equal(readBingoProgress(key, storage).bestWords, 1)
  assert.notEqual(key, conceptProgressKey(conceptPreviews.find(entry => entry.id === 'alert')!))
  assert.deepEqual([...data.keys()], [key])
})

test('hunt rejects damaged answer copies, duplicate removals, wrong answers and refill rules', () => {
  const initial = encounter('hunt-alert')
  for (const mutate of [
    (e: typeof initial) => { e.bingoHunt!.removalOrder = [0, 0] },
    (e: typeof initial) => { e.bingoHunt!.answer = 'WRONG' },
    (e: typeof initial) => { e.startingResolve = 2 },
    (e: typeof initial) => { e.bingoHunt!.removalOrder = e.startingTiles.slice(0, 7).map(tile => tile.id) },
  ]) {
    const invalid = structuredClone(initial); mutate(invalid)
    assert.throws(() => createLetterStrikeGame(invalid), /Bingo hunt/)
  }
  const entry = entries[0]
  assert.throws(() => decodeConceptPuzzle({ ...initial, bingoHunt: undefined }, entry), /Wrong preview/)
})
