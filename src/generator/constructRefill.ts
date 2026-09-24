import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState, LetterStrikeTile } from '../game/letterStrike.ts'
import type { Random } from './random.ts'
import type { CandidatePuzzle } from './types.ts'

type PlanningWord = { word: string; commonness: number | null }

export function selectWordIds(tiles: readonly LetterStrikeTile[], word: string, preferSpecials = true): number[] | null {
  const ids: number[] = []
  for (const letter of word) {
    const matches = tiles.filter(tile => tile.letter === letter && !ids.includes(tile.id))
      .sort((a, b) => (preferSpecials ? 1 : -1) * (Number(b.type === 'gem') - Number(a.type === 'gem')) || a.id - b.id)
    if (!matches.length) return null
    ids.push(matches[0].id)
  }
  return ids
}

function missingLetters(word: string, kept: readonly LetterStrikeTile[]): string[] {
  const letters = kept.map(tile => tile.letter)
  const missing: string[] = []
  for (const letter of word) {
    const index = letters.indexOf(letter)
    if (index < 0) missing.push(letter)
    else letters.splice(index, 1)
  }
  return missing
}

/** Forward construction asks the real engine what a word does, then supplies
 * the next lexical opportunity in the exact slots consumed by that move. */
export function constructRefill(
  encounter: LetterStrikeEncounter, vocabulary: readonly PlanningWord[], random: Random, targetTurns = encounter.startingResolve,
): Pick<CandidatePuzzle, 'construction'> & { refillQueue: string } {
  const words = vocabulary.filter(entry => entry.word.length >= 3 && entry.word.length <= 10 && (entry.commonness ?? 0) >= 0.45)
  const reservoir = random.shuffle(words.filter(entry => entry.word.length >= 5)).map(entry => entry.word).join('') || 'LATERMERRYHAPPY'
  const queueLength = (encounter.startingResolve + 1) * 16
  const pad = (prefix: string) => (prefix + reservoir.repeat(Math.ceil(queueLength / reservoir.length) + 1)).slice(0, Math.max(queueLength, prefix.length))
  let state = createLetterStrikeGame({ ...encounter, refillQueue: pad('') })
  let prefix = ''
  const construction: CandidatePuzzle['construction'] = {
    method: 'overlapping-multisets-and-lookahead', plannedWords: [], plannedTileIds: [], refillBlocks: [], mutations: [],
  }
  let intended: string | null = null
  for (let turn = 0; turn < encounter.startingResolve + 1 && state.status === 'playing'; turn++) {
    const remainingHits = state.enemyLetters.reduce((sum, letter) => sum + letter.hitsRemaining, 0)
    const desiredHits = Math.max(1, Math.ceil(remainingHits / Math.max(1, targetTurns - turn)))
    const choices = words.flatMap(entry => {
      const ids = selectWordIds(state.tiles, entry.word, turn > 0 || random.next() > 0.35)
      if (!ids) return []
      const preview = previewLetterStrike(state, ids)
      if (!preview.valid || preview.strikes === 0) return []
      return [{ entry, ids, preview, score: Math.min(preview.strikes, desiredHits) * 5
        - Math.max(0, preview.strikes - desiredHits) * 3 + (preview.resolveCost === 0 ? 1.5 : 0)
        + (preview.semanticLabel === 'COUNTER' ? 2 : 0)
        + (entry.commonness ?? 0) + random.next() * 2 + (entry.word === intended ? 30 : 0) }]
    }).sort((a, b) => b.score - a.score || a.entry.word.localeCompare(b.entry.word))
    const choice = choices[0]
    if (!choice) break
    const consumed = new Set(choice.ids)
    const kept = state.tiles.filter(tile => !consumed.has(tile.id))
    const futureHits = Math.max(1, Math.ceil((remainingHits - choice.preview.strikes) / Math.max(1, targetTurns - turn - 1)))
    const future = words.flatMap(entry => {
      const missing = missingLetters(entry.word, kept)
      if (missing.length > choice.ids.length) return []
      const hypothetical = [...kept, ...missing.map((letter, index): LetterStrikeTile => ({ id: state.nextTileId + index, letter, type: 'normal' }))]
      const ids = selectWordIds(hypothetical, entry.word)
      if (!ids) return []
      const projected: LetterStrikeState = { ...state, tiles: hypothetical, enemyLetters: choice.preview.enemyLetters }
      const preview = previewLetterStrike(projected, ids)
      if (!preview.valid || preview.strikes === 0) return []
      const rareCoverage = preview.hits.reduce((sum, hit) => sum + 1 / Math.max(1, words.filter(word => word.word.includes(hit.letter)).length), 0)
      return [{ entry, missing, score: Math.min(preview.strikes, futureHits) * 4
        - Math.max(0, preview.strikes - futureHits) * 3 + rareCoverage * 30 + (preview.resolveCost === 0 ? 1.5 : 0)
        + (preview.semanticLabel === 'COUNTER' ? 2 : 0)
        + (entry.commonness ?? 0) + random.next() * 2 - (entry.word === choice.entry.word ? 1 : 0) }]
    }).sort((a, b) => b.score - a.score || a.entry.word.localeCompare(b.entry.word))
    const next = future[0]
    const block = next ? [...next.missing] : []
    // Unused refill slots replenish the selected counter/long-word vocabulary.
    const support = next?.entry.word ?? random.pick(words).word
    const replenishment = random.shuffle([...support])
    while (block.length < choice.ids.length) block.push(replenishment[block.length % replenishment.length])
    const letters = random.shuffle(block).join('')
    construction.refillBlocks.push({ offset: prefix.length, letters, supports: support })
    prefix += letters
    state = { ...state, encounter: { ...encounter, refillQueue: pad(prefix) } }
    construction.plannedWords.push(choice.entry.word)
    construction.plannedTileIds.push(choice.ids)
    state = submitLetterStrike(state, choice.ids)
    intended = next?.entry.word ?? null
  }
  return { refillQueue: pad(prefix), construction }
}
