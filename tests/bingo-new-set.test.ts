import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bingoProfiles, bingoProfileVersion } from '../scripts/bingo/meanings.ts'
import { validateBingo } from '../scripts/bingo/validate.ts'
import { getMeaningSense, getWordMeanings } from '../scripts/lib/wordMeanings.ts'
import { bingoPreviews } from '../src/experimental/bingo/catalog.ts'
import { getBingoGuide } from '../src/experimental/bingo/guides.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'
import { bingoEncounter } from '../src/experimental/bingo/puzzle.ts'
import { canSpell } from '../src/generator/constructBoard.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'

const entries = bingoPreviews.filter(entry => entry.collection === 'new')
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))

test('five distinct new bingo-first puzzles replay diverse ordinary routes at 3, 4 and 5 lives', () => {
  assert.equal(entries.length, 5)
  assert.equal(new Set(entries.map(entry => entry.enemy)).size, 5)
  const earlierEnemies = new Set(bingoPreviews.filter(entry => entry.collection !== 'new').map(entry => entry.enemy))
  for (const entry of entries) {
    assert.ok(!earlierEnemies.has(entry.enemy))
    const profile = bingoProfiles.find(profile => profile.enemy === entry.enemy)!
    const report = read(`../artifacts/bingo-first-new-enemies-2026-09-26/${entry.enemy.toLowerCase()}.json`)
    const encounter = decodeBingoPreview(read(`../public/${entry.asset}`), entry, 3)
    assert.equal(report.method, 'bingo-first')
    assert.equal(report.accepted, true)
    assert.equal(encounter.meaningLexicon!.profileVersion, bingoProfileVersion(profile), 'Frozen meanings need regeneration')
    assert.equal(encounter.startingTiles.map(tile => tile.letter).join(''), report.board)
    assert.equal(encounter.refillQueue, report.refills)
    assert.equal(report.bingo, profile.bingo)
    assert.deepEqual(getBingoGuide(entry.id)?.hints, profile.hints)
    assert.equal(encounter.enemyLetters.filter(letter => letter.initialHits === 2).length >= 2, true)
    validateBingo(encounter, profile.bingo, report.analysis)
    assert.ok(report.analysis.routes.some((route: { witness: { words: string[] } | null }) => route.witness?.words.length === 3))
  }
})

test('all preview guides provide three hints and an actual one-word winning answer', () => {
  for (const entry of [...bingoPreviews, { id: 'bingo', asset: '' }]) {
    const guide = getBingoGuide(entry.id)
    assert.ok(guide, entry.id)
    assert.equal(guide.hints.length, 3)
    assert.equal(new Set(guide.hints).size, 3)
    assert.ok(guide.hints.every(hint => hint.trim().length > 10 && !hint.toUpperCase().includes(guide.answer)))
    assert.ok(guide.explanation.trim())
    const encounter = entry.id === 'bingo' ? bingoEncounter
      : decodeBingoPreview(read(`../public/${entry.asset}`), bingoPreviews.find(p => p.id === entry.id)!, 3)
    const initial = createLetterStrikeGame(encounter)
    const ids = selectWordIds(initial.tiles, guide.answer)
    assert.ok(ids, `${entry.id}: cannot spell guide answer`)
    assert.equal(submitLetterStrike(initial, ids).status, 'won', `${entry.id}: guide answer does not win`)
  }
  assert.equal(getBingoGuide('unknown'), undefined)
})

test('new semantic roots retain their exact source senses and distinguish unrelated homographs', () => {
  for (const profile of bingoProfiles) {
    assert.ok(getMeaningSense(profile.enemySense))
    for (const root of profile.roots) {
      const sense = getMeaningSense(root.senseId)
      assert.ok(sense, root.senseId)
      assert.equal(sense.definition, root.definition)
      assert.ok(getWordMeanings(root.word).senses.some(form => form.id === root.senseId), `${root.word}: wrong pinned sense`)
    }
  }
  const regressions = {
    ARID: { opposite: ['RAIN', 'RAINS', 'RAINED', 'RAINY', 'IRRIGATE', 'IRRIGATED', 'WATER', 'WATERS'], similar: ['DRY', 'DRIED', 'ARID'], unrelated: ['TRAIN', 'TRAINS'] },
    ROT: { opposite: ['RESTORE', 'RESTORED', 'RESTORATION', 'CURE', 'CURED', 'PRESERVE'], similar: ['ROT', 'ROTS', 'ROTTEN'], unrelated: ['TROT', 'TROTS'] },
    INERT: { opposite: ['REINVIGORATE', 'REINVIGORATES', 'ACTIVE', 'ACT', 'ACTION', 'STIR'], similar: ['INERT', 'TIRE', 'TIRED', 'IDLE'], unrelated: ['TIER'] },
    STINGY: { opposite: ['UNSTINTINGLY', 'GIVE', 'GIVING', 'GIFT', 'GIFTS', 'GRANT', 'SHARE', 'LENT'], similar: ['STINGY', 'STINT', 'TIGHT'], unrelated: ['STRING', 'STING'] },
    FALSE: { opposite: ['FACT', 'FACTS', 'FACTUALNESS', 'TRUE', 'TRULY', 'TRUTH'], similar: ['FALSE', 'FALSELY', 'LIE', 'LIED', 'LIES'], unrelated: ['LAY', 'LAIN'] },
  }
  for (const entry of entries) {
    const encounter = decodeBingoPreview(read(`../public/${entry.asset}`), entry, 3)
    const lexicon = encounter.meaningLexicon!
    let checked = 0
    for (const [relation, words] of Object.entries(regressions[entry.enemy as keyof typeof regressions])) {
      for (const word of words) {
        if (!canSpell(word, [...lexicon.letterSupply])) continue
        assert.equal(lexicon.words[word]?.relation, relation, `${entry.enemy}/${word}`)
        checked++
      }
    }
    assert.ok(checked >= 8, `${entry.enemy}: too few semantic regressions exercised`)
    assert.equal(lexicon.assessment, undefined, 'Source profiles must not masquerade as model certification')
  }
})
