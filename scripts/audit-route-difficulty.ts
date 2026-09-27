import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { getGenerationWordZipf, GENERATION_FAMILIARITY_METADATA } from '../src/generator/familiarity.ts'
import { getDictionaryMeaning } from '../src/lexicon/meaningDictionary.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { rateRoute, ordinaryRoute, replayRoute, searchEasierRoute, experimentalEffort, wordEffort, inspectThirdWords } from './bingo/routeDifficulty.ts'
import type { RouteWitness } from './bingo/routeDifficulty.ts'

const { values } = parseArgs({ options: {
  manifest: { type: 'string', default: 'artifacts/daily-year-2026-10-26/schedule.json' },
  output: { type: 'string', default: 'artifacts/route-difficulty-2026-09-27' },
  search: { type: 'string', default: '' }, budget: { type: 'string', default: '6000' },
} })
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const entries = read(values.manifest!), directory = values.output!, budget = Number(values.budget)
assert.ok(Number.isSafeInteger(budget) && budget > 0, '--budget must be a positive integer')
const search = new Set(values.search!.toUpperCase().split(',').filter(Boolean))
const protectedPaths = ['src/daily/schedule.json', 'src/daily/archive.json', 'src/daily/guides.json', 'scripts/bingo/published-history.json',
  ...entries.map(e => `public/${e.asset}`)]
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const before = Object.fromEntries(protectedPaths.map(path => [path, digest(path)]))
const results = []
for (const entry of entries) {
  const report = read(entry.report), encounter = decodeScheduledPuzzle(read(`public/${entry.asset}`), entry)
  const lexicon = encounter.meaningLexicon!.words, families = new Set<string>(report.analysis.bingos.map(w => lexicon[w].lemma))
  const rate = (witness: RouteWitness) => ({ ...rateRoute(witness.words), witness })
  const recorded: RouteWitness[] = [report.twoWordWin, ...report.analysis.routes.map(r => r.witness)].filter(Boolean)
  const honest = recorded.filter(w => ordinaryRoute(w, encounter, families))
  for (const route of honest) replayRoute(encounter, route)
  for (const word of report.analysis.bingos) replayRoute(encounter, {
    words: [word], tileIds: [selectWordIds(encounter.startingTiles, word)!], labels: ['COUNTER'],
    hits: [encounter.enemyLetters.reduce((total, letter) => total + letter.initialHits, 0)],
  })
  const best = (turns: number) => honest.filter(w => w.words.length === turns).map(rate).sort((a, b) => a.effort - b.effort)[0] ?? null
  const bingoOptions = report.analysis.bingos.map((word: string) => rateRoute([word])).sort((a, b) => a.effort - b.effort)
  const wordSet = new Set<string>([...report.analysis.bingos, ...recorded.flatMap(w => w.words)])
  const row = { date: entry.date, id: entry.id, enemy: entry.enemy, displayedAnswer: report.answer,
    displayedBingo: rateRoute([report.answer]), easiestBingo: bingoOptions[0], bingoOptions,
    savedTwo: rate(report.twoWordWin), bestRecordedTwo: best(2), bestRecordedThree: best(3),
    recordedTwos: honest.filter(w => w.words.length === 2).map(rate),
    recordedThrees: honest.filter(w => w.words.length === 3).map(rate),
    thirdWordChecks: honest.filter(w => w.words.length === 3).map(w => {
      const check = inspectThirdWords(encounter, w, report.analysis.bingos)
      return { ...check, finishers: check.finishers.slice(0, 8), omittedFinishers: Math.max(0, check.finishers.length - 8) }
    }),
    words: Object.fromEntries([...wordSet].sort().map(word => [word, { zipf: getGenerationWordZipf(word), length: word.length,
      lemma: lexicon[word].lemma, lemmaZipf: getGenerationWordZipf(lexicon[word].lemma), relation: lexicon[word].relation,
      definition: lexicon[word].definition, differsFromDefaultSense: lexicon[word].senseId !== getDictionaryMeaning(word)?.senseId }])),
    searches: search.has('*') || search.has(entry.enemy) ? {
      two: searchEasierRoute(encounter, 2, report.analysis.bingos, best(2)?.witness ?? null, budget),
      three: searchEasierRoute(encounter, 3, report.analysis.bingos, best(3)?.witness ?? null, budget),
    } : null }
  results.push(row)
  console.log(JSON.stringify({ enemy: entry.enemy, recorded: [row.easiestBingo.effort, row.bestRecordedTwo?.effort, row.bestRecordedThree?.effort],
    search: row.searches && [row.searches.two.rating, row.searches.three.rating],
    positions: row.searches && [row.searches.two.positions, row.searches.three.positions],
    complete: row.searches && [row.searches.two.searchComplete, row.searches.three.searchComplete] }))
}
for (const path of protectedPaths) assert.equal(digest(path), before[path], `Read-only audit changed ${path}`)
mkdirSync(directory, { recursive: true })
const write = (name: string, value: unknown) => writeFileSync(`${directory}/${name}`, JSON.stringify(value, null, 2)+'\n')
const complete = results.filter(r => r.bestRecordedTwo && r.bestRecordedThree)
const searched = results.filter(r => r.searches)
const comparableSearches = searched.filter(r => r.searches!.two.rating && r.searches!.three.rating)
const thirdWords = results.flatMap(r => r.thirdWordChecks)
write('results.json', { source: values.manifest, frequency: GENERATION_FAMILIARITY_METADATA, model: experimentalEffort,
  modelStatus: 'Uncalibrated authoring hypothesis. Corpus frequency is not sense frequency or measured discoverability.', budget, results })
