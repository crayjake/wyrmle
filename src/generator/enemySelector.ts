import { normalizeWord } from '../game/dictionary.ts'
import { analyseEnemySuitability } from './enemySuitability.ts'
import type { EnemySuitability } from './enemySuitability.ts'
import { localLexicalProvider } from './lexicalProvider.ts'
import type { LexicalProvider } from './lexicalProvider.ts'
import { createRandom } from './random.ts'

export type EnemySelectionOptions = {
  provider?: LexicalProvider
  candidateWords?: readonly string[]
  sampleSize?: number
}
export type EnemySelection = {
  selected: string | null
  suitability: EnemySuitability | null
  candidates: EnemySuitability[]
  rejected: EnemySuitability[]
}

export function selectEnemy(seed: string | number, options: EnemySelectionOptions = {}): EnemySelection {
  const provider = options.provider ?? localLexicalProvider
  const random = createRandom(`${seed}:enemy-selection`)
  const words = [...new Set((options.candidateWords ?? provider.enemyWords()).map(normalizeWord))].sort()
  const sampleSize = options.sampleSize === undefined ? words.length : Math.max(0, Math.floor(options.sampleSize))
  const candidates = random.shuffle(words).slice(0, sampleSize).map(word => analyseEnemySuitability(word, provider))
    .sort((a, b) => b.overallScore - a.overallScore || a.word.localeCompare(b.word))
  const eligible = candidates.filter(candidate => candidate.eligible)
  if (!eligible.length) return { selected: null, suitability: null, candidates, rejected: candidates }
  // Weighted choice keeps several good concepts in circulation without allowing
  // a poor concept to pass the explicit suitability gate.
  let remaining = random.next() * eligible.reduce((total, candidate) => total + candidate.overallScore ** 2, 0)
  let suitability = eligible[eligible.length - 1]
  for (const candidate of eligible) {
    remaining -= candidate.overallScore ** 2
    if (remaining < 0) { suitability = candidate; break }
  }
  return { selected: suitability.word, suitability, candidates, rejected: candidates.filter(candidate => !candidate.eligible) }
}
