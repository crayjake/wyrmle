import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createLetterStrikeGame, previewLetterStrike,
} from '../src/experimental/letterStrike.ts'
import type { EnemyLetter, LetterStrikeState, LetterStrikeTile } from '../src/experimental/letterStrike.ts'
import { getMaximumImmediateStrikes } from '../src/experimental/maxStrikes.ts'

function tiles(letters: string, strikeIds: number[] = [], wardIds: number[] = []): LetterStrikeTile[] {
  return [...letters].map((letter, id) => ({
    id,
    letter,
    type: strikeIds.includes(id) || wardIds.includes(id) ? 'gem' : 'normal',
    ...(strikeIds.includes(id) ? { gem: 'strike' as const } : wardIds.includes(id) ? { gem: 'ward' as const } : {}),
  }))
}

function enemy(letters: string, armouredIds: number[] = []): EnemyLetter[] {
  return [...letters].map((letter, index) => ({
    id: `target-${index}`,
    letter,
    hitsRemaining: armouredIds.includes(index) ? 2 : 1,
    initialHits: armouredIds.includes(index) ? 2 : 1,
  }))
}

// Small reachable-position fixtures let an independent brute-force oracle try
// every selection order and physical tile assignment, not the solver's strategy.
function fixture(
  board: LetterStrikeTile[],
  enemyLetters: EnemyLetter[],
  opposite: string[] = [],
  similar: string[] = [],
  related: string[] = [],
): LetterStrikeState {
  const state = createLetterStrikeGame()
  return {
    ...state,
    tiles: board,
    enemyLetters,
    encounter: {
      ...state.encounter,
      enemy: {
        ...state.encounter.enemy,
        semanticRelations: { opposite, similar, related },
      },
    },
  }
}

function bruteForceMaximum(state: LetterStrikeState): number {
  let maximum = 0
  const selected: number[] = []
  function visit() {
    if (selected.length >= state.encounter.minimumWordLength) {
      const preview = previewLetterStrike(state, selected)
      if (preview.valid) maximum = Math.max(maximum, preview.strikes)
    }
    for (const tile of state.tiles) {
      if (selected.includes(tile.id)) continue
      selected.push(tile.id)
      visit()
      selected.pop()
    }
  }
  visit()
  return maximum
}

test('the starting immediate maximum is an attainable CHEER counter, not raw board capacity', () => {
  const state = createLetterStrikeGame()
  const before = structuredClone(state)
  const cheer = previewLetterStrike(state, [3, 4, 5, 6, 7])
  assert.equal(cheer.word, 'CHEER')
  assert.equal(cheer.valid, true)
  assert.equal(cheer.strikes, 3)
  assert.equal(getMaximumImmediateStrikes(state), cheer.strikes)
  assert.deepEqual(state, before)
})

test('board letters that cannot form a dictionary word do not become hypothetical strikes', () => {
  const state = fixture(tiles('QZX'), enemy('QZX'))
  assert.equal(bruteForceMaximum(state), 0)
  assert.equal(getMaximumImmediateStrikes(state), 0)
})

test('a neutral maximum considers word order and can reserve a Strike after its normal hit', () => {
  const state = fixture(tiles('ATE', [0]), enemy('ATE'))
  assert.equal(previewLetterStrike(state, [0, 1, 2]).strikes, 1) // ATE: Strike is also the normal hit.
  assert.equal(previewLetterStrike(state, [2, 0, 1]).strikes, 2) // EAT: E hits normally, Strike A follows.
  assert.equal(getMaximumImmediateStrikes(state), 2)
})

test('same-letter tile identities can preserve a second strike on an armoured target', () => {
  const state = fixture(tiles('EEL', [0]), enemy('E', [0]))
  assert.equal(previewLetterStrike(state, [0, 1, 2]).strikes, 1)
  assert.equal(previewLetterStrike(state, [1, 0, 2]).strikes, 2)
  assert.equal(getMaximumImmediateStrikes(state), 2)
  assert.equal(getMaximumImmediateStrikes({ ...state, tiles: [...state.tiles].reverse() }), 2)
})

test('resisted dictionary words can use multiple Strike tiles, but dead targets never count', () => {
  const state = fixture(tiles('ATE', [0, 1]), enemy('ATE'), [], ['ATE', 'AET', 'TAE', 'TEA', 'EAT', 'ETA'])
  assert.equal(getMaximumImmediateStrikes(state), 2)
  const removedA = { ...state, enemyLetters: state.enemyLetters.map((letter, index) => index === 0 ? { ...letter, hitsRemaining: 0 } : letter) }
  assert.equal(getMaximumImmediateStrikes(removedA), 1)
  const removedSpecialTargets = { ...removedA, enemyLetters: removedA.enemyLetters.map((letter, index) => index === 1 ? { ...letter, hitsRemaining: 0 } : letter) }
  assert.equal(getMaximumImmediateStrikes(removedSpecialTargets), 0)
})

test('counter Strike tiles do not double-count and two E tiles can break and remove armour', () => {
  const state = fixture(tiles('CHEER', [0, 1, 2]), enemy('CHE', [2]), ['CHEER'])
  assert.equal(previewLetterStrike(state, [0, 1, 2, 3, 4]).strikes, 4)
  assert.equal(getMaximumImmediateStrikes(state), 4)
  assert.equal(getMaximumImmediateStrikes({ ...state, enemyLetters: enemy('CHE') }), 3)
})

test('related words are neutral and Ward changes no immediate strike maximum', () => {
  const state = fixture(tiles('ATE', [0], [1]), enemy('ATE'), [], [], ['ATE', 'EAT', 'TEA'])
  assert.equal(getMaximumImmediateStrikes(state), 2)
  const ordinaryWard = { ...state, tiles: state.tiles.map((tile) => tile.gem === 'ward' ? { id: tile.id, letter: tile.letter, type: 'normal' as const } : tile) }
  assert.equal(getMaximumImmediateStrikes(ordinaryWard), 2)
})

test('the search obeys minimum word length, completion state and current remaining letters', () => {
  const state = fixture(tiles('ATE', [0]), enemy('ATE'))
  assert.equal(getMaximumImmediateStrikes({ ...state, encounter: { ...state.encounter, minimumWordLength: 4 } }), 0)
  assert.equal(getMaximumImmediateStrikes({ ...state, status: 'won' }), 0)
  assert.equal(getMaximumImmediateStrikes({ ...state, status: 'lost' }), 0)
  assert.equal(getMaximumImmediateStrikes({ ...state, enemyLetters: enemy('XYZ') }), 0)
  assert.equal(getMaximumImmediateStrikes({ ...state, selectedTileIds: [0] }), 2)
})

test('exact solver agrees with exhaustive legal selections across special identities and damaged duplicates', () => {
  for (let strikeMask = 0; strikeMask < 32; strikeMask += 1) {
    const strikeIds = [...Array(5).keys()].filter((index) => (strikeMask & 1 << index) !== 0)
    for (const wounded of [false, true]) {
      const targets = enemy('AATE', [0, 2])
      if (wounded) {
        targets[0].hitsRemaining = 1
        targets[1].hitsRemaining = 0
      }
      const state = fixture(tiles('AATER', strikeIds), targets, ['RATE', 'TEAR'], ['EAT', 'ARE'], ['ATE', 'TEA'])
      assert.equal(getMaximumImmediateStrikes(state), bruteForceMaximum(state), `Strike mask ${strikeMask}, wounded ${wounded}`)
    }
  }
})
