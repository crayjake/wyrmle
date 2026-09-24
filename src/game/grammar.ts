import type { GrammarRules, PartOfSpeech } from './types.ts'

export function getGrammaticalModifier(
  wordPartsOfSpeech: readonly PartOfSpeech[] | undefined,
  enemyPartOfSpeech: PartOfSpeech,
  rules: GrammarRules,
): number {
  // No guessing when annotations are missing or when a word has multiple uses.
  if (!rules.enabled || wordPartsOfSpeech?.length !== 1) return 0

  const partOfSpeech = wordPartsOfSpeech[0]
  if (partOfSpeech === 'adjective' && enemyPartOfSpeech === 'noun') return rules.bonus
  if (partOfSpeech === 'adverb' && (enemyPartOfSpeech === 'verb' || enemyPartOfSpeech === 'adjective')) {
    return rules.bonus
  }
  return 0
}
