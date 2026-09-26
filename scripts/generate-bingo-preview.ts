/** Isolated design experiment. This writes no daily catalog, dates or semantic caches. */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { getDailyPuzzleForVersion } from '../src/daily/puzzle.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeEncounter, LetterStrikeState } from '../src/game/letterStrike.ts'
import { packMeaningLexicon } from '../src/game/meaningPacking.ts'
import type { PuzzleWordMeaning } from '../src/game/meaningLexicon.ts'
import { withCompiledMeanings } from '../src/generator/meaningCompiler.ts'
import { createRandom } from '../src/generator/random.ts'
import { discoverValidMoves, findPlayableWords, moveSummary } from '../src/generator/findMoves.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { getGenerationWordCommonness } from '../src/generator/familiarity.ts'
import { semanticRefinementDigest } from '../src/generator/semanticRefinement.ts'

const directory = 'artifacts/bingo-preview-2026-09-26'
mkdirSync(directory, { recursive: true })
const base = getDailyPuzzleForVersion('2026-09-26', 'letter-strike-7', 13).encounter
const bingo = 'ORCHESTRATES'
// Backwards construction: the bingo supplies every required hit, including two S tiles.
// The four spare letters also support CALMNESS, HALCYON, STORM and HARMONY.
const letters = bingo + 'LMNY'
assert.equal(letters.length, 16)
const refillLetters = 'ENHACAROAHOSS'
const initial = withCompiledMeanings({ ...base, id: 'beta-three-lives-bingo-1', startingResolve: 3,
  startingTiles: [...letters].map((letter, id) => ({ letter, id, type: 'normal' })),
  enemyLetters: [...'CHAOS'].map((letter, index) => ({ id: `enemy-${index}`, letter,
    initialHits: letter === 'S' ? 2 : 1, hitsRemaining: letter === 'S' ? 2 : 1 })),
  refillQueue: refillLetters, finiteRefills: true, grammarModifiers: {},
  tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true } },
})
const baseline = initial.meaningLexicon!
const sources = JSON.parse(readFileSync('src/generator/data/semantic-refinements-v1.json', 'utf8')) as {
  senses: { id: string; lemma: string; definition: string; partOfSpeech: PuzzleWordMeaning['partsOfSpeech'][number]; source: PuzzleWordMeaning['source'] }[]
}
// Preview-only source corrections. Do not invent local-model responses or mark
// a new inventory production-certified. The original evidence is retained below.
const edits: [string, PuzzleWordMeaning['relation'], string, string][] = [
  ['ORCHESTRATE ORCHESTRATES', 'opposite', 'oewn-orchestrate__2.31.00..', 'Planning and directing a complex undertaking brings order to chaos.'],
  ['CLATTER CLATTERS', 'similar', 'oewn-clatter__1.11.00..', 'A noisy rattling commotion reinforces chaos.'],
  ['CLATTERY', 'similar', 'oewn-clattery__5.00.00.noisy.00', 'A rattling, noisy sound reinforces the commotion sense of chaos.'],
  ['SCATTER SCATTERS', 'similar', 'oewn-scatter__1.07.00..', 'A haphazard distribution is disorder.'],
  ['RATTLE RATTLES', 'similar', 'oewn-rattle__1.11.00..', 'Repeated loud rattling contributes noisy commotion.'],
  ['SMOOTHEST', 'opposite', 'oewn-smooth__5.00.00.calm.00', 'Calm water free of disturbance counters turbulence.'],
  ['CATENATE CATENATES', 'opposite', 'oewn-catenate__2.35.00..', 'Arranging things in a series imposes order.'],
  ['SETTLER SETTLERS', 'opposite', 'oewn-settler__1.18.02..', 'A negotiator who settles disputes restores concord.'],
  ['ENTENTE ENTENTES', 'opposite', 'oewn-entente__1.10.00..', 'A friendly understanding brings concord between powers.'],
  ['TREATY', 'opposite', 'oewn-treaty__1.10.00..', 'An agreement between states establishes concord.'],
]
const words: Record<string, PuzzleWordMeaning> = Object.fromEntries(Object.entries(baseline.words).map(([word, record]) => {
  const { assessment: _assessment, ...meaning } = record
  const inherited = base.meaningLexicon!.words[word]
  if (inherited) assert.deepEqual(record, inherited, `The published review for ${word} cannot be inherited after its meaning changes.`)
  return [word, { ...meaning, evidence: inherited ? 'reviewed-profile' : 'lexical-expansion' }]
}))
const corrections = edits.flatMap(([spellings, relation, senseId, reason]) => {
  const source = sources.senses.find(sense => sense.id === senseId)
  assert.ok(source, `Missing pinned source ${senseId}`)
  return spellings.split(' ').filter(word => words[word]).map(word => {
    const previous = words[word]
    words[word] = { ...previous, relation, senseId, definition: source.definition, lemma: source.lemma,
      partsOfSpeech: previous.partsOfSpeech, source: source.source, evidence: 'reviewed-profile', reason }
    return { word, previousRelation: previous.relation, meaning: words[word] }
  })
})
const { assessment: _assessment, ...header } = baseline
const encounter: LetterStrikeEncounter = { ...initial, meaningLexicon: { ...header,
  profileVersion: 'bingo-design-preview-1', words }, enemy: { ...initial.enemy, semanticRelations: {
    opposite: Object.keys(words).filter(word => words[word].relation === 'opposite'),
    similar: Object.keys(words).filter(word => words[word].relation === 'similar'), related: [],
  } } }
