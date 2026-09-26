/** Offline, source-pinned beta profiles. Never pretend these are model-certified dailies. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import profiles from './profiles.json' with { type: 'json' }
import { getMeaningSense, getWordMeanings } from '../lib/wordMeanings.ts'
import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../../src/lexicon/meaningDictionary.ts'
import { MEANING_LEXICON_VERSION, meaningSupply } from '../../src/game/meaningLexicon.ts'
import type { PuzzleWordMeaning } from '../../src/game/meaningLexicon.ts'
import type { LetterStrikeEncounter } from '../../src/game/letterStrike.ts'
import { canSpell } from '../../src/generator/constructBoard.ts'

export const bingoProfiles = profiles
export type BingoProfile = typeof profiles[number]
export const bingoProfileVersion = (profile: BingoProfile) => `bingo-source-profiles-1:${createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0, 12)}`
export function createBingoMeanings(profile: BingoProfile) {
  const enemySense = getMeaningSense(profile.enemySense)
  assert.ok(enemySense, `Unknown enemy sense: ${profile.enemySense}`)
  const pinned = new Map(profile.roots.map(root => {
    const sense = getMeaningSense(root.senseId)
    assert.ok(sense && sense.definition === root.definition, `Stale root: ${root.senseId}`)
    return [root.senseId, root]
  }))
  const synsets = new Map(profile.roots.map(root => [getMeaningSense(root.senseId)!.synset, root]))
  const derivations: { from: string; to: string; definition: string; relation: string }[] = []
  for (const root of profile.roots) {
    for (const edge of getMeaningSense(root.senseId)!.relations.filter(edge => edge.type === 'derivation')) {
      if (profile.excludedDerivations.includes(edge.target)) continue
      const target = getMeaningSense(edge.target)!
      if (synsets.has(target.synset)) continue
      synsets.set(target.synset, root)
      derivations.push({ from: root.senseId, to: target.id, definition: target.definition, relation: root.relation })
    }
  }
  const meanings: Record<string, PuzzleWordMeaning> = {}
  // Inspect all source senses, including inflected/plural spellings. Bounded
  // dictionary links carry labels; substrings and sentiment never do.
  for (const word of getDefinedDictionaryWords()) {
    const source = getDictionaryMeaning(word)!
    const matches = getWordMeanings(word).senses.flatMap(sense => {
      // Source forms attach to lexical entries, which can group homographs
      // with different inflections. Preserve reviewed word/sense exceptions.
      if (profile.excludedWordSenses.some(excluded => excluded.word === word && excluded.senseId === sense.id)) return []
      const adjective = sense.partOfSpeech === 'adverb' ? sense.relations.filter(edge => edge.type === 'pertainym')
        .map(edge => getMeaningSense(edge.target)).find(target => target && synsets.has(target.synset)) : undefined
      const root = pinned.get(sense.id) ?? synsets.get(sense.synset) ?? (adjective && synsets.get(adjective.synset))
      return root ? [{ sense, root, exact: pinned.has(sense.id) }] : []
    }).sort((a, b) => Number(b.root.relation === 'opposite') - Number(a.root.relation === 'opposite')
      || Number(b.exact) - Number(a.exact))
    const match = matches[0]
    meanings[word] = match ? {
      definition: match.sense.definition, lemma: match.sense.lemma, senseId: match.sense.id,
      partsOfSpeech: source.partsOfSpeech, source: 'oewn-2025',
      relation: match.root.relation as 'opposite' | 'similar',
      reason: `${match.root.relation === 'opposite' ? 'Counters' : 'Reinforces'} ${profile.enemy.toLowerCase()} through ${match.root.word.toLowerCase()}: ${match.root.definition}.`,
      evidence: match.exact ? 'reviewed-profile' : 'lexical-expansion',
    } : {
      definition: source.definition, lemma: source.lemma, senseId: source.senseId,
      partsOfSpeech: source.partsOfSpeech, source: source.source,
      relation: 'unrelated', evidence: 'defined-neutral',
      reason: 'No counter or reinforcing sense in this source-pinned beta profile; full contextual certification remains outstanding.',
    }
  }
  const relations = {
    opposite: Object.keys(meanings).filter(word => meanings[word].relation === 'opposite'),
    similar: Object.keys(meanings).filter(word => meanings[word].relation === 'similar'), related: [],
  }
  assert.equal(meanings[profile.bingo]?.relation, 'opposite', `Bingo lacks source evidence: ${profile.bingo}`)
  return {
    meanings, relations, enemySense, derivations,
    compile(encounter: LetterStrikeEncounter): LetterStrikeEncounter {
      const supply = meaningSupply(encounter)
      const words = Object.fromEntries(Object.entries(meanings).filter(([word]) =>
        word.length >= encounter.minimumWordLength && word.length <= encounter.startingTiles.length && canSpell(word, [...supply])))
      return { ...encounter, meaningLexicon: {
        version: MEANING_LEXICON_VERSION, dictionaryVersion: MEANING_DICTIONARY_VERSION,
        profileVersion: bingoProfileVersion(profile), policy: 'defined-only', enemyWord: profile.enemy,
        letterSupply: supply, minimumWordLength: encounter.minimumWordLength, maximumWordLength: encounter.startingTiles.length,
        words,
      } }
    },
  }
}
