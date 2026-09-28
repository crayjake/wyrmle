/** Frozen, reviewed counter meanings shared by Daily and preview publishing. */
import assert from 'node:assert/strict'
import type { ConceptProfile } from './profiles.ts'
import { getMeaningSense, getWordMeanings } from '../lib/wordMeanings.ts'
import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../../src/lexicon/meaningDictionary.ts'
import type { LetterStrikeEncounter } from '../../src/game/letterStrike.ts'
import { MEANING_LEXICON_VERSION, meaningSupply } from '../../src/game/meaningLexicon.ts'
import type { PuzzleWordMeaning } from '../../src/game/meaningLexicon.ts'
import { packDictionaryMeanings, unpackMeaningLexicon } from '../../src/game/meaningPacking.ts'
import { canSpell } from '../../src/generator/constructBoard.ts'
import { createRandom } from '../../src/generator/random.ts'

export function buildAntonymEncounter(profile: ConceptProfile) {
  assert.equal(profile.letters.length, 16, profile.id)
  const roots = profile.roots.map(id => { const sense = getMeaningSense(id); assert.ok(sense, id); return sense })
  const exact = new Set<string>(profile.roots)
  const synsets = new Set(roots.filter(root => !(profile.wordOnly as readonly string[]).includes(root.id)).map(root => root.synset))
  const source = getMeaningSense(profile.sense)!
  const excludedWords = getDefinedDictionaryWords().filter(word => word.startsWith(profile.enemy)
    || getWordMeanings(word).senses.some(sense => sense.lemma.toUpperCase() === source.lemma.toUpperCase()))
  const excluded = new Set(excludedWords)
  const letters = [...profile.letters]
  const random = createRandom(`antonym-preview-v2:${profile.id}`)
  for (let i = letters.length - 1; i > 0; i--) { const j = random.int(i + 1); [letters[i], letters[j]] = [letters[j], letters[i]] }
  const powers = [...profile.powers] as string[]
  const encounter: LetterStrikeEncounter = {
    id: `antonym-preview-v2:${profile.id}`, enemy: { word: profile.enemy, definition: profile.definition,
      partOfSpeech: source.partOfSpeech, semanticRelations: { similar: [], opposite: [], related: [] } },
    counterRules: { kind: profile.family ? 'family' : 'antonym', family: profile.family, partOfSpeech: profile.counterPartOfSpeech ?? source.partOfSpeech, excludedWords },
    startingTiles: letters.map((letter, id) => {
      const power = powers.indexOf(letter)
      if (power >= 0) { powers.splice(power, 1); return { id, letter, type: 'gem', gem: 'power' } }
      return { id, letter, type: 'normal' }
    }),
    enemyLetters: [...profile.enemy].map((letter, index) => ({ id: `enemy-${index}`, letter, initialHits: 1, hitsRemaining: 1 })),
    startingResolve: 3, minimumWordLength: 3, finiteRefills: true, refillQueue: profile.refills,
    tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true },
      ...(profile.powers.length ? { power: { strike: false, preventResolveLoss: false, bonusStrike: true } } : {}) },
  }
  assert.equal(powers.length, 0)
  const supply = meaningSupply(encounter)
  const words: Record<string, PuzzleWordMeaning> = {}
  for (const word of getDefinedDictionaryWords()) {
    if (excluded.has(word) || word.length < 3 || word.length > 16 || !canSpell(word, [...supply])) continue
    const fallback = getDictionaryMeaning(word)!
    const match = getWordMeanings(word).senses.find(sense => sense.partOfSpeech === encounter.counterRules!.partOfSpeech && (exact.has(sense.id) || synsets.has(sense.synset)))
    words[word] = match ? {
      definition: match.definition, lemma: match.lemma, senseId: match.id, partsOfSpeech: [match.partOfSpeech],
      relation: 'opposite', source: 'oewn-2025', evidence: exact.has(match.id) ? 'reviewed-profile' : 'lexical-expansion',
      reason: `Opposes ${profile.enemy.toLowerCase()} (${profile.definition}): ${match.definition}. ${profile.family ? `Counter family: ${profile.family}.` : 'Same part of speech.'}`,
    } : { ...fallback, relation: 'unrelated', evidence: 'defined-neutral',
      reason: 'Outside the reviewed opposite senses and required word type; no hits.' }
  }
  for (const [word, override] of Object.entries(profile.overrides)) {
    if (!words[word]) continue
    const sense = getMeaningSense(override.sense)!
    words[word] = { definition: sense.definition, lemma: sense.lemma, senseId: sense.id, partsOfSpeech: [sense.partOfSpeech],
      relation: override.relation, reason: override.reason, source: 'oewn-2025', evidence: 'reviewed-profile' }
  }
  for (const [word, entry] of Object.entries(profile.supplemental ?? {})) {
    if (!words[word]) continue
    assert.equal(entry.partOfSpeech, encounter.counterRules!.partOfSpeech)
    words[word] = { definition: entry.definition, lemma: entry.lemma, senseId: entry.senseId,
      partsOfSpeech: [entry.partOfSpeech], relation: 'opposite', source: 'wiktionary-en', evidence: 'reviewed-profile',
      reason: `Reviewed ${entry.partOfSpeech} opposing ${profile.enemy} in its displayed meaning. Source: ${entry.sourceUrl}` }
  }
  encounter.enemy.semanticRelations.opposite = Object.keys(words).filter(word => words[word].relation === 'opposite')
  encounter.meaningLexicon = {
    version: MEANING_LEXICON_VERSION, dictionaryVersion: MEANING_DICTIONARY_VERSION,
    profileVersion: 'reviewed-antonym-previews-2', policy: 'defined-only', enemyWord: profile.enemy,
    letterSupply: supply, minimumWordLength: 3, maximumWordLength: 16, words,
  }
  const packed = { ...encounter, meaningLexicon: packDictionaryMeanings(encounter.meaningLexicon) }
  const decoded = { ...packed, meaningLexicon: unpackMeaningLexicon(JSON.parse(JSON.stringify(packed.meaningLexicon))) }
  return { encounter: decoded, packed, roots, source, words }
}
