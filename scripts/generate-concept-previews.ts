/** Rebuild six reviewed counter previews and certify their difficulty progression. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { antonymProfiles } from './antonyms/profiles.ts'
import { getMeaningSense, getWordMeanings } from './lib/wordMeanings.ts'
import { getDefinedDictionaryWords, getDictionaryMeaning, MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../src/game/letterStrike.ts'
import { MEANING_LEXICON_VERSION, meaningSupply } from '../src/game/meaningLexicon.ts'
import type { PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import { packDictionaryMeanings, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { canSpell } from '../src/generator/constructBoard.ts'
import { createRandom } from '../src/generator/random.ts'
import { getGenerationWordZipf } from '../src/generator/familiarity.ts'

import { certifyProgression } from './antonyms/progression.ts'

const directory = 'artifacts/antonym-previews-2026-09-28'
mkdirSync(directory, { recursive: true })
mkdirSync('public/previews/concepts', { recursive: true })
const catalog = []
const reports = []
for (const profile of antonymProfiles) {
  if (process.env.CONCEPT_ID && profile.id !== process.env.CONCEPT_ID) continue
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
  const initial = createLetterStrikeGame(decoded)
  const replay = (route: readonly string[]) => {
    let game = initial
    const steps = route.map(word => {
      const ids = selectWordIds(game.tiles, word)
      assert.ok(ids, `${profile.id}: cannot spell ${word} after ${game.playedWords.map(m => m.word)}`)
      game = submitLetterStrike(game, ids)
      assert.equal(game.error, null, `${profile.id}: ${word}: ${game.error}`)
      const move = game.playedWords.at(-1)!
      assert.equal(move.word, word)
      assert.equal(move.semanticLabel, 'COUNTER', `${word} must be a reviewed counter`)
      assert.ok(move.strikes > 0, `${word} must make progress`)
      return { word, ids, hits: move.strikes, powerHits: move.preview.hits.filter(hit => hit.wild).length,
        remaining: game.enemyLetters.filter(letter => letter.hitsRemaining).map(letter => letter.letter).join('') }
    })
    assert.equal(game.status, 'won', `${profile.id}: ${route.join(' → ')}`)
    return steps
  }
  const routes = profile.routes.map(replay)
  const starts = encounter.enemy.semanticRelations.opposite.filter(word => canSpell(word, initial.tiles.map(tile => tile.letter)))
  const enumerate = (state: LetterStrikeState) => starts.flatMap(word => {
    const ids = selectWordIds(state.tiles, word)!
    const next = submitLetterStrike(state, ids)
    return next.status === 'won' ? [word] : []
  })
  const bingos = enumerate(initial)
  const withoutPower = createLetterStrikeGame({ ...decoded, startingTiles: decoded.startingTiles.map(tile => ({ id: tile.id, letter: tile.letter, type: 'normal' })) })
  const unpoweredBingos = enumerate(withoutPower)
  if (profile.powers.length) assert.equal(unpoweredBingos.length, 0, `${profile.id}: POWER must enable an otherwise unavailable bingo`)
  const progression = certifyProgression(decoded, profile.routes)
  console.log(profile.id, JSON.stringify(progression.ratings), progression.issues)
  assert.equal(progression.passed, true, JSON.stringify(progression.issues))
  const raw = JSON.stringify(packed) + '\n'
  const revision = createHash('sha256').update(raw).digest('hex').slice(0, 12)
  const asset = `previews/concepts/${profile.id}-${revision}.json`
  writeFileSync(`public/${asset}`, raw)
  catalog.push({ id: profile.id, enemy: profile.enemy, definition: profile.definition, asset, revision,
    powers: profile.powers.length, family: profile.family, partOfSpeech: source.partOfSpeech, counterPartOfSpeech: encounter.counterRules.partOfSpeech, guide: { answer: profile.bingo, hints: profile.hints,
      explanation: `${profile.bingo} ${profile.family ? `belongs to the “${profile.family}” counter family` : `is an opposite ${source.partOfSpeech} for ${profile.enemy}`}.${profile.powers.length ? ' The blue tiles cover the missing enemy letters.' : ' It contains every enemy letter.'}` } })
  const effort = (word: string) => Math.round((2 * Math.max(0, 4.5 - (getGenerationWordZipf(word) ?? 0)) + .6 * Math.max(0, word.length - 5)) * 100) / 100
  reports.push({ id: profile.id, revision, review: profile.review, roots, supplemental: profile.supplemental, progression, startingCounters: starts,
    startingBingos: bingos, unpoweredBingos, routes, routeEffort: profile.routes.map(route => Math.max(...route.map(effort))),
    words: Object.keys(words).length, bytes: raw.length,
    limitation: 'Reviewed senses and exact route checks; subjective human difficulty still needs playtesting.' })
  console.log(profile.id, JSON.stringify({ starts, bingos, unpoweredBingos, routes: routes.map(route => route.map(step => `${step.word}:${step.hits}`)) }))
}
if (!process.env.CONCEPT_ID) writeFileSync('src/experimental/concepts/catalog.json', JSON.stringify(catalog, null, 2) + '\n')
writeFileSync(`${directory}/${process.env.CONCEPT_ID ? `${process.env.CONCEPT_ID}-proof` : 'proofs'}.json`, JSON.stringify(reports, null, 2) + '\n')
