/** Publish one reviewed bingo-first puzzle, with exhaustive removal proofs. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { puzzleProfiles, avoidsLessAnswer } from './puzzles/profiles.ts'
import { buildAntonymEncounter } from './antonyms/build.ts'
import { planHuntRemovals } from './antonyms/hunt.ts'
import { puzzleIdentity } from './bingo/freshness.ts'
import { wordEffort } from './bingo/routeDifficulty.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { packDictionaryMeanings } from '../src/game/meaningPacking.ts'
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import type { ScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { validatePuzzleId } from '../src/daily/date.ts'

const args = process.argv.slice(2)
const option = (name: string) => args[args.indexOf(name) + 1]
if (!args.includes('--profile') || !args.includes('--date')) throw new Error('Usage: npm run generate:puzzle -- --profile ID --date YYYY-MM-DD [--dry-run] [--replace] [--archive]')
const date = validatePuzzleId(option('--date'))
const selected = puzzleProfiles.find(item => item.profile.id === option('--profile'))
assert.ok(selected, `Unknown reviewed profile: ${option('--profile')}`)
const dryRun = args.includes('--dry-run'), archive = args.includes('--archive')
const directory = `artifacts/puzzles/${date}`
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
const manifest = `src/daily/${archive ? 'archive' : 'schedule'}.json`
const entries: ScheduledPuzzle[] = read(manifest)
const allEntries: ScheduledPuzzle[] = [...read('src/daily/archive.json'), ...read('src/daily/schedule.json')]
assert.ok(!allEntries.some(entry => entry.date === date) || args.includes('--replace'), 'Date already occupied; use a new date, or explicitly --replace to revise an authorized puzzle')
assert.ok(!allEntries.some(entry => entry.date === date && !entries.some(current => current.date === date)), 'Date belongs to the other manifest; select the correct --archive setting')
const guides = read('src/daily/guides.json')
const { profile, helpers, preferredHelpers } = selected
const id = `puzzle-${profile.id}-${date}`
assert.ok(!profile.family && !profile.powers.length && profile.refills === '', 'Only plain same-type antonyms can be published')
assert.ok(avoidsLessAnswer(profile.bingo), 'Avoid -less answers, including -lessness')
const built = buildAntonymEncounter(profile)
assert.equal(built.encounter.counterRules!.partOfSpeech, built.encounter.enemy.partOfSpeech, 'Enemy and antonyms must have the same word type')
built.encounter.id = `daily-bingo-hunt:${date}:${profile.id}:v1`
const { encounter, review } = planHuntRemovals(built.encounter, profile.bingo, preferredHelpers)
const initial = createLetterStrikeGame(encounter)
const startingBingos = encounter.enemy.semanticRelations.opposite.flatMap(word => {
  const ids = selectWordIds(initial.tiles, word)
  return ids && previewLetterStrike(initial, ids).bingoHunt?.won ? [{ word, effort: wordEffort(word) }] : []
})
const helperEffort = Math.max(...helpers.map(wordEffort))
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
const identity = puzzleIdentity(id, encounter)
assert.ok(startingBingos.every(bingo => avoidsLessAnswer(bingo.word)), 'A -less alternative bingo is present')
assert.ok(dryRun || !allEntries.some(entry => entry.date !== date && entry.enemy === profile.enemy && guides[entry.id]?.answer === profile.bingo), 'This enemy and bingo are already published; choose a different answer')
const payload = { version: 1, id, method: 'bingo-first',
  encounter: { ...encounter, meaningLexicon: packDictionaryMeanings(encounter.meaningLexicon!) } }
const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
const asset = `puzzles/${id}-${digest}.json`
const entry: ScheduledPuzzle = { date, id, enemy: profile.enemy, asset, method: 'bingo-first', bingoHunt: true,
  report: `${directory}/${id}.json` }
decodeScheduledPuzzle(payload, entry)
if (!dryRun) {
  mkdirSync(directory, { recursive: true })
  write(`public/${asset}`, payload)
  write(entry.report!, { accepted: true, asset, answer: profile.bingo, rules: 'bingo-hunt',
    review: profile.review, identity, witnesses, startingBingos, helperEffort, removalProof: review })
  guides[id] = { answer: profile.bingo, hints: profile.hints,
    explanation: `${profile.bingo} is an opposite ${encounter.enemy.partOfSpeech} containing every letter of ${profile.enemy}.` }
  write(manifest, [...entries.filter(existing => existing.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)))
  write('src/daily/guides.json', guides)
}
console.log(JSON.stringify({ dryRun, entry, witnesses, startingBingos, helperEffort, counters: encounter.enemy.semanticRelations.opposite }, null, 2))
console.log(`${date} ${profile.enemy}: ${review.pathsChecked} two-helper paths; ${review.minPreferredFamilies} minimum familiar follow-up families`)
