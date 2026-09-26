/** Publication requires an audited frozen meaning for every playable spelling. */
import data from './data/semantic-inventory-reviews-v1.json' with { type: 'json' }
import type { PuzzleMeaningLexicon } from '../game/meaningLexicon.ts'
import { semanticRefinementDigest } from './semanticRefinement.ts'
import { semanticSourceReviewPolicy } from './semanticSourceReview.ts'

export type SemanticInventoryReviews = {
  version: string
  reviews: { enemy: string; sourceDigest: string; baseCacheDigest: string; modelPolicyDigest: string
    sourceReviewPolicyDigest: string; auditArtifact: string; words: Record<string, string> }[]
}
const currentSourceReviewPolicyDigest = semanticRefinementDigest(semanticSourceReviewPolicy)

export function isSemanticInventoryReviewed(lexicon: PuzzleMeaningLexicon,
  registry: SemanticInventoryReviews = data,
  sourceReviewPolicyDigest = currentSourceReviewPolicyDigest): boolean {
  const header = lexicon.assessment, refinement = header?.refinement
  if (registry.version !== 'wyrmle-semantic-inventory-review-1' || !header || !refinement
    || !Object.keys(lexicon.words).length) return false
  const reviews = registry.reviews.filter(review => review.enemy === lexicon.enemyWord
    && review.sourceDigest === header.sourceDigest && review.baseCacheDigest === header.cacheDigest
    && review.modelPolicyDigest === refinement.eligibilityPolicyDigest
    && review.sourceReviewPolicyDigest === sourceReviewPolicyDigest && !!review.auditArtifact.trim())
  return reviews.length > 0 && Object.entries(lexicon.words).every(([word, meaning]) => {
    const digest = semanticRefinementDigest(meaning)
    return reviews.some(review => review.words[word] === digest)
  })
}
