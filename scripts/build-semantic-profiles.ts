/** Offline, deterministic expansion of reviewed game concepts, never runtime AI. */
import { writeFileSync } from 'node:fs'
import {
  getCoveredMeaningWords, getMeaningSense, getMeaningSynset, getWordMeanings,
  WORD_MEANINGS_VERSION, type MeaningSense,
} from './lib/wordMeanings.ts'
import { excludedProfileConcepts, excludedProfileSenses, semanticProfileRoots, type ConceptRoot, type ProfileRelation } from './lib/semanticProfileRoots.ts'

const VERSION = 'semantic-profiles-v1'
type EvidenceStep = { type: 'same-synset' | 'derivation' | 'similar' | 'antonym' | 'inverse-pertainym'; from: string; to: string }
type Classification = {
  relation: ProfileRelation
  senseId: string
  lemma: string
  definition: string
  reason: string
  confidence: 'reviewed-profile' | 'lexical-expansion'
  rootSense: string
  evidence: EvidenceStep[]
}
type Candidate = { sense: MeaningSense; root: ConceptRoot; evidence: EvidenceStep[] }
const bySense = new Map<string, string[]>()
const adverbsByAdjective = new Map<string, Set<string>>()
const excludedSynsets = new Set(Object.keys(excludedProfileConcepts).map(id => {
  const sense = getMeaningSense(id)
  if (!sense) throw new Error(`Missing reviewed exclusion ${id}`)
  return sense.synset
}))
for (const word of getCoveredMeaningWords()) {
  for (const sense of getWordMeanings(word).senses) {
    const forms = bySense.get(sense.id) ?? []
    forms.push(word)
    bySense.set(sense.id, forms)
    if (sense.partOfSpeech === 'adverb') {
      for (const edge of sense.relations) if (edge.type === 'pertainym') {
        const adverbs = adverbsByAdjective.get(edge.target) ?? new Set<string>()
        adverbs.add(sense.id)
        adverbsByAdjective.set(edge.target, adverbs)
      }
    }
  }
}

function expand(root: ConceptRoot): Candidate[] {
  const start = getMeaningSense(root.senseId)
  if (!start) throw new Error(`Unknown reviewed root ${root.senseId}`)
  type Pending = Candidate & { derivations: number; similarities: number; antonyms: number }
  const queue: Pending[] = [{ sense: start, root, evidence: [], derivations: 0, similarities: 0, antonyms: 0 }]
  const visited = new Set<string>()
  const output: Candidate[] = []
  while (queue.length) {
    const item = queue.shift()!
    if (excludedSynsets.has(item.sense.synset) || excludedProfileSenses[item.sense.id]) continue
    const key = `${item.sense.id}:${item.derivations}:${item.similarities}:${item.antonyms}`
    if (visited.has(key)) continue
    visited.add(key)
    output.push(item)
    const synset = getMeaningSynset(item.sense.synset)!
    const enqueue = (target: string, type: EvidenceStep['type'], changes: Partial<Pending> = {}) => {
      const sense = getMeaningSense(target)
      if (!sense) throw new Error(`Unresolvable source sense ${target}`)
      queue.push({ ...item, sense, evidence: [...item.evidence, { type, from: item.sense.id, to: target }], ...changes })
    }
    // Adverbs inherit only an explicitly linked adjective sense. No -ly
    // spelling heuristic and no import of the adjective's unrelated readings.
    if (item.sense.partOfSpeech === 'adverb') continue
    for (const id of adverbsByAdjective.get(item.sense.id) ?? []) enqueue(id, 'inverse-pertainym')
    // Synonyms remain within a pinned sense; other senses of the same spelling
    // are never pulled in merely because they share letters.
    for (const id of synset.senses) if (id !== item.sense.id) enqueue(id, 'same-synset')
    if (root.derivations !== false && start.partOfSpeech !== 'verb' && item.derivations === 0 && item.similarities === 0 && item.antonyms === 0) {
      for (const edge of item.sense.relations) if (edge.type === 'derivation') {
        enqueue(edge.target, 'derivation', { derivations: 1 })
      }
    }
    // A satellite points back to a more general adjective head. Following that
    // direction loses its qualifying sense (e.g. gentle -> light). Expand from
    // heads to their satellites only, preserving the reviewed concept boundary.
    if (item.sense.synset.endsWith('-a') && item.similarities === 0 && item.antonyms === 0) {
      for (const edge of synset.relations) if (edge.type === 'similar') {
        for (const id of getMeaningSynset(edge.target)!.senses) enqueue(id, 'similar', { similarities: 1 })
      }
    }
    // Only explicitly approved enemy-core antonyms can cross polarity. Never
    // flip all counter-concept antonyms into enemy synonyms (sad != angry).
    if (root.antonyms && item.derivations === 0 && item.similarities === 0 && item.antonyms === 0) {
      for (const edge of item.sense.relations) if (edge.type === 'antonym') {
        enqueue(edge.target, 'antonym', { antonyms: 1, root: { ...root, relation: root.antonyms } })
      }
    }
  }
  return output
}

