import assert from 'node:assert/strict'
import test from 'node:test'
import { yearProfile, yearThemes, retargetYearMeanings } from '../scripts/bingo/year/profiles.ts'
import { createBingoMeanings } from '../scripts/bingo/meanings.ts'
import { getMeaningSense, getWordMeanings } from '../scripts/lib/wordMeanings.ts'
import { createLetterStrikeGame } from '../src/game/letterStrike.ts'

// New pools are explicitly pinned. A source update must be reviewed, never
// silently replace a root with a word's first homograph or an unchecked edge.
test('year concept pools pin existing definitions, keep their poles distinct and exclude unreviewed derivations', () => {
  assert.equal(new Set(yearThemes.map(t => t.id)).size, yearThemes.length)
  for (const theme of yearThemes) {
    const poles = theme.poles.map(pole => new Set(pole.map(root => {
      const sense = getMeaningSense(root.senseId)
      assert.ok(sense, `${theme.id}: ${root.senseId}`)
      assert.equal(sense.definition, root.definition)
      assert.ok(sense.lemma.toUpperCase() === root.word || getWordMeanings(root.word).senses.some(s => s.id === root.senseId), `${theme.id}: ${root.word}`)
      return sense.synset
    })))
    assert.ok([...poles[0]].every(s => !poles[1].has(s)), `Conflicting poles: ${theme.id}`)
    const profile = yearProfile(theme, 0)
    assert.ok(profile.roots.every(r => getMeaningSense(r.senseId)!.relations.filter(e => e.type === 'derivation')
      .every(e => profile.excludedDerivations.includes(e.target))))
  }
})

test('retargeted inventories equal a fresh semantic compilation, including the enemy and publication header', () => {
  const theme = yearThemes.find(t => t.id === 'light')!
  const base = createBingoMeanings(yearProfile(theme, 0))
  const candidate = { theme: 'light', side: 0 as const, enemy: 'DIM', bingo: 'ILLUMINATED',
    enemySense: base.meanings.DIM.senseId, enemyLemma: 'dim', bingoLemma: 'illuminate', armour: 1, frequency: .5 }
  const profile = yearProfile(theme, 0, candidate)
  const reused = retargetYearMeanings(profile, base), fresh = createBingoMeanings(profile)
  assert.deepEqual(reused.relations, fresh.relations)
  for (const [word, meaning] of Object.entries(fresh.meanings)) assert.deepEqual(reused.meanings[word], meaning, word)
  const shell = { ...createLetterStrikeGame().encounter, enemy: { word: 'DIM', definition: fresh.enemySense.definition },
    startingTiles: [...'ILLUMINATEDSROCYX'].map((letter, id) => ({ letter, id, type: 'normal' as const })) }
  assert.deepEqual(reused.compile(shell), fresh.compile(shell))
  assert.equal(reused.enemySense.id, candidate.enemySense)
})
