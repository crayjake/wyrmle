import { createCandidate } from '../src/generator/generate.ts'
import type { GenerationOptions } from '../src/generator/generate.ts'
import { localLexicalProvider } from '../src/generator/lexicalProvider.ts'
import type { LexicalProvider } from '../src/generator/lexicalProvider.ts'
import { meaningLexicalProvider } from '../src/generator/meaningCompiler.ts'

// Structural tests need a fixed construction workload, while gameplay still
// receives the full enemy relations and complete possible-word meaning table.
// Restrict submitted-entry discovery as well as vocabulary(): counter lists
// otherwise expand the pool back beyond this explicit fixture.
const structuralVocabulary = Object.freeze(localLexicalProvider.vocabulary().flatMap(({ word }) => {
  const entry = meaningLexicalProvider.getEntry(word)
  return entry ? [entry] : []
}))
export const structuralWords = new Set(structuralVocabulary.map(entry => entry.word))
export const structuralProvider: LexicalProvider = Object.freeze({
  ...meaningLexicalProvider,
  id: `${meaningLexicalProvider.id}+structural-fixture-v1`,
  vocabulary: () => structuralVocabulary,
  getSubmittedWordEntry(word: string) {
    return structuralWords.has(word.trim().toUpperCase()) ? meaningLexicalProvider.getEntry(word) : undefined
  },
})
export const createStructuralCandidate = (enemy: string, seed: string) => createCandidate(enemy, seed, { provider: structuralProvider })

export const quickOptions: GenerationOptions = {
  provider: structuralProvider,
  candidateCount: 2,
  refinementRounds: 0,
  analysis: {
    solver: {
      maxStates: 3, beamWidth: 2, maxMovesPerState: 12, maxSelectionsPerState: 200,
      vocabulary: localLexicalProvider.vocabulary().map(entry => entry.word),
    },
    includeCounterfactuals: false,
    maxReasonableStates: 0,
    maxFinalStates: 0,
  },
}