const priority = { opposite: 3, similar: 2, related: 1 }
const profiles: Record<string, {
  version: string; dictionaryVersion: string; definition: string
  policy: string; roots: (ConceptRoot & { definition: string })[]
  reviewedExclusions: typeof excludedProfileConcepts
  reviewedSenseExclusions: typeof excludedProfileSenses
  relations: Record<string, Classification>
}> = {}
for (const [enemy, configuration] of Object.entries(semanticProfileRoots)) {
  const chosen = new Map<string, Candidate>()
  for (const root of configuration.roots) {
    for (const candidate of expand(root)) {
      for (const word of bySense.get(candidate.sense.id) ?? []) {
        const previous = chosen.get(word)
        if (!previous || priority[candidate.root.relation] > priority[previous.root.relation]
          || (candidate.root.relation === previous.root.relation && candidate.evidence.length < previous.evidence.length)) {
          chosen.set(word, candidate)
        }
      }
    }
  }
  const relations: Record<string, Classification> = {}
  for (const [word, item] of [...chosen.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const viaAntonym = item.evidence.some(edge => edge.type === 'antonym')
    relations[word] = {
      relation: item.root.relation, senseId: item.sense.id, lemma: item.sense.lemma, definition: item.sense.definition,
      reason: viaAntonym ? `Counters ${enemy.toLowerCase()} through an explicit opposite of ${item.root.concept}.`
        : `${item.root.relation === 'opposite' ? 'Counters' : item.root.relation === 'similar' ? 'Echoes' : 'Relates to'} ${enemy.toLowerCase()} through ${item.root.concept}.`,
      confidence: item.evidence.length === 0 ? 'reviewed-profile' : 'lexical-expansion',
      rootSense: item.root.senseId, evidence: item.evidence,
    }
  }
  profiles[enemy] = {
    version: VERSION, dictionaryVersion: WORD_MEANINGS_VERSION,
    definition: getMeaningSense(configuration.enemySense)!.definition,
    policy: 'Reviewed game counter-concepts plus pinned enemy/related concepts. Source expansion: same synset, at most one derivation before at most one adjective-head-to-satellite similarity edge; no derivation from verb roots; explicitly approved core antonyms and exact adjective-to-adverb pertainym links only. Reviewed overbroad synsets excluded. No general hypernym, sentiment, substring, or runtime inference. Missing profile relation means no meaning bonus under this reviewed policy, not proof of universal semantic unrelatedness.',
    reviewedExclusions: excludedProfileConcepts,
    reviewedSenseExclusions: excludedProfileSenses,
    roots: configuration.roots.map(root => ({ ...root, definition: getMeaningSense(root.senseId)!.definition })),
    relations,
  }
  console.log(JSON.stringify({ enemy, counts: Object.fromEntries(['opposite', 'similar', 'related'].map(relation =>
    [relation, Object.values(relations).filter(record => record.relation === relation).length])) }))
}
writeFileSync(new URL('../src/lexicon/data/semantic-profiles-v1.json', import.meta.url), `${JSON.stringify(profiles)}\n`)
