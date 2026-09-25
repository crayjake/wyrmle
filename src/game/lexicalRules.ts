import { getPartsOfSpeech, normalizeWord } from './dictionary.ts'
import { getEncounterSemanticRelation, getStoredWordMeaning } from './meaningLexicon.ts'
import type { LetterStrikeEncounter } from './letterStrike.ts'
import type { EnemyConcept, PartOfSpeech } from './types.ts'
import { getLexicalPartsOfSpeech, getLexicalPosSource, getLexicalRelations, LEXICON_VERSION } from '../lexicon/index.ts'

export type LexicalRules = { version: typeof LEXICON_VERSION; grammarPolicy: 'any-recognized' }
export const currentLexicalRules: Readonly<LexicalRules> = Object.freeze({
  version: LEXICON_VERSION, grammarPolicy: 'any-recognized',
})

export function validateLexicalRules(encounter: LetterStrikeEncounter): void {
  if (encounter.lexicalRules && (encounter.lexicalRules.version !== LEXICON_VERSION
    || encounter.lexicalRules.grammarPolicy !== 'any-recognized')) {
    throw new Error('Unsupported lexical rules. This puzzle needs its original versioned lexicon.')
  }
}

export function getEncounterPartsOfSpeech(encounter: LetterStrikeEncounter, word: string): readonly PartOfSpeech[] | undefined {
  validateLexicalRules(encounter)
  if (encounter.meaningLexicon) return getStoredWordMeaning(encounter, word)?.partsOfSpeech
  const authored = encounter.wordPartsOfSpeech?.[normalizeWord(word)] ?? getPartsOfSpeech(word)
  return encounter.lexicalRules ? getLexicalPartsOfSpeech(word) ?? authored : authored
}

export function getEncounterWordClassification(encounter: LetterStrikeEncounter, word: string) {
  const partsOfSpeech = getEncounterPartsOfSpeech(encounter, word) ?? []
  const lexicalSource = encounter.lexicalRules ? getLexicalPosSource(word) : 'unknown'
  const partOfSpeechSource = lexicalSource !== 'unknown' ? lexicalSource : partsOfSpeech.length ? 'curated' : 'unknown'
  const relation = getEncounterSemanticRelation(encounter, word)
  const meaning = getStoredWordMeaning(encounter, word)
  return { partsOfSpeech, partOfSpeechSource, relation,
    ...(meaning ? { definition: meaning.definition, semanticReason: meaning.reason } : {}),
    // An unlisted word is a gameplay fallback, not a proven absence of related meanings.
    semanticSource: meaning ? 'compiled' as const : relation === 'unrelated' ? 'unlisted' as const : 'curated-or-wordnet' as const }
}

/** Authored gameplay meanings take precedence over strict, sense-pinned lexical links. */
export function enrichSemanticRelations(enemy: EnemyConcept['word'], authored: EnemyConcept['semanticRelations']): EnemyConcept['semanticRelations'] {
  const discovered = getLexicalRelations(enemy)
  const pinned = new Set(Object.values(authored).flat().map(normalizeWord))
  const add = (relation: keyof EnemyConcept['semanticRelations']) => [...new Set([
    ...authored[relation].map(normalizeWord),
    ...(discovered?.[relation] ?? []).filter(word => !pinned.has(word)),
  ])].sort()
  return { opposite: add('opposite'), similar: add('similar'), related: add('related') }
}

export function withCurrentLexicalRules(encounter: LetterStrikeEncounter): LetterStrikeEncounter {
  const copy = structuredClone(encounter)
  copy.lexicalRules = { ...currentLexicalRules }
  copy.enemy.semanticRelations = enrichSemanticRelations(copy.enemy.word, copy.enemy.semanticRelations)
  return copy
}
