import { createHash } from 'node:crypto'
import type { PuzzleIdentity } from '../freshness.ts'

export type BatchChoice = { id: string; theme: string; enemy: string; enemyLemma: string;
  answer: string; bingoLemma: string; score: number; identity: PuzzleIdentity }

/** A batch has distinct enemy families, letter pools and every available bingo
 * family, not just different displayed answers or tile positions. */
export function conflictsWithBatch(candidate: BatchChoice, selected: readonly BatchChoice[]): boolean {
  return selected.some(old => old.identity.board === candidate.identity.board
    || old.enemy === candidate.enemy || old.enemyLemma === candidate.enemyLemma
    || old.identity.bingoFamilies.some(family => candidate.identity.bingoFamilies.includes(family)))
}

export function selectBatch<T extends BatchChoice>(pool: readonly T[], limit = 366): T[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 366) throw new Error('Choose 1–366 puzzles.')
  const chosen: T[] = [], remaining = [...pool]
  while (chosen.length < limit) {
    const eligible = remaining.filter(candidate => !conflictsWithBatch(candidate, chosen))
    const priority = (candidate: T) => Math.min(600, candidate.score) / 30
      - chosen.filter(old => old.theme === candidate.theme).length * 12
      - chosen.slice(-5).filter(old => old.theme === candidate.theme).length * 150
      - candidate.enemy.length / 10
    eligible.sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id))
    const next = eligible[0]
    if (!next) break
    chosen.push(next)
    remaining.splice(remaining.indexOf(next), 1)
  }
  return chosen
}

/** A recorded random seed makes the archive sample reproducible. Sampling moves
 * puzzles out of the future queue, so testers never receive the same board twice. */
export function sampleBatch<T extends { id: string }>(pool: readonly T[], count: number, seed: string): T[] {
  if (!Number.isSafeInteger(count) || count < 0 || count >= pool.length || !seed) throw new Error('Invalid sample size or seed.')
  const rank = (id: string) => createHash('sha256').update(`${seed}:${id}`).digest('hex')
  return [...pool].sort((a, b) => rank(a.id).localeCompare(rank(b.id))).slice(0, count)
}
