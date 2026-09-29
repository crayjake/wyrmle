import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import benchmarks from '../artifacts/daily-year-v3-benchmarks-2026-09-27/benchmarks.json' with { type: 'json' }
import rejected from '../artifacts/daily-year-v3-benchmarks-2026-09-27/rejected-days.json' with { type: 'json' }
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import puzzleSchedule from '../artifacts/calendar-transition-2026-09-29/previous-archive.json' with { type: 'json' }
import { packDictionaryMeanings, unpackMeaningLexicon } from '../src/game/meaningPacking.ts'
import { meaningSupply } from '../src/game/meaningLexicon.ts'
import { assessProgressionV3, easiestTwoWordWin, validateProgressionV3 } from '../scripts/bingo/progressionV3.ts'
import { replayRoute, wordEffort } from '../scripts/bingo/routeDifficulty.ts'
import { createLetterStrikeGame, previewLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { bingoProfileVersion, createBingoMeanings } from '../scripts/bingo/meanings.ts'
import { yearProfile, yearThemes } from '../scripts/bingo/year/profiles.ts'
import { semanticRegressions } from '../scripts/bingo/semanticRegressions.ts'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const fixture = (enemy: string) => {
  const entry = benchmarks.find(b => b.current.enemy === enemy)!.current
  return decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
}

for (const benchmark of benchmarks) test(`V3 benchmark ${benchmark.current.enemy}: easier 3, then 2, then every bingo survives asset transport`, () => {
  const entry = benchmark.current, report = read(benchmark.report)
  assert.deepEqual(puzzleSchedule.find(e => e.date === entry.date), entry)
  const encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
  const transported = { ...encounter, meaningLexicon: unpackMeaningLexicon(packDictionaryMeanings(encounter.meaningLexicon!)) }
  const result = validateProgressionV3(transported, report.semanticReview)
  assert.deepEqual(result, report.progression)
  assert.equal(result.two.complete, true)
  const { minimumGap } = result.policy
  assert.ok(result.three.rating!.effort + minimumGap <= result.two.rating!.effort + 1e-8)
  assert.ok(result.twoWordRoute.rating!.effort + minimumGap <= result.bingos[0].effort + 1e-8)
  for (const witness of [result.three.witness!, result.twoWordRoute.witness!, result.two.witness!, ...result.bingos.map(b => b.witness)]) {
    assert.equal(replayRoute(transported, witness).playedWords.length, witness.words.length)
  }
  assert.equal(result.three.witness!.labels[0], 'COUNTER')
  assert.ok(result.three.witness!.labels.filter(l => l === 'COUNTER').length >= 2)
  assert.ok(result.three.witness!.hits.every(n => n > 0))
  assert.ok(result.three.rating!.minZipf >= result.policy.threeWordMinimumZipf)
})

test('the retired DAYS benchmark catches SHADY and rejects the easier-tier tie and strained meaning', () => {
  const encounter = decodeScheduledPuzzle(read(`public/${rejected.entry.asset}`), rejected.entry)
  const result = assessProgressionV3(encounter)
  assert.equal(result.bingos[0].words[0], 'SHADY')
  assert.ok(result.bingos.some(b => b.words[0] === 'SHADOWY'))
  assert.equal(result.accepted, false)
  assert.match(result.issues.join(' '), /three-word route/)
  assert.throws(() => validateProgressionV3(encounter, rejected.semanticReview), /semantic review rejected/)
  assert.throws(() => validateProgressionV3(encounter, { ...rejected.semanticReview, verdict: 'approved' }), /difficulty progression failed/)
})

test('two-word lower bound includes bingo-family shortcuts and words below the ordinary frequency floor', () => {
  const previous = benchmarks.find(b => b.current.enemy === 'STOP')!.previous
  const stop = assessProgressionV3(decodeScheduledPuzzle(read(`public/${previous.asset}`), previous))
  assert.deepEqual(stop.two.witness!.words, ['MOVES', 'TRANSPORT'])
  assert.ok(stop.two.rating!.effort < stop.twoWordRoute.rating!.effort)
  const soil = assessProgressionV3(fixture('SOIL'))
  assert.ok(soil.two.rating!.minZipf < 2.4)
  assert.ok(soil.two.rating!.effort < soil.twoWordRoute.rating!.effort)
})

test('STOP starting forms are counters in the source, published lexicon and real opening preview', () => {
  const benchmark = benchmarks.find(b => b.current.enemy === 'STOP')!, report = read(benchmark.report), encounter = fixture('STOP')
  const profile = yearProfile(yearThemes.find(t => t.id === 'motion')!, 0, report)
  const source = createBingoMeanings(profile)
  assert.equal(encounter.meaningLexicon!.profileVersion, bingoProfileVersion(profile))
  for (const word of semanticRegressions[0].words) {
    assert.equal(source.meanings[word].relation, 'opposite', word)
    if (encounter.meaningLexicon!.words[word]) assert.equal(encounter.meaningLexicon!.words[word].relation, 'opposite', word)
  }
  for (const word of ['GET', 'GETS', 'GOT', 'GOTTEN', 'STARTLE', 'STARTLED', 'STARTLING']) {
    assert.equal(source.meanings[word].relation, 'unrelated', `Do not expand a generic or surprise sense: ${word}`)
  }
  const state = createLetterStrikeGame(encounter)
  for (const [word, hits] of [['START', 3], ['STARTS', 4], ['STARTED', 3], ['STARTING', 3]] as const) {
    const ids = selectWordIds(state.tiles, word)
    assert.ok(ids, word)
    const preview = previewLetterStrike(state, ids)
    assert.equal(preview.semanticLabel, 'COUNTER', word)
    assert.equal(preview.strikes, hits, word)
  }
  const old = decodeScheduledPuzzle(read(`public/${benchmark.previous.asset}`), benchmark.previous)
  assert.deepEqual(encounter.startingTiles, old.startingTiles)
  assert.equal(encounter.refillQueue, old.refillQueue)
  assert.deepEqual(encounter.enemyLetters, old.enemyLetters)
})

test('V3 rejects a neutral fallback for known direct counters even when its difficulty tiers pass', () => {
  const encounter = fixture('STOP'), lexicon = encounter.meaningLexicon!
  const broken = { ...encounter, meaningLexicon: { ...lexicon, words: { ...lexicon.words,
    START: { ...lexicon.words.START, relation: 'unrelated' as const },
    STARTING: { ...lexicon.words.STARTING, relation: 'unrelated' as const } } } }
  const result = assessProgressionV3(broken)
  assert.equal(result.accepted, false)
  assert.ok(result.issues.some(issue => issue.startsWith('Semantic regression: START must counter STOP.')))
  assert.ok(result.issues.some(issue => issue.startsWith('Semantic regression: STARTING must counter STOP.')))
  assert.ok(result.issues.every(issue => issue.startsWith('Semantic regression:')), 'Difficulty alone would have passed')
})

function controlledStop(words: string[], board: string, queue: string) {
  const base = fixture('STOP'), encounter = { ...base, startingTiles: [...board].map((letter, id) => ({ id, letter, type: 'normal' as const })), refillQueue: queue }
  const lexicon = { ...base.meaningLexicon!, letterSupply: meaningSupply(encounter), words: Object.fromEntries(words.map(w => {
    assert.ok(base.meaningLexicon!.words[w], w)
    return [w, base.meaningLexicon!.words[w]]
  })) }
  return { ...encounter, meaningLexicon: lexicon }
}
test('lower-bound search includes repeated words and zero-hit refill moves', () => {
  const repeated = controlledStop(['TRANSPORT'], 'TRANSPORTEEEEEEE', 'TRANSPORTTRANSPORTAAAAAA')
  const first = easiestTwoWordWin(repeated)
  assert.deepEqual(first.witness!.words, ['TRANSPORT', 'TRANSPORT'])
  assert.equal(first.complete, true)
  assert.equal(first.rating!.effort, wordEffort('TRANSPORT'))
  assert.equal(replayRoute(repeated, first.witness!).status, 'won')
  const zero = controlledStop(['EVE', 'TRANSPORTS'], 'TRANSPORTEEEEEVV', 'SSSEEEEEEEEEEEEEEEEEEEEE')
  const second = easiestTwoWordWin(zero)
  assert.deepEqual(second.witness!.words, ['EVE', 'TRANSPORTS'])
  assert.equal(second.witness!.hits[0], 0)
  assert.equal(second.complete, true)
  assert.equal(replayRoute(zero, second.witness!).status, 'won')
})

test('a search budget cannot be mistaken for a proven lower bound', () => {
  const result = easiestTwoWordWin(fixture('STOP'), 1)
  assert.equal(result.complete, false)
  assert.equal(result.positions, 1)
  assert.throws(() => easiestTwoWordWin(fixture('STOP'), 0))
})

test('publication requires a current review of every bingo, not just the nominated answer', () => {
  const benchmark = benchmarks.find(b => b.current.enemy === 'DIM')!, report = read(benchmark.report), encounter = fixture('DIM')
  const review = report.semanticReview
  assert.throws(() => validateProgressionV3(encounter, undefined!), /requires a semanticReview/)
  assert.throws(() => validateProgressionV3({ ...encounter, refillQueue: encounter.refillQueue.split('').reverse().join('') }, review), /review is stale/)
  const bingoConcepts = { ...review.bingoConcepts }; delete bingoConcepts.ILLUMINED
  assert.throws(() => validateProgressionV3(encounter, { ...review, bingoConcepts }), /Unreviewed bingo: ILLUMINED/)
  assert.throws(() => assessProgressionV3({ ...encounter, finiteRefills: false }), /finite/)
})

test('the real batch command rejects high-scoring DAYS and constructs the passing TRUST benchmark', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wyrmle-v3-test-'))
  try {
    // An isolated authoring workspace with no published history. No live
    // catalog, source inventory or user save is changed by this CLI test.
    mkdirSync(join(directory, 'scripts/bingo'), { recursive: true })
    writeFileSync(join(directory, 'scripts/bingo/published-history.json'), '[]')
    const candidates = read('artifacts/daily-year-2026-10-26/candidates.json')
      .filter(c => c.enemy === 'DAYS' && c.bingo === 'SHADOWY' || c.enemy === 'TRUST' && c.bingo === 'UNCERTAINTIES')
    assert.equal(candidates.length, 2)
    writeFileSync(join(directory, 'candidates.json'), JSON.stringify(candidates))
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/generate-daily-year.ts', import.meta.url)),
      '--directory', directory, '--start', '2030-01-01', '--seeds', '2', '--limit', '2'],
    { cwd: directory, encoding: 'utf8', timeout: 120000 })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const days = read(join(directory, 'reports/light-1-days-shadowy.json'))
    const trust = read(join(directory, 'reports/belief-1-trust-uncertainties.json'))
    assert.equal(days.accepted, false)
    assert.equal(days.progression.accepted, false)
    assert.ok(days.score > trust.score, 'A high old design score cannot override the difficulty gate')
    assert.equal(trust.accepted, true)
    assert.equal(trust.generatorVersion, 3)
    assert.equal(trust.progression.accepted, true)
    assert.equal(trust.publicationStatus, 'needs-semantic-review')
    assert.equal(trust.asset, benchmarks.find(b => b.current.enemy === 'TRUST')!.current.asset)
    assert.equal(existsSync(join(directory, 'payloads/light-1-days-shadowy.puzzle.json')), false)
    assert.equal(existsSync(join(directory, 'payloads/belief-1-trust-uncertainties.puzzle.json')), true)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
