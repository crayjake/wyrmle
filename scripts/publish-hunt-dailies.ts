/** Publish the Bingo Hunt switchover with reproducible, reviewed boards. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { huntProfiles, tomorrowHunt } from './antonyms/huntProfiles.ts'
import { buildAntonymEncounter } from './antonyms/build.ts'
import { planHuntRemovals } from './antonyms/hunt.ts'
import { freshnessIssues, puzzleIdentity } from './bingo/freshness.ts'
import { wordEffort } from './bingo/routeDifficulty.ts'
import { createLetterStrikeGame, previewLetterStrike, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'
import { packDictionaryMeanings } from '../src/game/meaningPacking.ts'
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import type { ScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import { shiftPuzzleId } from '../src/daily/date.ts'

const start = '2026-09-29'
const directory = `artifacts/bingo-hunt-daily-${start}`
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
const profiles = [tomorrowHunt, ...huntProfiles.filter(hunt => !hunt.progressRevision)]
const history = read('scripts/bingo/published-history.json')
const guides = read('src/daily/guides.json')
const entries: ScheduledPuzzle[] = []
mkdirSync(directory, { recursive: true })
for (const [index, { profile, helpers, preferredHelpers }] of profiles.entries()) {
  const date = shiftPuzzleId(start, index), id = `hunt-${profile.id}-${date}`
  const built = buildAntonymEncounter(profile)
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
  assert.deepEqual(freshnessIssues(identity, history.filter((entry: { id: string }) => entry.id !== id)), [], id)
  const previous = history.findIndex((entry: { id: string }) => entry.id === id)
  if (previous < 0) history.push(identity)
  else history[previous] = identity
  const payload = { version: 1, id, method: 'bingo-first',
    encounter: { ...encounter, meaningLexicon: packDictionaryMeanings(encounter.meaningLexicon!) } }
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
  const asset = `puzzles/${id}-${digest}.json`
  const entry: ScheduledPuzzle = { date, id, enemy: profile.enemy, asset, method: 'bingo-first', bingoHunt: true,
    report: `${directory}/${id}.json` }
  decodeScheduledPuzzle(payload, entry)
  write(`public/${asset}`, payload)
  write(entry.report!, { accepted: true, asset, answer: profile.bingo, rules: 'bingo-hunt',
    review: profile.review, identity, witnesses, startingBingos, helperEffort, removalProof: review })
  guides[id] = { answer: profile.bingo, hints: profile.hints,
    explanation: `${profile.bingo} is an opposite adjective containing every letter of ${profile.enemy}.` }
  entries.push(entry)
  console.log(`${date} ${profile.enemy}: ${review.pathsChecked} two-helper paths; ${review.minPreferredFamilies} minimum familiar follow-up families`)
}
// Retain today's and older immutable assets/progress. The combat queue is frozen
// in previous-schedule.json, rather than silently resuming after these hunts.
const previous = read(`${directory}/previous-schedule.json`) as ScheduledPuzzle[]
write('src/daily/schedule.json', [...previous.filter(entry => entry.date < start), ...entries])
write(`${directory}/schedule.json`, entries)
write('src/daily/guides.json', guides)
write('scripts/bingo/published-history.json', history)
