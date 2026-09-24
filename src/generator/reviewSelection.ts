import type { RankedCandidate } from './generate.ts'

/** Keep the best variant of each construction family for a varied playtest set. */
export function selectReviewCandidates(ranked: readonly RankedCandidate[], keep = 5): RankedCandidate[] {
  if (keep <= 0) return []
  const families = new Set<string>()
  const selected: RankedCandidate[] = []
  for (const item of [...ranked].sort((a, b) => b.quality.total - a.quality.total || a.candidate.id.localeCompare(b.candidate.id))) {
    if (!item.validation.accepted) continue
    const family = item.candidate.provenance.rootId ?? item.candidate.provenance.parentId ?? item.candidate.id
    if (families.has(family)) continue
    families.add(family)
    selected.push(item)
    if (selected.length >= keep) break
  }
  return selected
}
