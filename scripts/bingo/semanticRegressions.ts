import type { LetterStrikeEncounter } from '../../src/game/letterStrike.ts'
import { meaningSupply } from '../../src/game/meaningLexicon.ts'
import { canSpell } from '../../src/generator/constructBoard.ts'

/** Reviewed expectations for reported semantic misses. These are validation
 * assertions, never runtime label overrides or automatic antonym expansion. */
export const semanticRegressions = [{
  enemy: 'STOP', relation: 'opposite',
  words: ['START', 'STARTS', 'STARTED', 'STARTING', 'BEGIN', 'BEGINS', 'BEGAN', 'BEGUN', 'BEGINNING',
    'RESTART', 'RESTARTS', 'RESTARTED', 'RESTARTING', 'RESUME', 'RESUMES', 'RESUMED', 'RESUMING'],
  reason: 'Starting or resuming an action counters stopping it.',
}] as const

export function semanticRegressionIssues(encounter: LetterStrikeEncounter): string[] {
  const supply = [...meaningSupply(encounter)]
  return semanticRegressions.filter(c => c.enemy === encounter.enemy.word).flatMap(c => c.words
    .filter(word => word.length >= encounter.minimumWordLength && word.length <= encounter.startingTiles.length && canSpell(word, supply))
    .filter(word => encounter.meaningLexicon?.words[word]?.relation !== c.relation)
    .map(word => `Semantic regression: ${word} must counter ${c.enemy}. ${c.reason}`))
}
