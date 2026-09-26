/** A small, explicitly reviewed vocabulary study. This is not a full-dictionary daily. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { getDictionaryMeaning } from '../src/lexicon/meaningDictionary.ts'
import { meaningSupply, MEANING_LEXICON_VERSION } from '../src/game/meaningLexicon.ts'
import type { PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { constructBoard } from '../src/generator/constructBoard.ts'
import { constructRefill } from '../src/generator/constructRefill.ts'
import { createRandom } from '../src/generator/random.ts'
import { solvePuzzle } from '../src/generator/solve.ts'
import { analyseSemanticJourney } from '../src/generator/semanticJourney.ts'
import { getGenerationWordCommonness } from '../src/generator/familiarity.ts'

const counterWords = 'CHAOS ANARCHY HAVOC CLAMOR CLAMOUR CLANG CLASH CLASHES NOISY NOISE NOISILY HOWL HOWLS HOWLING ROAR ROARS RANT RANTS RAGE STORM STORMS STORMY ROWDY CACOPHONY CLATTER YELL YELLS SCREAM'.split(' ')
const resistedWords = 'CALM CALMS CALMER CALMEST SERENE TRANQUIL PEACE HARMONY LULL LULLABY HALCYON'.split(' ')
const neutralWords = 'SAND STONE CHAIR CHAIN CHIN COAL CORN CLOTH CART COAT CAR MAN SON ANY ONLY NAME LINE LION RAM CAN HEN HAM EAR SEA SEAL HEAR HOME REAL NEAR LOAN MONEY'.split(' ')
const vocabulary = [...counterWords, ...resistedWords, ...neutralWords]
assert.equal(new Set(vocabulary).size, vocabulary.length)
const meanings: Record<string, PuzzleWordMeaning> = Object.fromEntries(vocabulary.map(word => {
  const source = getDictionaryMeaning(word)
  assert.ok(source, `A reviewed definition is required for ${word}.`)
  const relation = counterWords.includes(word) ? 'opposite' : resistedWords.includes(word) ? 'similar' : 'unrelated'
  return [word, { definition: source.definition, senseId: source.senseId, lemma: source.lemma,
    partsOfSpeech: source.partsOfSpeech, source: source.source, relation, evidence: 'reviewed-profile',
    reason: relation === 'opposite' ? 'This reviewed sense brings noise, agitation, conflict or disorder to a calm and peaceful situation.'
      : relation === 'similar' ? 'This reviewed sense expresses or creates calm, peacefulness or concord.'
        : 'This reviewed sense describes an ordinary object, person, place or action without an inherent calming or disruptive meaning.' } satisfies PuzzleWordMeaning]
}))
const directory = 'artifacts/puzzle-design-2026-09-26/halcyon'
mkdirSync(directory, { recursive: true })
writeFileSync(`${directory}/reviewed-vocabulary.json`, JSON.stringify({ enemy: 'HALCYON',
  enemySense: getDictionaryMeaning('HALCYON'), scope: 'explicit-editorial-word-list-study', words: meanings,
  limitation: 'Only these listed spellings are admitted. Other words are rejected, never silently assumed neutral. A complete inventory and contextual review are required before daily publication.' }, null, 2) + '\n')
const reports = []
for (const [index, armourLetters, startingResolve] of [[0, 'HL', 5], [1, 'HLCN', 5], [2, 'HALCON', 5], [3, 'HLCN', 4], [4, 'HLCN', 5], [5, 'HLCN', 4]] as const) {
  const random = createRandom(`halcyon-study:${index}`)
  const board = constructBoard(['HARMONY', 'SERENE', 'CLAMOR', 'NOISY'], vocabulary, random)
  let encounter: LetterStrikeEncounter = {
    id: `halcyon-word-list-study-${index}`, enemy: { word: 'HALCYON', definition: meanings.HALCYON.definition,
      partOfSpeech: 'adjective', semanticRelations: { opposite: counterWords, similar: resistedWords, related: [] } },
    enemyLetters: [...'HALCYON'].map((letter, index) => ({ id: `enemy-${index}`, letter,
      initialHits: armourLetters.includes(letter) ? 2 : 1, hitsRemaining: armourLetters.includes(letter) ? 2 : 1 })),
    startingTiles: board, startingResolve, minimumWordLength: 3, grammarModifiers: {}, tileEffects: {},
    finiteRefills: true, refillQueue: 'E'.repeat(96),
  }
  const plan = constructRefill(encounter, vocabulary.map(word => ({ word, commonness: getGenerationWordCommonness(word) })), random, startingResolve, 24,
    { counters: counterWords, resisted: resistedWords })
  // Two extra studies replenish the calm theme explicitly, testing the weak
  // later theme observed in the first four lookahead-generated queues.
  const themeQueue = 'HARMONYSERENECALMNOISYCLASHROARHOWL'
  encounter = { ...encounter, refillQueue: index === 4 ? themeQueue : index === 5 ? random.shuffle([...themeQueue]).join('') : plan.refillQueue }
  encounter.meaningLexicon = { version: MEANING_LEXICON_VERSION, dictionaryVersion: 'halcyon-reviewed-word-list-study-1',
    profileVersion: 'halcyon-editorial-study-1', enemyWord: 'HALCYON', policy: 'defined-only',
    letterSupply: meaningSupply(encounter), minimumWordLength: 3, maximumWordLength: 16, words: meanings }
  const solution = solvePuzzle(encounter, { maxStates: 1200, beamWidth: 40, maxMovesPerState: 100,
    maxSelectionsPerState: 2000, maxWinningLines: 20, hintLine: plan.construction.plannedTileIds,
    wordCommonness: word => getGenerationWordCommonness(word) ?? 0 })
  for (const line of solution.winningLines) {
    let state = createLetterStrikeGame(encounter)
    for (const move of line.moves) { state = submitLetterStrike(state, move.tileIds); assert.equal(state.error, null) }
    assert.equal(state.status, 'won')
  }
  const journey = analyseSemanticJourney(encounter, solution.winningLines)
  const report = { encounter, scope: 'explicit-editorial-word-list-study', publicationReady: false,
    enemyHP: encounter.enemyLetters.reduce((sum, letter) => sum + letter.initialHits, 0),
    solvable: solution.solvable, bestWin: solution.bestWinDepth, minimumProven: solution.minimumTurnsProven,
    routes: solution.winningLines.map(({ moves, turns, resolveRemaining }) => ({ moves, turns, resolveRemaining })), journey }
  reports.push(report)
  console.log(JSON.stringify({ id: encounter.id, hp: report.enemyHP, lives: startingResolve, solvable: report.solvable,
    bestWin: report.bestWin, chipAway: journey.chipAwayWinRate, laterChoices: journey.laterCounterChoiceRate,
    laterTheme: journey.laterResistedPresenceRate, sustained: journey.sustainedWinningRouteRate,
    example: report.routes[0]?.moves.map(move => move.word) }))
}
writeFileSync(`${directory}/study.json.gz`, gzipSync(JSON.stringify(reports)))
writeFileSync(`${directory}/summary.json`, JSON.stringify(reports.map(report => ({ id: report.encounter.id,
  enemyHP: report.enemyHP, lives: report.encounter.startingResolve, board: report.encounter.startingTiles.map(tile => tile.letter).join(''),
  refills: report.encounter.refillQueue, solvable: report.solvable, bestWin: report.bestWin, minimumProven: report.minimumProven,
  chipAwayWins: report.journey.chipAwayRuns.filter(run => run.status === 'won').length, chipAwayRuns: report.journey.chipAwayRuns.length,
  laterCounterChoiceRate: report.journey.laterCounterChoiceRate, laterResistedPresenceRate: report.journey.laterResistedPresenceRate,
  sustainedWinningRouteRate: report.journey.sustainedWinningRouteRate,
  routes: report.routes.map(route => route.moves.map(move => move.word)),
  endgames: report.journey.positions.filter(position => position.counterFinishers.length && position.temptingResistedFinishers.length),
  scope: report.scope, publicationReady: false })), null, 2) + '\n')
