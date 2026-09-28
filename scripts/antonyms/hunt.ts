import assert from 'node:assert/strict'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../../src/game/letterStrike.ts'
import { selectWordIds } from '../../src/generator/constructRefill.ts'
import { wordEffort } from '../bingo/routeDifficulty.ts'

function helpers(state: LetterStrikeState) {
  return Object.entries(state.encounter.meaningLexicon!.words).flatMap(([word, meaning]) => {
    if (meaning.relation !== 'opposite') return []
    const ids = selectWordIds(state.tiles, word)
    if (!ids) return []
    const preview = previewLetterStrike(state, ids)
    return preview.valid && !preview.bingoHunt!.won ? [{ word, ids, family: meaning.lemma }] : []
  })
}

/** Check every accepted opening, including an opening that was meant as a later helper. */
export function inspectHuntRemovals(encounter: LetterStrikeEncounter, preferredHelpers: readonly string[]) {
  const initial = createLetterStrikeGame(encounter)
  assert.ok(encounter.bingoHunt)
  const openings = helpers(initial)
  const preferred = new Set(preferredHelpers)
  for (const word of preferred) {
    assert.ok(openings.some(opening => opening.word === word), `${word}: not an opening helper`)
    assert.ok(wordEffort(word) <= 4.8, `${word}: needs a more familiar helper`)
  }
  const branches = openings.map(first => {
    const after = submitLetterStrike(initial, first.ids)
    const next = helpers(after)
    const useful = next.filter(option => option.family !== first.family && wordEffort(option.word) <= 4.8)
    return { first: first.word, next: next.map(option => option.word),
      preferredFamilies: [...new Set(useful.filter(option => preferred.has(option.word)).map(option => option.family))],
      familiarFamilies: [...new Set(useful.map(option => option.family))] }
  })
  return { preferredHelpers: [...preferred], branches,
    minPreferredFamilies: branches.length ? Math.min(...branches.map(branch => branch.preferredFamilies.length)) : 0,
    minFamiliarFamilies: branches.length ? Math.min(...branches.map(branch => branch.familiarFamilies.length)) : 0 }
}

/** Exhaustively choose the first half of the spare tiles to remove. Keep a
 * different, reviewed helper family available after every possible opening. */
export function planHuntRemovals(encounter: LetterStrikeEncounter, answer: string, preferredHelpers: readonly string[]) {
  const keep = selectWordIds(encounter.startingTiles, answer)
  assert.ok(keep, 'The bingo must be on the starting board')
  const spares = encounter.startingTiles.filter(tile => !keep.includes(tile.id)).map(tile => tile.id)
  assert.ok(spares.length >= 2 && spares.length <= 16)
  const firstCount = Math.ceil(spares.length / 2)
  let best: { encounter: LetterStrikeEncounter; review: ReturnType<typeof inspectHuntRemovals> } | undefined
  let candidatesChecked = 0
  for (let mask = 0; mask < 2 ** spares.length; mask++) {
    const first = spares.filter((_, index) => mask & (1 << index))
    if (first.length !== firstCount) continue
    const candidate = { ...encounter, bingoHunt: { answer,
      removalOrder: [...first, ...spares.filter(id => !first.includes(id))] } }
    const review = inspectHuntRemovals(candidate, preferredHelpers)
    candidatesChecked++
    if (!best || review.minPreferredFamilies > best.review.minPreferredFamilies
      || review.minPreferredFamilies === best.review.minPreferredFamilies && review.minFamiliarFamilies > best.review.minFamiliarFamilies) {
      best = { encounter: candidate, review }
    }
  }
  assert.ok(best && best.review.minPreferredFamilies >= 1,
    'No removal plan preserves a different familiar helper after every opening; revise the starting letters or bingo')
  // Replay all two-helper paths through the actual engine, not just letter counts.
  const initial = createLetterStrikeGame(best.encounter)
  let pathsChecked = 0
  for (const first of helpers(initial)) {
    const after = submitLetterStrike(initial, first.ids)
    assert.ok(selectWordIds(after.tiles, answer))
    for (const second of helpers(after)) {
      const final = submitLetterStrike(after, second.ids)
      assert.equal(final.playerResolve, 1)
      assert.equal([...final.tiles.map(tile => tile.letter).join('')].sort().join(''), [...answer].sort().join(''))
      assert.equal(submitLetterStrike(final, selectWordIds(final.tiles, answer)!).status, 'won')
      pathsChecked++
    }
  }
  return { encounter: best.encounter, review: { ...best.review, candidatesChecked, pathsChecked,
    removalOrder: best.encounter.bingoHunt!.removalOrder } }
}

/** A removal-only revision can share a progress key only when every old move
 * sequence still replays, including choices between duplicate physical tiles. */
export function certifyHuntProgressCompatibility(previous: LetterStrikeEncounter, next: LetterStrikeEncounter) {
  const published = (encounter: LetterStrikeEncounter) => JSON.parse(JSON.stringify({ ...encounter, bingoHunt: undefined }))
  assert.deepEqual(published(previous), published(next))
  assert.equal(previous.bingoHunt!.answer, next.bingoHunt!.answer)
  const vocabulary = Object.keys(previous.meaningLexicon!.words).filter(word => previous.meaningLexicon!.words[word].relation === 'opposite')
  let movesChecked = 0
  function spellings(state: LetterStrikeState, word: string, prefix: number[] = []): number[][] {
    if (prefix.length === word.length) return [prefix]
    return state.tiles.flatMap(tile => tile.letter === word[prefix.length] && !prefix.includes(tile.id)
      ? spellings(state, word, [...prefix, tile.id]) : [])
  }
  function visit(oldState: LetterStrikeState, newState: LetterStrikeState) {
    assert.equal(newState.status, oldState.status)
    if (oldState.status !== 'playing') return
    for (const word of vocabulary) {
      const canonical = selectWordIds(oldState.tiles, word)
      if (!canonical || !previewLetterStrike(oldState, canonical).valid) continue
      for (const ids of spellings(oldState, word)) {
        const oldNext = submitLetterStrike(oldState, ids), newNext = submitLetterStrike(newState, ids)
        assert.equal(newNext.error, null, `Old progress cannot replay ${word}`)
        assert.equal(newNext.playedWords.at(-1)!.word, word)
        assert.equal(newNext.playerResolve, oldNext.playerResolve)
        movesChecked++
        visit(oldNext, newNext)
      }
    }
  }
  visit(createLetterStrikeGame(previous), createLetterStrikeGame(next))
  return { movesChecked }
}
