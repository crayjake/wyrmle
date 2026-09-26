/** Narrow, reproducible amendment to the completed inventory review. No model evidence is rewritten. */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { semanticAssessmentProvider } from '../src/generator/semanticAssessments.ts'
import { semanticRefinementProvider, semanticRefinementDigest } from '../src/generator/semanticRefinement.ts'
import { semanticSourceReviewPolicy } from '../src/generator/semanticSourceReview.ts'
import { withCompiledMeanings } from '../src/generator/meaningCompiler.ts'
import type { SemanticInventoryReviews } from '../src/generator/semanticInventoryReview.ts'

const path = 'src/generator/data/semantic-inventory-reviews-v1.json'
const registry = JSON.parse(readFileSync(path, 'utf8')) as SemanticInventoryReviews
const previous = registry.reviews.find(review => review.enemy === 'CHAOS')!
const words = Object.keys(previous.words).sort()
const final = semanticRefinementProvider.refine('CHAOS', Object.fromEntries(words.map(word => [word, semanticAssessmentProvider.word('CHAOS', word)])))
assert.ok(final.ready, final.issues.join('; '))
assert.equal(previous.modelPolicyDigest, final.metadata!.eligibilityPolicyDigest)
const changes = words.filter(word => previous.words[word] !== semanticRefinementDigest(final.words[word]))
assert.deepEqual(changes, ['HALCYONS'], 'This amendment cannot silently approve other changed meanings.')
assert.equal(final.words.HALCYON.relation, 'opposite')
assert.equal(final.words.HALCYONS.relation, 'opposite')
assert.equal(final.words.HALCYONS.senseId, 'oewn-halcyon__1.05.01..')
assert.equal(final.words.HALCYONS.assessment!.decisionBasis, 'source-reviewed')
const auditArtifact = 'artifacts/semantic-assessment/evaluation/halcyons-correction/inventory-review.json'
writeFileSync(auditArtifact, JSON.stringify({ reviewMethod: 'Source inspection of the reported HALCYONS miss; exact digest comparison of every other previously audited meaning.',
  scopeWords: words.length, unchangedWords: words.length - changes.length, changedWords: changes,
  previousAudit: previous.auditArtifact, previousSourceReviewPolicyDigest: previous.sourceReviewPolicyDigest,
  sourceReviewPolicyDigest: semanticRefinementDigest(semanticSourceReviewPolicy), metadata: final.metadata,
  reviewedMeaning: final.words.HALCYONS, source: 'https://ahdictionary.com/word/search.html?q=halcyon',
  limitation: 'Regression coverage and a source review cannot establish zero undiscovered semantic mistakes.' }, null, 2) + '\n')
previous.sourceReviewPolicyDigest = semanticRefinementDigest(semanticSourceReviewPolicy)
previous.auditArtifact = auditArtifact
previous.words = Object.fromEntries(words.map(word => [word, semanticRefinementDigest(final.words[word])]))
writeFileSync(path, JSON.stringify(registry) + '\n')
const selected = JSON.parse(gunzipSync(readFileSync('artifacts/meaning-v3/selected.json.gz')).toString())
const candidate = selected.candidate
candidate.id = candidate.encounter.id = 'daily-chaos-2026-09-26-v13'
candidate.encounter = withCompiledMeanings(candidate.encounter)
// The imported registry above is the pre-write snapshot; readiness is checked
// afresh by the subsequent review/packaging processes.
writeFileSync('/tmp/wyrmle-halcyons-candidate.json', JSON.stringify(candidate))
writeFileSync('/tmp/wyrmle-v12-opening-proof.json', JSON.stringify(selected.analysis.openingSafety))
console.log(JSON.stringify({ changedWords: changes, unchangedWords: words.length - changes.length, candidate: '/tmp/wyrmle-halcyons-candidate.json' }))
