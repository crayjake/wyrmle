/** Rebuild reviewed counter previews and certify their difficulty progression. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { antonymProfiles } from './antonyms/profiles.ts'
import { buildAntonymEncounter } from './antonyms/build.ts'
import { packDictionaryMeanings } from '../src/game/meaningPacking.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { canSpell } from '../src/generator/constructBoard.ts'
import { getGenerationWordZipf } from '../src/generator/familiarity.ts'
import previousCatalog from '../src/experimental/concepts/catalog.json' with { type: 'json' }
import type { ConceptEntry } from '../src/experimental/concepts/catalog.ts'
import { decodeConceptPuzzle } from '../src/experimental/concepts/catalog.ts'
import { certifyHuntProgressCompatibility, planHuntRemovals } from './antonyms/hunt.ts'

import { certifyProgression } from './antonyms/progression.ts'

const directory = 'artifacts/antonym-previews-2026-09-28'
mkdirSync(directory, { recursive: true })
mkdirSync('public/previews/concepts', { recursive: true })
const huntOnly = process.argv.includes('--hunt-only')
assert.ok(!huntOnly || !process.env.CONCEPT_ID, 'Choose --hunt-only or CONCEPT_ID')
const catalog: ConceptEntry[] = huntOnly ? (previousCatalog as ConceptEntry[]).filter(entry => !entry.bingoHunt) : []
const reports = []
for (const profile of antonymProfiles) {
  if (huntOnly) continue
  if (process.env.CONCEPT_ID && profile.id !== process.env.CONCEPT_ID) continue
  const { encounter, packed, roots, source, words } = buildAntonymEncounter(profile)
  const decoded = encounter
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
if (!process.env.CONCEPT_ID) {
  // Two comparisons with the same starting letters and reviewed antonyms.
  const huntReports = []
  for (const { id, helpers, preferredHelpers, progressRevision } of [
    { id: 'alert', helpers: ['SLOW', 'INERT'], preferredHelpers: ['SLOW', 'TIRED', 'IDLE', 'INERT'], progressRevision: '215093c7c262' },
    { id: 'true', helpers: ['WRONG', 'UNREAL'], preferredHelpers: ['WRONG', 'UNREAL', 'INCORRECT'], progressRevision: '5f7f54a6985b' },
  ]) {
    const profile = antonymProfiles.find(profile => profile.id === id)!
    const built = buildAntonymEncounter({ ...profile, refills: '' })
    const huntId = `hunt-${id}`
    built.encounter.id = `antonym-preview-v2:${huntId}`
    const { encounter, review } = planHuntRemovals(built.encounter, profile.bingo, preferredHelpers)
    const previous = (previousCatalog as ConceptEntry[]).find(entry => entry.id === huntId)!
    const legacy = decodeConceptPuzzle(JSON.parse(readFileSync(`public/previews/concepts/${huntId}-${progressRevision}.json`, 'utf8')), previous)
    const compatibility = certifyHuntProgressCompatibility(legacy, encounter)
    for (const words of [[profile.bingo], [helpers[0], profile.bingo], [...helpers, profile.bingo]]) {
      let state = createLetterStrikeGame(encounter)
      for (const word of words) {
        const ids = selectWordIds(state.tiles, word)
        assert.ok(ids, `${huntId}: ${word}`)
        state = submitLetterStrike(state, ids)
        assert.equal(state.error, null)
      }
      assert.equal(state.status, 'won')
      assert.equal(state.playedWords.length, words.length)
    }
    const raw = JSON.stringify({ ...encounter, meaningLexicon: packDictionaryMeanings(encounter.meaningLexicon!) }) + '\n'
    const revision = createHash('sha256').update(raw).digest('hex').slice(0, 12)
    const asset = `previews/concepts/${huntId}-${revision}.json`
    writeFileSync(`public/${asset}`, raw)
    catalog.push({ id: huntId, enemy: profile.enemy, definition: profile.definition, asset, revision, progressRevision, powers: 0,
      bingoHunt: true, partOfSpeech: encounter.enemy.partOfSpeech!, counterPartOfSpeech: encounter.counterRules!.partOfSpeech,
      guide: { answer: profile.bingo, hints: profile.hints, explanation: `${profile.bingo} is an opposite adjective containing every letter of ${profile.enemy}.` } })
    huntReports.push({ id: huntId, revision, progressRevision, ...review, compatibility })
    console.log(huntId, JSON.stringify({ candidates: review.candidatesChecked, minimumFollowupFamilies: review.minPreferredFamilies, compatibility }))
  }
  writeFileSync('src/experimental/concepts/catalog.json', JSON.stringify(catalog, null, 2) + '\n')
  writeFileSync(`${directory}/hunt-proofs.json`, JSON.stringify(huntReports, null, 2) + '\n')
}
if (!huntOnly) writeFileSync(`${directory}/${process.env.CONCEPT_ID ? `${process.env.CONCEPT_ID}-proof` : 'proofs'}.json`, JSON.stringify(reports, null, 2) + '\n')
