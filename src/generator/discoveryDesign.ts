import type { LexicalEntry } from './lexicalProvider.ts'
import { canSpell, overlappingLetters } from './constructBoard.ts'
import type { Random } from './random.ts'

/** Editorial preferences only: these never assign a word's relation or legality.
 * A surprising, immediately understandable counter is better than an obscure
 * sense of an everyday function word. Every choice still needs compiled review.
 */
const discoveryWords: Readonly<Record<string, readonly string[]>> = {
  CHAOS: ['HALCYON', 'HARMONY', 'CHORD', 'SCHEMA', 'SERENE', 'BALANCE', 'CADENCE', 'COHERE'],
  ANGER: ['PLACID', 'MERCY', 'SOOTHE', 'SERENE', 'FORGIVE', 'COMPOSE'],
  MELANCHOLY: ['LEVITY', 'MIRTH', 'JOVIAL', 'COMEDY', 'SOLACE', 'ELATION'],
  FEAR: ['METTLE', 'VALOUR', 'VALOR', 'RESOLVE', 'COURAGE', 'BOLD'],
  DESPAIR: ['SOLACE', 'RALLY', 'REVIVE', 'HOPE', 'COMFORT'],
}
const thematicWords: Readonly<Record<string, readonly string[]>> = {
  CHAOS: ['ANARCHY', 'RANDOM', 'STORM', 'ROAR', 'MESSY', 'TANGLE', 'SHAMBLES', 'SCRAMBLE', 'HAVOC'],
  ANGER: ['RAGE', 'FURY', 'CROSS', 'RANT', 'IRATE', 'WRATH', 'RESENT'],
  MELANCHOLY: ['GLOOM', 'SORROW', 'SADNESS', 'MISERY', 'MOURN', 'BLUE'],
  FEAR: ['DREAD', 'PANIC', 'SCARED', 'TERROR', 'AFRAID', 'FRIGHT'],
  DESPAIR: ['HOPELESS', 'DESPOND', 'DESOLATE', 'DESPERATE', 'DEJECTED'],
}

export function rankThematicAnchors(entries: readonly LexicalEntry[], enemy: string): LexicalEntry[] {
  const clear = entries.filter(entry => thematicWords[enemy]?.includes(entry.word))
  return [...(clear.length >= 2 ? clear : entries)].filter(entry => entry.word.length >= 4)
    .sort((a, b) => (b.commonness ?? 0) - (a.commonness ?? 0) || a.word.localeCompare(b.word))
}

export function rankDiscoveryAnchors(entries: readonly LexicalEntry[], enemy: string): LexicalEntry[] {
  const preferences = discoveryWords[enemy] ?? []
  const score = (entry: LexicalEntry) => (preferences.includes(entry.word) ? 2 : 0)
    + (entry.word.length >= 4 ? 1 : 0) - Math.abs((entry.commonness ?? 0) - 0.65)
  const clear = entries.filter(entry => preferences.includes(entry.word))
  return [...(clear.length >= 2 ? clear : entries)].sort((a, b) => score(b) - score(a) || a.word.localeCompare(b.word))
}

/** Spend spare refill slots on overlapping counters AND the enemy's theme.
 * Supplying only the chosen next word creates a brittle scripted solution.
 * This cheap multiset heuristic proposes letters; the journey audit checks
 * their real effect after alternative plays and never treats it as a proof.
 */
export function replenishSemanticChoices(
  keptLetters: readonly string[], required: readonly string[], slots: number,
  counterWords: readonly string[], resistedWords: readonly string[], random: Random,
): string[] {
  const block = [...required]
  const families = [resistedWords, counterWords]
  for (let pass = 0; pass < 4 && block.length < slots; pass++) {
    const available = [...keptLetters, ...block]
    const options = families[pass % 2].filter(word => !canSpell(word, available)).map(word => {
      const missing = [...word]
      for (const letter of available) {
        const index = missing.indexOf(letter)
        if (index >= 0) missing.splice(index, 1)
      }
      const projected = [...available, ...missing]
      const alternatives = families.flat().filter(other => canSpell(other, projected)).length
      return { missing, score: alternatives / Math.max(1, missing.length) + random.next() * 0.1 }
    }).filter(option => option.missing.length <= slots - block.length).sort((a, b) => b.score - a.score)
    if (options.length) block.push(...options[0].missing)
  }
  const support = overlappingLetters([...resistedWords.slice(0, 3), ...counterWords.slice(0, 3)])
  while (block.length < slots) block.push(random.pick(support.length ? support : [...'ETAOIN']))
  return block
}
