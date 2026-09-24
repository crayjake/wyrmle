import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import { evaluateLetterStrike, getLetterStrikeAllowance } from '../game/letterStrike.ts'
import type { LetterStrikeState, LetterStrikeTile } from '../game/letterStrike.ts'

export type MaximumImmediateStrikesState = Pick<LetterStrikeState, 'tiles' | 'enemyLetters' | 'encounter' | 'status'>

// The same bundled dictionary as damage mode; no extra word list or requests.
// Build masks lazily so merely loading the DEV comparison adds no search work.
let dictionaryMasks: Uint32Array | null = null

function getDictionaryMasks(): Uint32Array {
  if (dictionaryMasks) return dictionaryMasks
  dictionaryMasks = new Uint32Array(englishWords.length)
  for (let index = 0; index < englishWords.length; index += 1) {
    let mask = 0
    for (const letter of englishWords[index]) {
      const code = letter.charCodeAt(0) - 97
      if (code < 0 || code >= 26) {
        mask = 0x80000000
        break
      }
      mask |= 1 << code
    }
    dictionaryMasks[index] = mask
  }
  return dictionaryMasks
}

function isStrikeTile(state: MaximumImmediateStrikesState, tile: LetterStrikeTile): boolean {
  return tile.type === 'gem' && tile.gem !== undefined
    && state.encounter.tileEffects[tile.gem]?.strike === true
}

/**
 * Exact maximum over legal dictionary words and their possible tile identities.
 * This searches attainable selections and scores them with the combat engine;
 * the board's raw matching-letter capacity is only an early-exit upper bound.
 *
 * The combat engine provides the semantic/LONG/grammar normal-hit allowance. Under
 * additive rules, use Strike copies first so an ordinary copy cannot consume
 * the last matching target and waste a guaranteed hit. Historical rules instead
 * reserve Strike copies until after normal hits. Track remaining same-letter
 * target capacity in word order, including repeated armour hits.
 * This maximizes attainable hits without enumerating equivalent tile IDs.
 * Ward, REGEN and ordinary copies are interchangeable for this gross-strike
 * metric: recovery happens after all strikes and never changes their count.
 */
export function getMaximumImmediateStrikes(state: MaximumImmediateStrikesState): number {
  if (state.status !== 'playing') return 0
  const strikeConsumesAllowance = state.encounter.strikeConsumesAllowance === true

  const tileCounts = new Uint8Array(26)
  const enemyCapacity = new Uint16Array(26)
  const strikeTiles: LetterStrikeTile[][] = Array.from({ length: 26 }, () => [])
  const ordinaryTiles: LetterStrikeTile[][] = Array.from({ length: 26 }, () => [])
  let boardMask = 0
  for (const tile of state.tiles) {
    const code = tile.letter.toUpperCase().charCodeAt(0) - 65
    tileCounts[code] += 1
    boardMask |= 1 << code
    const buckets = isStrikeTile(state, tile) ? strikeTiles : ordinaryTiles
    buckets[code].push(tile)
  }
  for (const letter of state.enemyLetters) {
    if (letter.hitsRemaining > 0) {
      enemyCapacity[letter.letter.toUpperCase().charCodeAt(0) - 65] += letter.hitsRemaining
    }
  }
  const upperBound = tileCounts.reduce((total, count, code) => total + Math.min(count, enemyCapacity[code]), 0)
  if (upperBound === 0) return 0

  const masks = getDictionaryMasks()
  const usedLetters = new Uint8Array(26)
  const usedStrike = new Uint8Array(26)
  const usedOrdinary = new Uint8Array(26)
  const remainingCapacity = new Uint16Array(26)
  let maximum = 0
  for (let index = 0; index < englishWords.length; index += 1) {
    const word = englishWords[index]
    if (word.length < state.encounter.minimumWordLength || word.length > state.tiles.length
      || (masks[index] & ~boardMask) !== 0) continue

    usedLetters.fill(0)
    let feasible = true
    for (let position = 0; position < word.length; position += 1) {
      const code = word.charCodeAt(position) - 97
      usedLetters[code] += 1
      if (usedLetters[code] > tileCounts[code]) {
        feasible = false
        break
      }
    }
    if (!feasible) continue

    const matchingCapacity = usedLetters.reduce((sum, count, code) => sum + Math.min(count, enemyCapacity[code]), 0)
    let normalStrikesRemaining = getLetterStrikeAllowance(state.encounter, word, matchingCapacity).normalStrikeAllowance
    remainingCapacity.set(enemyCapacity)
    usedStrike.fill(0)
    usedOrdinary.fill(0)
    const selected: LetterStrikeTile[] = []
    for (let position = 0; position < word.length; position += 1) {
      const code = word.charCodeAt(position) - 97
      const normalMatch = normalStrikesRemaining > 0 && remainingCapacity[code] > 0
      const ordinaryAvailable = usedOrdinary[code] < ordinaryTiles[code].length
      const strikeAvailable = usedStrike[code] < strikeTiles[code].length
      const useOrdinary = ordinaryAvailable && (!strikeAvailable || (strikeConsumesAllowance && normalMatch))
      if (useOrdinary) {
        selected.push(ordinaryTiles[code][usedOrdinary[code]++])
      } else {
        selected.push(strikeTiles[code][usedStrike[code]++])
      }
      if (remainingCapacity[code] > 0 && (normalMatch || !useOrdinary)) {
        remainingCapacity[code] -= 1
        if (normalMatch && (useOrdinary || strikeConsumesAllowance)) normalStrikesRemaining -= 1
      }
    }
    maximum = Math.max(maximum, evaluateLetterStrike(state, selected).strikes)
    if (maximum === upperBound) return maximum
  }
  return maximum
}
