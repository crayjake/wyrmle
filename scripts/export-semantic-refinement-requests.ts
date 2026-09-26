/** Export exact, source-grounded LLM inputs for a puzzle's enumerated spelling inventory. */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createSemanticRefinementProvider, semanticBaseWordDigest, semanticRefinementDigest, semanticRefinementInput } from '../src/generator/semanticRefinement.ts'
import type { RefinementCache } from '../src/generator/semanticRefinement.ts'
import { semanticAssessmentProvider } from '../src/generator/semanticAssessments.ts'

const [cachePath, enemy, wordsPath, output] = process.argv.slice(2)
if (!cachePath || !enemy || !wordsPath || !output) throw new Error('Usage: node scripts/export-semantic-refinement-requests.ts CACHE.json ENEMY WORDS.json OUTPUT.json')
const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as RefinementCache
createSemanticRefinementProvider(cache) // Validate complete retrieval, source/model pins and indices.
const table = cache.enemies[enemy]
assert.ok(table, `No retrieval manifest for ${enemy}`)
assert.equal(table.manifest.baseCacheDigest, semanticAssessmentProvider.metadata(enemy).cacheDigest)
assert.equal(table.manifest.sourceDigest, semanticAssessmentProvider.metadata(enemy).sourceDigest)
const inputWords = JSON.parse(readFileSync(wordsPath, 'utf8')) as unknown
assert.ok(Array.isArray(inputWords) && inputWords.every(word => typeof word === 'string' && /^[A-Z]+$/.test(word)))
const words = [...new Set(inputWords as string[])].sort()
const indices = new Map(cache.words.map((word, index) => [word, index]))
const requests = []
for (const word of words) {
  const index = indices.get(word)
  assert.notEqual(index, undefined, `Undefined spelling ${word}`)
  const meaning = semanticAssessmentProvider.word(enemy, word)
  const basis = meaning.assessment!.decisionBasis!
  if (table.manifest.trustedDecisionBases.includes(basis)) continue
  assert.ok(['lexical-expansion', 'reviewed-profile', 'source-direction-proof', 'local-vector-nli', 'local-vector-nli-neutral'].includes(basis))
  const qualified = table.retrieval[index!][3]
  if (table.manifest.reviewScope !== 'all-source-senses' && basis === 'local-vector-nli-neutral' && !qualified.length) continue
  assert.ok(qualified.length, `${word}: a novel scoring decision has no source sense available for review`)
  const input = semanticRefinementInput(table.manifest, enemy, semanticAssessmentProvider.definition(enemy), qualified.map(index => cache.senses[index]), meaning.senseId)
  requests.push({ word, baseWordDigest: semanticBaseWordDigest(meaning), baselineSenseId: meaning.senseId,
    inputDigest: semanticRefinementDigest(input), input })
}
writeFileSync(output, JSON.stringify({ version: 'wyrmle-refinement-requests-1', enemyWord: enemy, manifest: table.manifest,
  scopeWords: words, scopeDigest: semanticRefinementDigest(words), requests }) + '\n')
console.log(JSON.stringify({ output, inventory: words.length, eligible: requests.length,
  distinctInputs: new Set(requests.map(request => request.inputDigest)).size }))