const frequency = (word: string) => getGenerationWordCommonness(word) ?? 0
function choices(state: LetterStrikeState) {
  return findPlayableWords(state).filter(word => word.length >= 4
    && frequency(word) >= (words[word].relation === 'opposite' ? 0.35 : 0.5)).flatMap(word => {
    const ids = selectWordIds(state.tiles, word)
    if (!ids) return []
    const preview = previewLetterStrike(state, ids)
    return preview.valid ? [{ word, ids, preview, score: preview.strikes * 5 + frequency(word) }] : []
  }).sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
}
function route(start: LetterStrikeState, prefix: string[], depth: number): number[][] | null {
  let state = start
  const line: number[][] = []
  for (const word of prefix) {
    const ids = selectWordIds(state.tiles, word)
    if (!ids) return null
    state = submitLetterStrike(state, ids)
    if (state.error) return null
    line.push(ids)
  }
  const search = (state: LetterStrikeState, remaining: number): number[][] | null => {
    if (state.status === 'won') return []
    if (state.status !== 'playing' || !remaining) return null
    const available = choices(state)
    for (const move of available) if (move.preview.enemyLetters.every(letter => letter.hitsRemaining === 0)) return [move.ids]
    if (remaining === 1) return null
    for (const move of available.filter(move => move.preview.strikes > 0).slice(0, 16)) {
      const rest = search(submitLetterStrike(state, move.ids), remaining - 1)
      if (rest) return [move.ids, ...rest]
    }
    return null
  }
  const rest = search(state, depth - prefix.length)
  return rest ? [...line, ...rest] : null
}
const openings = ['CALMS', 'CALMNESS', 'SCHEMA', 'SCHEMAS', 'HALCYON', 'HALCYONS', 'HARMONY', 'SORTS', 'ROAR', 'STORM', 'CHAOS', 'MESS']
const candidates = []
for (let index = 0; index < 8; index++) {
  const seed = `three-life-bingo:${index}`
  const random = createRandom(seed)
  const candidate: LetterStrikeEncounter = { ...encounter,
    startingTiles: random.shuffle([...letters]).map((letter, id) => ({ letter, id, type: 'normal' })),
    refillQueue: random.shuffle([...refillLetters]).join('') }
  const start = createLetterStrikeGame(candidate)
  const routes = openings.flatMap(word => {
    const ids = route(start, [word], 3)
    if (!ids) return []
    let state = start
    const moves = ids.map(tileIds => { state = submitLetterStrike(state, tileIds); return state.playedWords.at(-1)! })
    assert.equal(state.status, 'won')
    return [{ opening: word, tileIds: ids, words: moves.map(m => m.word), labels: moves.map(m => m.semanticLabel),
      hits: moves.map(m => m.strikes), lives: state.playerResolve }]
  })
  const laterOptions = routes.filter(r => !['ROAR','STORM','CHAOS','MESS'].includes(r.opening)).map(r => {
    const state = submitLetterStrike(start, r.tileIds[0])
    const available = choices(state)
    return { after: r.opening, counters: available.filter(m => m.preview.semanticLabel === 'COUNTER' && m.preview.strikes > 0).map(m => m.word),
      resisted: available.filter(m => m.preview.semanticLabel === 'RESISTED').map(m => m.word) }
  })
  const score = routes.length * 10 + laterOptions.reduce((sum, p) => sum + Math.min(8, p.counters.length) + Number(p.resisted.length > 0) * 4, 0)
  candidates.push({ seed, candidate, score, routes, laterOptions })
  console.log(JSON.stringify({ seed, score, rescuedOpenings: routes.length }))
}
candidates.sort((a, b) => b.score - a.score || a.seed.localeCompare(b.seed))
const selected = candidates[0]
const start = createLetterStrikeGame(selected.candidate)
const root = discoverValidMoves(start)
assert.ok(root.complete && root.vocabularyComplete)
const wins = root.moves.filter(move => move.resultingState.status === 'won')
assert.deepEqual([...new Set(wins.map(move => move.word))], [bingo])
const bingoMove = moveSummary(wins[0])
assert.ok(selected.routes.length >= 8)
const chipComparison = [3, 5].map(lives => {
  let state = createLetterStrikeGame({ ...selected.candidate, startingResolve: lives })
  for (const word of ['CALMS', 'HEN', 'OAR', 'SEA']) {
    if (state.status !== 'playing') break
    const ids = selectWordIds(state.tiles, word)
    assert.ok(ids, `Comparison cannot spell ${word}`)
    state = submitLetterStrike(state, ids)
    assert.equal(state.error, null)
  }
  return { startingLives: lives, words: state.playedWords.map(m => m.word), labels: state.playedWords.map(m => m.semanticLabel),
    hits: state.playedWords.map(m => m.strikes), status: state.status, lives: state.playerResolve }
})
const { meaningLexicon, ...physical } = selected.candidate
writeFileSync('src/experimental/bingo/puzzle.json', JSON.stringify({ ...physical, meaningLexicon: packMeaningLexicon(meaningLexicon!) }) + '\n')
writeFileSync(`${directory}/semantic-evidence.json.gz`, gzipSync(JSON.stringify({ baseline, corrections })))
const report = {
  scope: 'isolated-design-preview', dailyPublicationReady: false, seed: selected.seed, score: selected.score,
  board: selected.candidate.startingTiles.map(t => t.letter).join(''), refills: selected.candidate.refillQueue,
  lives: 3, enemyHP: 6, rules: 'Existing counter/neutral/resisted rules; no Hit, Life, Revive, length or grammar bonuses.',
  bingo: bingoMove, openingEnumeration: { complete: root.complete, vocabularyComplete: root.vocabularyComplete,
    physicalSelections: root.legalSelectionsExamined, distinctWords: new Set(root.moves.map(m => m.word)).size,
    winningWords: [bingo], winningPhysicalSelections: wins.length },
  routes: selected.routes, laterOptions: selected.laterOptions, chipComparison,
  meanings: { words: Object.keys(words).length, inheritedReviewed: Object.keys(words).filter(w => base.meaningLexicon!.words[w]).length,
    newBaseAssessed: Object.keys(words).filter(w => !base.meaningLexicon!.words[w]).length, sourceCorrections: corrections.map(c => c.word),
    limitation: 'New supply meanings use the offline base model plus listed editorial source corrections. Complete contextual review and publication certification are still required; this preview does not claim zero semantic errors.' },
  encounterDigest: semanticRefinementDigest(selected.candidate),
  search: { candidates: candidates.map(c => ({ seed: c.seed, score: c.score, rescuedOpenings: c.routes.length })),
    scope: 'Canonical physical selections and bounded familiar continuations. Alternative routes are witnesses, not an all-opening safety proof.' },
}
writeFileSync(`${directory}/review.json`, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ selected: report.seed, board: report.board, routes: report.routes.map(r => r.words), chipComparison, bingo: bingoMove.word }))
