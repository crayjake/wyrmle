/** Offline inference results used by authoring only. Gameplay gets a frozen subset. */
import data from './data/semantic-assessments-v1.json' with { type: 'json' }
import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../lexicon/meaningDictionary.ts'
import { readSemanticAssessmentMetadata, readWordSemanticAssessment } from '../game/semanticAssessment.ts'
import type { SemanticAssessmentMetadata } from '../game/semanticAssessment.ts'
import type { PuzzleWordMeaning } from '../game/meaningLexicon.ts'
import type { PartOfSpeech, SemanticRelation } from '../game/types.ts'

export type AssessmentCache = {
  version: string
  dictionaryVersion: string
  words: string[]
  // Default dictionary senses use -1 in rows; only alternative senses are repeated here.
  senses: [id: string, lemma: string, definition: string, pos: PartOfSpeech, source: 'oewn-2025' | 'wiktionary-en'][]
  anchors: string[]
  methods: string[]
  enemies: Record<string, { definition: string; assessment: SemanticAssessmentMetadata;
    rows: [sense: number, relation: number, counter: number, resisted: number, margin: number, count: number, anchor: number, method: number][] }>
}
const relations: readonly SemanticRelation[] = ['unrelated', 'opposite', 'similar', 'related']

/** Missing/stale caches are authoring errors, never automatic neutral words. */
export function createSemanticAssessmentProvider(input: AssessmentCache) {
  const vocabulary = getDefinedDictionaryWords()
  if (input.version !== 'wyrmle-semantic-cache-1' || input.dictionaryVersion !== MEANING_DICTIONARY_VERSION
    || input.words.length !== vocabulary.length || input.words.some((word, index) => word !== vocabulary[index])) {
    throw new Error('Semantic assessment cache does not cover the current dictionary exactly.')
  }
  const indices = new Map(input.words.map((word, index) => [word, index]))
  const headers = new Map<string, SemanticAssessmentMetadata>()
  const entries = new Map<string, PuzzleWordMeaning>()
  const relationLists = new Map<string, Readonly<Record<SemanticRelation, readonly string[]>>>()
  for (const [enemy, table] of Object.entries(input.enemies)) {
    const header = readSemanticAssessmentMetadata(table.assessment)
    if (header.assessedWords !== vocabulary.length || table.rows.length !== vocabulary.length) {
      throw new Error(`Incomplete semantic assessment cache for ${enemy}.`)
    }
    headers.set(enemy, header)
  }
  function enemyTable(enemy: string) {
    const table = input.enemies[enemy]
    if (!table) throw new Error(`No offline semantic assessment cache for ${enemy}.`)
    return table
  }
  return Object.freeze({
    enemyWords: () => Object.keys(input.enemies).sort(),
    metadata(enemy: string) { enemyTable(enemy); return headers.get(enemy)! },
    definition(enemy: string) { return enemyTable(enemy).definition },
    relations(enemy: string) {
      let result = relationLists.get(enemy)
      if (!result) {
        const rows = enemyTable(enemy).rows
        result = Object.freeze(Object.fromEntries(relations.map((relation, index) => [relation,
          Object.freeze(input.words.filter((_, wordIndex) => rows[wordIndex][1] === index))])) as Record<SemanticRelation, readonly string[]>)
        relationLists.set(enemy, result)
      }
      return result
    },
    word(enemy: string, word: string): PuzzleWordMeaning {
      const table = enemyTable(enemy)
      const index = indices.get(word)
      if (index === undefined) throw new Error(`No semantic assessment for ${enemy}/${word}.`)
      const key = `${enemy}/${word}`
      const existing = entries.get(key)
      if (existing) return existing
      const row = table.rows[index]
      if (!Array.isArray(row) || row.length !== 8 || row.some(value => !Number.isSafeInteger(value)) || row[0] < -1
        || !relations[row[1]]) {
        throw new Error(`Invalid semantic assessment row for ${key}.`)
      }
      const [senseIndex, relationIndex, counter, resisted, margin, sensesEvaluated, anchor, method] = row
      const fallback = getDictionaryMeaning(word)!
      const sense = senseIndex === -1 ? undefined : input.senses[senseIndex]
      if (senseIndex !== -1 && !sense) throw new Error(`Missing assessed source sense for ${key}.`)
      const assessment = readWordSemanticAssessment({ counterScore: counter / 10000, resistedScore: resisted / 10000,
        margin: margin / 10000, sensesEvaluated, selectedAnchor: input.anchors[anchor], decisionBasis: input.methods[method] })
      const relation = relations[relationIndex]
      const reason = relation === 'opposite' ? `Counters ${enemy.toLowerCase()} through ${assessment.selectedAnchor}.`
        : relation === 'similar' ? `Reinforces ${enemy.toLowerCase()} through ${assessment.selectedAnchor}.`
          : `All ${sensesEvaluated} source senses assessed; no sufficiently supported counter or reinforcing meaning for ${enemy.toLowerCase()}.`
      const result: PuzzleWordMeaning = Object.freeze({
        definition: sense?.[2] ?? fallback.definition, lemma: sense?.[1] ?? fallback.lemma,
        senseId: sense?.[0] ?? fallback.senseId,
        partsOfSpeech: Object.freeze([...new Set([...fallback.partsOfSpeech, ...(sense ? [sense[3]] : [])])]),
        relation, reason, source: sense?.[4] ?? fallback.source, evidence: 'model-assessed', assessment,
      })
      entries.set(key, result)
      return result
    },
  })
}

export const semanticAssessmentProvider = createSemanticAssessmentProvider(data as unknown as AssessmentCache)
