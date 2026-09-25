/** Export every accepted spelling and all of its licensed senses for offline inference. */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getWordMeanings, getMeaningSense, getMeaningSynset } from './lib/wordMeanings.ts'
import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'
import { getFunctionWord } from '../src/lexicon/functionWords.ts'
import profiles from '../src/lexicon/data/semantic-profiles-v1.json' with { type: 'json' }

export function exportSemanticSource() {
  const words: Record<string, string[]> = {}
  const defaults: Record<string, string> = {}
  const senses: Record<string, { id: string; lemma: string; definition: string; partOfSpeech: string; source: string }> = {}
  for (const word of getDefinedDictionaryWords()) {
    const source = getDictionaryMeaning(word)!
    const applicable = source.source === 'oewn-2025'
      ? getWordMeanings(word).senses.map(sense => ({ id: sense.id, lemma: sense.lemma,
        definition: sense.definition, partOfSpeech: sense.partOfSpeech, source: source.source }))
      : getFunctionWord(word)!.senses.map(sense => ({ id: sense.id, lemma: source.lemma,
        definition: sense.definition, partOfSpeech: sense.partOfSpeech, source: source.source }))
    if (!applicable.length || !applicable.some(sense => sense.id === source.senseId)) {
      throw new Error(`Incomplete source senses for ${word}`)
    }
    defaults[word] = source.senseId
    words[word] = applicable.map(sense => sense.id)
    for (const sense of applicable) {
      if (senses[sense.id] && JSON.stringify(senses[sense.id]) !== JSON.stringify(sense)) {
        throw new Error(`Inconsistent source sense ${sense.id}`)
      }
      senses[sense.id] = sense
    }
  }
  const assessedProfiles = Object.fromEntries(Object.entries(profiles).map(([enemy, profile]) => {
    const excluded = new Set(Object.keys(profile.reviewedSenseExclusions))
    for (const id of Object.keys(profile.reviewedExclusions)) {
      const sense = getMeaningSense(id)
      if (!sense) throw new Error(`Missing excluded source sense ${id}`)
      for (const member of getMeaningSynset(sense.synset)!.senses) excluded.add(member)
    }
    return [enemy, { ...profile, excludedSenseIds: [...excluded].sort() }]
  }))
  // Direction matters: a specific sense may entail an ancestor concept, while
  // sharing a broad ancestor is not evidence that two words mean the same thing.
  const senseSynsets: Record<string, string> = {}
  const senseRoles: Record<string, { type: string; qualifier: string; target: string }[]> = {}
  const synsets: Record<string, { definition: string; relations: { type: string; target: string }[] }> = {}
  const depths = new Map<string, number>()
  function addSynset(id: string, remaining: number) {
    if ((depths.get(id) ?? -1) >= remaining) return
    depths.set(id, remaining)
    const synset = getMeaningSynset(id)
    if (!synset) throw new Error(`Unresolved source synset ${id}`)
    const relations = synset.relations.filter(edge => ['hypernym', 'entails', 'causes'].includes(edge.type))
      .map(({ type, target }) => ({ type, target }))
    synsets[id] = { definition: synset.definition, relations }
    if (remaining > 0) for (const edge of relations) addSynset(edge.target, remaining - 1)
  }
  const graphSenses = new Set([...Object.keys(senses), ...Object.values(profiles).flatMap(profile => [
    ...profile.roots.map(root => root.senseId), ...Object.values(profile.relations).map(relation => relation.senseId),
    ...Object.keys(profile.reviewedExclusions),
  ])])
  for (const id of [...graphSenses].sort()) {
    const sense = getMeaningSense(id)
    if (!sense) continue // Wiktionary supplements have no fabricated WordNet edges.
    senseSynsets[id] = sense.synset
    addSynset(sense.synset, 2)
    const roles = sense.relations.filter(edge => sense.partOfSpeech === 'verb' && edge.type === 'other'
      && ['state', 'event'].includes(edge.qualifier ?? '') && getMeaningSense(edge.target)?.partOfSpeech === 'noun')
      .map(edge => ({ type: edge.type, qualifier: edge.qualifier!, target: edge.target }))
    if (roles.length) {
      senseRoles[id] = roles
      for (const role of roles) {
        const target = getMeaningSense(role.target)
        if (!target) throw new Error(`Unresolved source role ${role.target}`)
        senseSynsets[target.id] = target.synset
        addSynset(target.synset, 1)
      }
    }
  }
  const body = { version: 'wyrmle-semantic-source-1', dictionaryVersion: MEANING_DICTIONARY_VERSION,
    words, defaults, senses: Object.fromEntries(Object.entries(senses).sort(([a], [b]) => a.localeCompare(b))),
    profiles: assessedProfiles, senseSynsets, senseRoles,
    synsets: Object.fromEntries(Object.entries(synsets).sort(([a], [b]) => a.localeCompare(b))) }
  const sourceDigest = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  return { ...body, sourceDigest }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2]
  if (!output) throw new Error('Usage: node scripts/export-semantic-source.ts OUTPUT.json')
  const source = exportSemanticSource()
  writeFileSync(output, JSON.stringify(source) + '\n')
  console.log(JSON.stringify({ output, sourceDigest: source.sourceDigest, words: Object.keys(source.words).length,
    senses: Object.keys(source.senses).length, senseReferences: Object.values(source.words).reduce((total, ids) => total + ids.length, 0) }))
}