write('summary.json', { puzzles: results.length, corpus: 'Pinned wordfreq 3.1.1 English large',
  savedTwoImprovedByOtherRecordedRoute: results.filter(r => r.bestRecordedTwo && r.savedTwo.effort > r.bestRecordedTwo.effort + 1e-8).length,
  comparableRecordedPuzzles: complete.length,
  recordedThreeHarderThanTwo: complete.filter(r => r.bestRecordedThree!.effort > r.bestRecordedTwo!.effort + 1e-8).length,
  recordedTwoHarderThanEasiestBingo: complete.filter(r => r.bestRecordedTwo!.effort > r.easiestBingo.effort + 1e-8).length,
  displayedAnswerNotEasiestBingo: results.filter(r => r.displayedBingo.effort > r.easiestBingo.effort + 1e-8).length,
  recordedCommonShortThree: results.filter(r => r.recordedThrees.some(w => w.commonAndShort)).length,
  searches: {
    puzzles: searched.length,
    completeTwo: searched.filter(r => r.searches!.two.searchComplete).length,
    completeThree: searched.filter(r => r.searches!.three.searchComplete).length,
    improvedTwo: searched.filter(r => r.searches!.two.rating && (!r.bestRecordedTwo || r.searches!.two.rating.effort < r.bestRecordedTwo.effort - 1e-8)).length,
    improvedThree: searched.filter(r => r.searches!.three.rating && (!r.bestRecordedThree || r.searches!.three.rating.effort < r.bestRecordedThree.effort - 1e-8)).length,
    commonShortThree: searched.filter(r => r.searches!.three.rating?.commonAndShort).length,
    comparable: comparableSearches.length,
    threeHarderThanTwo: comparableSearches.filter(r => r.searches!.three.rating.effort > r.searches!.two.rating.effort + 1e-8).length,
    twoHarderThanBingo: comparableSearches.filter(r => r.searches!.two.rating.effort > r.easiestBingo.effort + 1e-8).length,
    strictlyOrdered: comparableSearches.filter(r => r.searches!.three.rating.effort < r.searches!.two.rating.effort - 1e-8
      && r.searches!.two.rating.effort < r.easiestBingo.effort - 1e-8).length,
  },
  thirdWordChecks: { prefixes: thirdWords.length, noCommonShortFinisher: thirdWords.filter(p => !p.familiarFinisherCount).length,
    savedFinisherCanBeImproved: thirdWords.filter(p => p.finishers[0].effort < p.savedFinisher.effort - 1e-8).length },
  observedSensitivity: [.4, .6, .8].map(lengthWeight => {
    const cost = (words: string[]) => Math.max(...words.map(word => wordEffort(word, lengthWeight)))
    return { lengthWeight, threeHarderThanTwo: complete.filter(r => Math.min(...r.recordedThrees.map(w => cost(w.words)))
      > Math.min(...r.recordedTwos.map(w => cost(w.words))) + 1e-8).length }
  }),
  protectedFiles: before, allProtectedFilesUnchanged: true })
