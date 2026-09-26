import { generateForEnemy, generatePuzzle } from './generate.ts'
import type { GenerationOptions } from './generate.ts'
import { validateGeneratorRequest } from './workerMessages.ts'
import type { GeneratorRequest, GeneratorResponse } from './workerMessages.ts'

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<GeneratorRequest>) => void) | null
  postMessage: (message: GeneratorResponse) => void
}

workerScope.onmessage = ({ data }) => {
  try {
    const request = validateGeneratorRequest(data)
    const options: GenerationOptions = {
      candidateCount: request.candidateCount,
      keep: 20,
      includeRegenTile: request.includeRegenTile,
      regenTileCount: request.regenTileCount,
      refillLimit: request.refillLimit,
      onProgress: progress => workerScope.postMessage({ id: request.id, type: 'progress', progress }),
    }
    const result = request.enemy
      ? generateForEnemy(request.enemy, request.seed, options)
      : generatePuzzle(request.seed, options)
    workerScope.postMessage({ id: request.id, type: 'complete', result })
  } catch (error) {
    workerScope.postMessage({ id: data?.id ?? 0, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
