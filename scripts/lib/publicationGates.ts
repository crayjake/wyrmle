import type { ValidationConfig } from '../../src/generator/config.ts'

/** Shared by review and packaging; draft acceptance cannot bypass release gates. */
export const assessedPublicationGates = {
  requireOpeningSafety: true, openingSafetyScope: 'all-valid-openings',
  allowRestrictedOpeningSafety: false, requireFairnessCoverage: true, requireMeaningRefinement: true,
  minimumCounterOpeningLemmas: 6, minimumMultiHitCounterOpenings: 4,
  minimumMeaningBoostedOpenings: 4,
  minimumWinningCounterLemmas: 3, minimumFamiliarWinningOpenings: 6,
} as const satisfies Partial<ValidationConfig>
