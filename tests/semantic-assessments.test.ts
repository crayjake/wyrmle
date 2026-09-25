import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import cacheData from '../src/generator/data/semantic-assessments-v1.json' with { type: 'json' }
import { createSemanticAssessmentProvider, semanticAssessmentProvider } from '../src/generator/semanticAssessments.ts'
import type { AssessmentCache } from '../src/generator/semanticAssessments.ts'
import { getDefinedDictionaryWords } from '../src/lexicon/meaningDictionary.ts'
import { getWordMeanings, getMeaningSense, getMeaningSynset } from '../scripts/lib/wordMeanings.ts'
import { getFunctionWord } from '../src/lexicon/functionWords.ts'
import profiles from '../src/lexicon/data/semantic-profiles-v1.json' with { type: 'json' }
import { exportSemanticSource } from '../scripts/export-semantic-source.ts'

test('all six enemies assess the entire accepted dictionary, including every applicable source sense', () => {
  assert.equal(semanticAssessmentProvider.enemyWords().length, 6)
  for (const enemy of semanticAssessmentProvider.enemyWords()) {
    assert.equal(semanticAssessmentProvider.metadata(enemy).assessedWords, getDefinedDictionaryWords().length)
    for (const word of getDefinedDictionaryWords()) {
      const meaning = semanticAssessmentProvider.word(enemy, word)
      const senses = meaning.source === 'oewn-2025' ? getWordMeanings(word).senses : getFunctionWord(word)!.senses
      const chosen = senses.find(sense => sense.id === meaning.senseId)
      assert.ok(chosen, `${enemy}/${word}: selected sense belongs to source word`)
      assert.equal(chosen.definition, meaning.definition, `${enemy}/${word}: exact source definition`)
      assert.equal(meaning.assessment!.sensesEvaluated, senses.length, `${enemy}/${word}: all senses considered`)
      assert.equal(meaning.evidence, 'model-assessed')
      assert.ok(Object.isFrozen(meaning.assessment))
    }
  }
})

test('missing dictionary rows, missing enemies and corrupted scores fail closed', () => {
  const cache = cacheData as unknown as AssessmentCache
  assert.throws(() => createSemanticAssessmentProvider({ ...cache, words: cache.words.slice(1) }), /cover.*dictionary/)
  assert.throws(() => createSemanticAssessmentProvider({ ...cache, enemies: { CHAOS: {
    ...cache.enemies.CHAOS, rows: cache.enemies.CHAOS.rows.slice(1),
  } } }), /Incomplete semantic assessment/)
  assert.throws(() => semanticAssessmentProvider.word('CAT', 'CALM'), /No offline semantic assessment/)
  assert.throws(() => semanticAssessmentProvider.word('CHAOS', 'AWFY'), /No semantic assessment/)
  const rows = [...cache.enemies.CHAOS.rows]
  rows[0] = [...rows[0]]
  rows[0][2] = NaN
  const provider = createSemanticAssessmentProvider({ ...cache, enemies: { CHAOS: { ...cache.enemies.CHAOS, rows } } })
  assert.throws(() => provider.word('CHAOS', cache.words[0]), /Invalid semantic assessment/)
})

test('a complete fresh source export matches the inputs pinned by every enemy assessment', () => {
  const source = exportSemanticSource()
  for (const enemy of semanticAssessmentProvider.enemyWords()) {
    assert.equal(semanticAssessmentProvider.metadata(enemy).sourceDigest, source.sourceDigest,
      `${enemy}: dictionary/profile/source graph changed; rerun offline assessment`)
  }
})

test('construction relation lists come from the same assessed data compiled into play', () => {
  for (const enemy of semanticAssessmentProvider.enemyWords()) {
    for (const [relation, words] of Object.entries(semanticAssessmentProvider.relations(enemy))) {
      for (const word of words) assert.equal(semanticAssessmentProvider.word(enemy, word).relation, relation)
    }
  }
})

test('the compact cache preserves every recorded offline model decision and its output checksum', () => {
  for (const enemy of semanticAssessmentProvider.enemyWords()) {
    const bytes = readFileSync(new URL(`../artifacts/semantic-assessment/cache/${enemy.toLowerCase()}.json.gz`, import.meta.url))
    const raw = JSON.parse(gunzipSync(bytes).toString('utf8'))
    const header = semanticAssessmentProvider.metadata(enemy)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), header.cacheDigest)
    assert.equal(raw.metadata.sourceDigest, header.sourceDigest)
    assert.equal(raw.metadata.configurationHash, header.policyDigest)
    assert.deepEqual(Object.keys(raw.words).sort(), [...getDefinedDictionaryWords()])
    const profile = profiles[enemy as keyof typeof profiles]
    const excludedSynsets = new Set(Object.keys(profile.reviewedExclusions).map(id => getMeaningSense(id)!.synset))
    const excludedSenses = new Set(Object.keys(profile.reviewedSenseExclusions))
    for (const [word, evidence] of Object.entries(raw.words) as [string, {
      senseId: string; relation: string; counterScore: number; resistedScore: number; margin: number; sensesEvaluated: number; method: string;
      proof?: { relation: string; anchor: string; path: { type: string; qualifier?: string; from: string; to: string }[] };
    }][]) {
      const meaning = semanticAssessmentProvider.word(enemy, word)
      assert.equal(meaning.senseId, evidence.senseId)
      assert.equal(meaning.relation, evidence.relation === 'neutral' ? 'unrelated' : evidence.relation)
      for (const key of ['counterScore', 'resistedScore', 'margin'] as const) {
        assert.equal(meaning.assessment![key], Math.round(evidence[key] * 10000) / 10000)
      }
      assert.equal(meaning.assessment!.sensesEvaluated, evidence.sensesEvaluated)
      assert.equal(meaning.assessment!.decisionBasis, evidence.method)
      if (evidence.method === 'source-direction-proof') {
        assert.ok(evidence.proof, `${enemy}/${word}: missing source path`)
        const proof = evidence.proof
        assert.ok(proof.path.length <= 2)
        assert.equal(proof.relation, meaning.relation)
        assert.ok(!excludedSenses.has(meaning.senseId))
        assert.ok([...profile.roots, ...Object.values(profile.relations)].some(anchor =>
          anchor.senseId === proof.anchor && anchor.relation === meaning.relation))
        let synset = getMeaningSense(meaning.senseId)!.synset
        assert.ok(!excludedSynsets.has(synset))
        for (const [index, edge] of proof.path.entries()) {
          if (edge.type === 'other') {
            assert.equal(index, 0, 'A role edge may only introduce the nominal state/event before the concept path.')
            assert.equal(edge.from, meaning.senseId)
            assert.ok(['state', 'event'].includes(edge.qualifier!))
            const from = getMeaningSense(edge.from)!
            const to = getMeaningSense(edge.to)!
            assert.equal(from.partOfSpeech, 'verb')
            assert.equal(to.partOfSpeech, 'noun')
            assert.ok(!excludedSenses.has(to.id))
            assert.ok(from.relations.some(source => source.type === 'other' && source.qualifier === edge.qualifier && source.target === edge.to))
            synset = to.synset
          } else {
            assert.ok(['hypernym', 'entails', 'causes'].includes(edge.type))
            assert.equal(edge.from, synset)
            assert.ok(getMeaningSynset(synset)!.relations.some(source => source.type === edge.type && source.target === edge.to))
            synset = edge.to
          }
          assert.ok(!excludedSynsets.has(synset))
        }
        assert.equal(synset, getMeaningSense(proof.anchor)!.synset)
      }
    }
  }
})
