import type { GenerationResult } from './generate.ts'

export type GeneratorRequest = { id: number; enemy: string | null; seed: string; candidateCount: number }
export type GeneratorProgress = { attempted: number; accepted: number; enemyWord: string }
export type GeneratorResponse =
  | { id: number; type: 'progress'; progress: GeneratorProgress }
  | { id: number; type: 'complete'; result: GenerationResult }
  | { id: number; type: 'error'; message: string }

export function validateGeneratorRequest(value: unknown): GeneratorRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid generator request.')
  const input = value as Partial<GeneratorRequest>
  if (!Number.isSafeInteger(input.id) || input.id! < 1) throw new Error('Request ID must be a positive integer.')
  if (typeof input.seed !== 'string' || !input.seed.trim() || input.seed.length > 128) {
    throw new Error('Seed must contain 1–128 characters.')
  }
  if (input.enemy !== null && (typeof input.enemy !== 'string' || !/^[A-Za-z]{1,24}$/.test(input.enemy.trim()))) {
    throw new Error('Enter an enemy containing only letters, or select automatic enemy choice.')
  }
  if (!Number.isSafeInteger(input.candidateCount) || input.candidateCount! < 1 || input.candidateCount! > 100) {
    throw new Error('Choose between 1 and 100 initial candidates.')
  }
  return { id: input.id!, seed: input.seed, enemy: input.enemy?.trim().toUpperCase() ?? null, candidateCount: input.candidateCount! }
}
