import { canSpell } from '../../src/generator/constructBoard.ts'
import type { LetterStrikeEncounter } from '../../src/game/letterStrike.ts'

/** Kept after retirement as well as while a puzzle is in the public calendar. */
export type PuzzleIdentity = { id: string; enemy: string; board: string; bingos: string[]; bingoFamilies: string[] }

export function puzzleIdentity(id: string, encounter: LetterStrikeEncounter): PuzzleIdentity {
  const board = encounter.startingTiles.map(tile => tile.letter).sort().join('')
  const hits = encounter.enemyLetters.map(letter => letter.letter.repeat(letter.initialHits)).join('')
  const words = encounter.meaningLexicon!.words
  const bingos = Object.keys(words).filter(word => words[word].relation === 'opposite'
    && canSpell(word, [...board]) && canSpell(hits, [...word])).sort()
  return { id, enemy: encounter.enemy.word, board, bingos,
    bingoFamilies: [...new Set(bingos.map(word => words[word].lemma.toUpperCase()))].sort() }
}

export function freshnessIssues(candidate: PuzzleIdentity, history: readonly PuzzleIdentity[]): string[] {
  const issues: string[] = []
  for (const old of history) {
    // Tile order and refills alone cannot make the same starting puzzle new.
    if (old.board === candidate.board) issues.push(`Starting letter pool repeats ${old.id}`)
    const repeated = candidate.bingoFamilies.filter(lemma => old.bingoFamilies.includes(lemma))
    if (repeated.length) issues.push(`Bingo family ${repeated.join(', ')} repeats ${old.id}`)
  }
  return issues
}

export function mergeDailyWindow<T extends { date: string }>(existing: readonly T[], replacements: readonly T[]): T[] {
  const dates = new Set(replacements.map(entry => entry.date))
  if (dates.size !== replacements.length) throw new Error('Duplicate replacement dates')
  return [...existing.filter(entry => !dates.has(entry.date)), ...replacements].sort((a, b) => a.date.localeCompare(b.date))
}
