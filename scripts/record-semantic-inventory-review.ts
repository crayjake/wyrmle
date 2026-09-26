/** Record a completed editorial audit; this command does not perform that audit. */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createSemanticRefinementProvider, semanticRefinementDigest } from '../src/generator/semanticRefinement.ts'
import type { RefinementCache } from '../src/generator/semanticRefinement.ts'
import { semanticAssessmentProvider as base } from '../src/generator/semanticAssessments.ts'
import { semanticSourceReviewPolicy } from '../src/generator/semanticSourceReview.ts'
import type { SemanticInventoryReviews } from '../src/generator/semanticInventoryReview.ts'

const [cachePath, enemy, wordsPath, auditPath, registryPath = 'src/generator/data/semantic-inventory-reviews-v1.json'] = process.argv.slice(2)
if (!auditPath) throw new Error('Usage: node scripts/record-semantic-inventory-review.ts CACHE.json ENEMY WORDS.json COMPLETED_AUDIT.json [REGISTRY.json]')
const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as RefinementCache
const words = [...new Set(JSON.parse(readFileSync(wordsPath, 'utf8')) as string[])].sort()
assert.ok(words.length && words.every(word => /^[A-Z]+$/.test(word)))
const audit = JSON.parse(readFileSync(auditPath, 'utf8'))
const result = createSemanticRefinementProvider(cache).refine(enemy, Object.fromEntries(words.map(word => [word, base.word(enemy, word)])))
assert.ok(result.ready, result.issues.join('; '))
assert.ok(typeof audit.reviewMethod === 'string' && audit.reviewMethod.trim(), 'Document the completed source inspection first.')
assert.equal(audit.scopeWords, words.length)
assert.deepEqual(audit.metadata, result.metadata, 'The reviewed source inputs or final correction policy changed.')
assert.equal(audit.sourceReviewPolicyDigest, semanticRefinementDigest(semanticSourceReviewPolicy))
const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as SemanticInventoryReviews
assert.equal(registry.version, 'wyrmle-semantic-inventory-review-1')
const review = { enemy, sourceDigest: base.metadata(enemy).sourceDigest, baseCacheDigest: base.metadata(enemy).cacheDigest,
  modelPolicyDigest: result.metadata!.eligibilityPolicyDigest, sourceReviewPolicyDigest: audit.sourceReviewPolicyDigest,
  auditArtifact: auditPath, words: Object.fromEntries(Object.entries(result.words).map(([word, meaning]) => [word, semanticRefinementDigest(meaning)])) }
const scope = semanticRefinementDigest(words)
registry.reviews = registry.reviews.filter(previous => previous.enemy !== enemy || semanticRefinementDigest(Object.keys(previous.words).sort()) !== scope)
registry.reviews.push(review)
writeFileSync(registryPath, JSON.stringify(registry) + '\n')
console.log(JSON.stringify({ registry: registryPath, enemy, reviewedWords: words.length, audit: auditPath }))
