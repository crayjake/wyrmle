/** Produce an editorial queue from actual final meanings; cues never assign labels. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSemanticRefinementProvider, semanticRefinementDigest } from '../src/generator/semanticRefinement.ts'
import type { RefinementCache } from '../src/generator/semanticRefinement.ts'
import { semanticAssessmentProvider } from '../src/generator/semanticAssessments.ts'
import { semanticSourceReviewPolicy } from '../src/generator/semanticSourceReview.ts'

const [cachePath, enemy, inventoryPath, directory] = process.argv.slice(2)
if (!directory) throw new Error('Usage: node scripts/audit-semantic-inventory.ts CACHE.json ENEMY INVENTORY.json DIRECTORY')
const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as RefinementCache
const words = JSON.parse(readFileSync(inventoryPath, 'utf8')) as string[]
const baseline = Object.fromEntries(words.map(word => [word, semanticAssessmentProvider.word(enemy, word)]))
const final = createSemanticRefinementProvider(cache).refine(enemy, baseline)
if (!final.ready) throw new Error(`Incomplete review: ${final.issues.slice(0, 20).join('; ')}`)
const indices = new Map(cache.words.map((word, index) => [word, index]))
const scoring = new Map<string, string[]>(), flags = new Map<string, string[]>(), counts: Record<string, number> = {}
// Broad triage deliberately includes incidental mentions, negations and physical uses.
const cues: Record<string, RegExp> = {
  CHAOS: /order|organis|organiz|neaten|tidy|calm|compos|peace|seren|harmon|systematic|logical|clarity|quiet|disarray|confus|chaos|lawless|turmoil|commotion|tranquil|compatib|coheren|regular|arrang|disturb|agitat|control|plan|restrain|settle|balance|conform|method|disciplin|riot|disrupt|rebel|anarch/i,
}
// Without enemy-specific triage, queue all neutral senses for inspection.
const cue = cues[enemy]
for (const word of words) {
  const meaning = final.words[word]
  counts[meaning.relation] = (counts[meaning.relation] ?? 0) + 1
  if (meaning.relation === 'opposite' || meaning.relation === 'similar') {
    const key = `${meaning.relation}:${meaning.senseId}`
    scoring.set(key, [...(scoring.get(key) ?? []), word])
  } else {
    for (const index of cache.enemies[enemy].retrieval[indices.get(word)!][3]) {
      const sense = cache.senses[index]
      if (!cue || cue.test(`${sense.lemma} ${sense.definition}`) || baseline[word].relation === 'opposite' || baseline[word].relation === 'similar') {
        flags.set(sense.id, [...(flags.get(sense.id) ?? []), word])
      }
    }
  }
}
const sources = new Map(cache.senses.map(sense => [sense.id, sense]))
const scoringSources = [...scoring].map(([key, spellings]) => {
  const [relation, ...id] = key.split(':')
  return { relation, words: spellings.sort(), source: sources.get(id.join(':'))! }
}).sort((a, b) => a.source.id.localeCompare(b.source.id))
const neutralFlags = [...flags].map(([id, spellings]) => ({ words: spellings.sort(), source: sources.get(id)! }))
  .sort((a, b) => a.source.id.localeCompare(b.source.id))
mkdirSync(directory, { recursive: true })
writeFileSync(join(directory, 'audit.json'), JSON.stringify({ enemy, words: words.length, counts,
  inventoryDigest: semanticRefinementDigest(words), metadata: final.metadata,
  sourceReviewPolicyDigest: semanticRefinementDigest(semanticSourceReviewPolicy), scoringSources, neutralFlags,
  note: 'Flags prioritize editorial inspection. They never determine a label. Model and editorial evidence remain separate.' }, null, 2) + '\n')
for (const [name, rows] of [['scoring', scoringSources], ['neutral', neutralFlags]] as const) {
  writeFileSync(join(directory, `${name}.txt`), rows.map(row => `${'relation' in row ? row.relation : 'neutral'} | ${row.words.join(', ')} | ${row.source.id} | ${row.source.definition}`).join('\n') + '\n')
}
writeFileSync(join(directory, 'meanings.json'), JSON.stringify(final.words) + '\n')
console.log(JSON.stringify({ words: words.length, counts, scoringSources: scoringSources.length, neutralFlags: neutralFlags.length }))
