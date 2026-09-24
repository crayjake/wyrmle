import type { LetterStrikeTile } from '../game/letterStrike.ts'
import type { Random } from './random.ts'

export function letterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const letter of word.toUpperCase()) counts.set(letter, (counts.get(letter) ?? 0) + 1)
  return counts
}

/** Multiset union shares physical letters between words, rather than joining words. */
export function overlappingLetters(words: readonly string[]): string[] {
  const counts = new Map<string, number>()
  for (const word of words) {
    for (const [letter, count] of letterCounts(word)) counts.set(letter, Math.max(count, counts.get(letter) ?? 0))
  }
  return [...counts].flatMap(([letter, count]) => Array<string>(count).fill(letter))
}

export function canSpell(word: string, letters: readonly string[]): boolean {
  const counts = letterCounts(letters.join(''))
  for (const letter of word) {
    const count = counts.get(letter) ?? 0
    if (!count) return false
    counts.set(letter, count - 1)
  }
  return true
}

export function constructBoard(anchors: readonly string[], vocabulary: readonly string[], random: Random): LetterStrikeTile[] {
  const letters = overlappingLetters(anchors)
  if (letters.length > 16) throw new Error('Anchor multiset exceeds sixteen tiles.')
  // Complete near-playable ordinary words. The final tie-breaking prior favours
  // familiar English vowels/consonants, but every addition tries to unlock a word.
  const prior = 'EEEEEEEEAAAARRRRIIIIOOOOTTTTNNNNSSSSLLLLCCDDHMMUY'
  while (letters.length < 16) {
    const choices = vocabulary.map(word => {
      const union = overlappingLetters([letters.join(''), word])
      const missing = union.length - letters.length
      return { word, union, missing }
    }).filter(choice => choice.missing > 0 && choice.missing <= 16 - letters.length)
      .sort((a, b) => a.missing - b.missing || b.word.length - a.word.length || a.word.localeCompare(b.word))
    if (choices.length) {
      const choice = random.pick(choices.slice(0, 6))
      letters.splice(0, letters.length, ...choice.union)
    } else letters.push(random.pick([...prior]))
  }
  return random.shuffle(letters).map((letter, id) => ({ id, letter, type: 'normal' }))
}
