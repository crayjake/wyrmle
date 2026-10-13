/** Shared proof and publication path for single puzzles and reviewed batches. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { bingoQualityIssue } from './answerQuality.ts'
import type { HuntProfile } from '../antonyms/huntProfiles.ts'
import { buildAntonymEncounter } from '../antonyms/build.ts'
import { planHuntRemovals } from '../antonyms/hunt.ts'
import { puzzleIdentity } from '../bingo/freshness.ts'
import { wordEffort } from '../bingo/routeDifficulty.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../../src/game/letterStrike.ts'
import { selectWordIds } from '../../src/generator/constructRefill.ts'
import { packDictionaryMeanings } from '../../src/game/meaningPacking.ts'
import { decodeScheduledPuzzle } from '../../src/daily/scheduledPuzzle.ts'
import type { ScheduledPuzzle } from '../../src/daily/scheduledPuzzle.ts'
import { validatePuzzleId } from '../../src/daily/date.ts'
export function preparePuzzle(selected: HuntProfile, date: string) {
  validatePuzzleId(date)
  const { profile, helpers, preferredHelpers } = selected
  const directory = `artifacts/puzzles/${date}`
  const id = `puzzle-${profile.id}-${date}`
  assert.ok(!profile.family && !profile.powers.length && profile.refills === '', 'Only plain same-type antonyms can be published')
  assert.equal(bingoQualityIssue(profile.enemy, profile.bingo), undefined, `${profile.id}: ${bingoQualityIssue(profile.enemy, profile.bingo)}`)
  const built = buildAntonymEncounter(profile)
  assert.equal(built.encounter.counterRules!.partOfSpeech, built.encounter.enemy.partOfSpeech, 'Enemy and antonyms must have the same word type')
  built.encounter.id = `daily-bingo-hunt:${date}:${profile.id}:v1`
  const identity = puzzleIdentity(id, built.encounter)
  for (const word of identity.bingos) {
    const issue = bingoQualityIssue(profile.enemy, word, built.source.lemma, built.encounter.meaningLexicon!.words[word].lemma)
    assert.equal(issue, undefined, `${id}: ${word}: ${issue}`)
  }
  const { encounter, review } = planHuntRemovals(built.encounter, profile.bingo, preferredHelpers)
  const initial = createLetterStrikeGame(encounter)
  const startingBingos = encounter.enemy.semanticRelations.opposite.flatMap(word => {
    const ids = selectWordIds(initial.tiles, word)
    return ids && previewLetterStrike(initial, ids).bingoHunt?.won ? [{ word, effort: wordEffort(word) }] : []
  })
  const helperEffort = Math.max(...helpers.map(word => wordEffort(word)))
  assert.ok(startingBingos.length && startingBingos.every(bingo => bingo.effort >= helperEffort + .4),
    `${id}: an easier bingo undercuts the planned helpers`)
  const witnesses = [[profile.bingo], [helpers[0], profile.bingo], [...helpers, profile.bingo]]
  for (const route of witnesses) {
    let state = initial
    for (const word of route) {
      const ids = selectWordIds(state.tiles, word)
      assert.ok(ids, `${id}: ${word}`)
      state = submitLetterStrike(state, ids)
      assert.equal(state.error, null)
    }
    assert.equal(state.status, 'won')
    assert.equal(state.playedWords.length, route.length)
  }
  const payload = { version: 1, id, method: 'bingo-first',
    encounter: { ...encounter, meaningLexicon: packDictionaryMeanings(encounter.meaningLexicon!) } }
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
  const asset = `puzzles/${id}-${digest}.json`
  const entry: ScheduledPuzzle = { date, id, enemy: profile.enemy, asset, method: 'bingo-first', bingoHunt: true,
    report: `${directory}/${id}.json` }
  decodeScheduledPuzzle(payload, entry)
  return { entry, payload, report: { accepted: true, asset, answer: profile.bingo, rules: 'bingo-hunt',
    review: profile.review, identity, witnesses, startingBingos, helperEffort, removalProof: review },
    guide: { answer: profile.bingo, hints: profile.hints,
      explanation: `${profile.bingo} is an opposite ${encounter.enemy.partOfSpeech} containing every letter of ${profile.enemy}.` },
    counters: encounter.enemy.semanticRelations.opposite }
}
export type PreparedPuzzle = ReturnType<typeof preparePuzzle>
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
export function publicationContext(archive = false) {
  const manifest = `src/daily/${archive ? 'archive' : 'schedule'}.json`
  return { manifest, entries: read(manifest) as ScheduledPuzzle[],
    allEntries: [...read('src/daily/archive.json'), ...read('src/daily/schedule.json')] as ScheduledPuzzle[],
    guides: read('src/daily/guides.json') as Record<string, PreparedPuzzle['guide']> }
}
export function checkPublicationDates(dates: string[], context: ReturnType<typeof publicationContext>, replace = false) {
  assert.equal(new Set(dates).size, dates.length, 'Duplicate publication dates')
  for (const date of dates) {
    validatePuzzleId(date)
    assert.ok(!context.allEntries.some(entry => entry.date === date) || replace,
      'Date already occupied; use a new date, or explicitly --replace to revise an authorized puzzle')
    assert.ok(!context.allEntries.some(entry => entry.date === date && !context.entries.some(current => current.date === date)),
      'Date belongs to the other manifest; select the correct --archive setting')
  }
}
/** Prepare every proof before calling this: a failed candidate never publishes a partial batch. */
export function publishPreparedPuzzles(puzzles: PreparedPuzzle[], options: { archive?: boolean; replace?: boolean; dryRun?: boolean } = {}) {
  const context = publicationContext(options.archive)
  checkPublicationDates(puzzles.map(puzzle => puzzle.entry.date), context, options.replace)
  const pairs = new Set<string>()
  const dates = new Set(puzzles.map(puzzle => puzzle.entry.date))
  for (const entry of context.allEntries.filter(entry => !dates.has(entry.date))) {
    pairs.add(`${entry.enemy}:${context.guides[entry.id]?.answer}`)
  }
  for (const puzzle of puzzles) {
    const pair = `${puzzle.entry.enemy}:${puzzle.guide.answer}`
    assert.ok(options.dryRun || !pairs.has(pair), 'This enemy and bingo are already published; choose a different answer')
    pairs.add(pair)
    const path = `public/${puzzle.entry.asset}`
    // Never overwrite a content-addressed asset with different bytes.
    try { assert.equal(JSON.stringify(read(path)), JSON.stringify(puzzle.payload), `Immutable asset conflict: ${path}`) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  if (options.dryRun) return
  const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
  for (const puzzle of puzzles) {
    mkdirSync(`artifacts/puzzles/${puzzle.entry.date}`, { recursive: true })
    write(`public/${puzzle.entry.asset}`, puzzle.payload)
    write(puzzle.entry.report!, puzzle.report)
    context.guides[puzzle.entry.id] = puzzle.guide
  }
  write('src/daily/guides.json', context.guides)
  write(context.manifest, [...context.entries.filter(entry => !dates.has(entry.date)), ...puzzles.map(puzzle => puzzle.entry)]
    .sort((a, b) => a.date.localeCompare(b.date)))
}
