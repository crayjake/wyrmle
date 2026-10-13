/** Puzzle-selection rules, not rules for accepting a player's antonym. */
export const avoidsLessAnswer = (word: string) => !/LESS(?:NESS(?:ES)?|LY)?$/.test(word.toUpperCase())

const negativePrefixes = ['ANTI', 'COUNTER', 'DIS', 'NON', 'MIS', 'UN', 'DE', 'IN', 'IM', 'IL', 'IR']
// Editorially reviewed root variants that a literal substring check misses.
const relatedRoots = [['MOBILE', 'MOVABLE'], ['LEGAL', 'LEGITIMATE']]
const forms = (word: string, lemma?: string) => [...new Set([word, lemma]
  .filter((value): value is string => Boolean(value)).map(value => value.toUpperCase())
  .filter(value => /^[A-Z]{3,}$/.test(value)))]

/** Require a rearrangement: do not leave the enemy intact inside its answer.
 * Pinned lemmas also catch inflections; removing an obvious negative prefix
 * catches pairs such as INHUMAN / HUMANITARIAN. This is a conservative spelling
 * filter. Human review still checks less obvious shared roots and difficulty. */
export function bingoQualityIssue(enemy: string, answer: string, enemyLemma?: string, answerLemma?: string): string | undefined {
  if (!avoidsLessAnswer(answer)) return 'Avoid -less answers, including -lessness'
  const enemies = forms(enemy, enemyLemma), answers = forms(answer, answerLemma)
  for (const left of enemies) for (const right of answers) {
    const bareForms = (word: string) => [word, ...negativePrefixes.filter(prefix => word.startsWith(prefix)).map(prefix => word.slice(prefix.length))]
    if (relatedRoots.some(family => bareForms(left).some(word => family.includes(word)) && bareForms(right).some(word => family.includes(word)))) {
      return 'Bingo must not reuse a reviewed variant of the same enemy root'
    }
    if (left.includes(right) || right.includes(left)) return 'Bingo must rearrange the enemy, not add or remove a prefix or suffix'
    for (const [word, other] of [[left, right], [right, left]]) {
      for (const prefix of negativePrefixes) {
        const stem = word.slice(prefix.length)
        if (word.startsWith(prefix) && stem.length >= 4 && other.includes(stem)) {
          return 'Bingo must not reuse the enemy root by changing its negative prefix or suffix'
        }
      }
    }
  }
}
