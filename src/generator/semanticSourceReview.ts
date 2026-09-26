/** Explicit editorial corrections; never overwrite or fabricate model responses. */
import data from './data/semantic-source-reviews-v1.json' with { type: 'json' }
import type { RefinementManifest, RefinementMemo, RefinementSense } from './semanticRefinement.ts'

export type SourceReviewPolicy = {
  version: string; sourceDigest: string; modelPolicyDigest: string
  categoryRelations: Record<string, Record<string, string>>; categoryNames: Record<string, string>
  relationPriority: string[]; lexnames: string[]; sourceDomainPriority: Record<string, number>
  reviews: { senseId: string; lemma: string; definition: string; partOfSpeech: string; categories: string[]; rationale: string }[]
}
export const semanticSourceReviewPolicy = data as SourceReviewPolicy

/** Recompute a word from all reviewed senses after applying source-level edits.
 * A correction cannot fill a missing model review or bless a different policy.
 */
export function applySemanticSourceReview(policy: SourceReviewPolicy, manifest: RefinementManifest, enemy: string,
  inputSenses: readonly RefinementSense[], memo: RefinementMemo, preferredSenseId?: string) {
  if (memo.status !== 'ok' || policy.sourceDigest !== manifest.sourceDigest || policy.modelPolicyDigest !== manifest.policyDigest) return undefined
  const edits = new Map(policy.reviews.map(review => [review.senseId, review]))
  const senses = [...inputSenses].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const applicable = senses.flatMap(sense => edits.has(sense.id) ? [edits.get(sense.id)!] : [])
  if (!applicable.length) return undefined
  const fail = (message: string): never => { throw new Error(`Invalid semantic source review: ${message}.`) }
  if (edits.size !== policy.reviews.length) fail('duplicate source edits')
  const rows = JSON.parse(memo.rawResponse).senses
  if (!Array.isArray(rows) || rows.length !== senses.length) fail('missing model decisions')
  const candidates: { relation: 'opposite' | 'similar'; index: number; category: string }[] = []
  for (const [index, sense] of senses.entries()) {
    const row = rows[index], edit = edits.get(sense.id)
    if (row.index !== index || row.definition !== sense.definition || !Array.isArray(row.categories)
      || JSON.stringify(JSON.parse(row.response)) !== JSON.stringify({ categories: row.categories })) fail('changed underlying model evidence')
    if (edit && (edit.definition !== sense.definition || edit.lemma !== sense.lemma || edit.partOfSpeech !== sense.partOfSpeech
      || !edit.rationale.trim() || !edit.categories.length || edit.categories.length > 4
      || (edit.categories.includes('OTHER') && edit.categories.length !== 1)
      || new Set(edit.categories).size !== edit.categories.length)) fail('stale or incomplete source correction')
    for (const category of edit?.categories ?? row.categories) {
      if (typeof category !== 'string' || !Object.hasOwn(policy.categoryNames, category)) fail('unknown semantic category')
      const relation = policy.categoryRelations[enemy]?.[category] ?? 'neutral'
      if (relation === 'opposite' || relation === 'similar') candidates.push({ relation, index, category })
      else if (relation !== 'neutral') fail('unknown relation')
    }
  }
  const preferred = (index: number) => Number(senses[index].id !== preferredSenseId)
  const directness = (index: number) => {
    const parts = senses[index].id.split('__').at(-1)!.split('.')
    const domain = parts.length > 3 && /^\d+$/.test(parts[1]) ? policy.lexnames[Number(parts[1])] : 'function word'
    return policy.sourceDomainPriority[domain] ?? 5
  }
  candidates.sort((a, b) => policy.relationPriority.indexOf(a.relation) - policy.relationPriority.indexOf(b.relation)
    || preferred(a.index) - preferred(b.index) || directness(a.index) - directness(b.index)
    || a.index - b.index || a.category.localeCompare(b.category))
  const selected = candidates[0]
  const sense = senses[selected?.index ?? Math.max(0, senses.findIndex(sense => sense.id === preferredSenseId))]
  return { relation: selected?.relation ?? 'neutral' as const, sense, reviews: applicable,
    explanation: selected ? `This sense expresses ${policy.categoryNames[selected.category]}, which ${selected.relation === 'opposite' ? 'counters' : 'reinforces'} ${enemy}.`
      : `None of the reviewed dictionary senses directly counters or reinforces ${enemy}.` }
}
