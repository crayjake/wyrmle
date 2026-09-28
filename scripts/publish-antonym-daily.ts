/** Reproduce the reviewed 29 September replacement without changing other days. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tomorrowAntonym as profile } from './antonyms/profiles.ts'
import { buildAntonymEncounter } from './antonyms/build.ts'
import { certifyProgression } from './antonyms/progression.ts'
import { freshnessIssues, puzzleIdentity } from './bingo/freshness.ts'
import { decodeScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'
import type { ScheduledPuzzle } from '../src/daily/scheduledPuzzle.ts'

const date = '2026-09-29'
const directory = 'artifacts/antonym-daily-2026-09-29'
const id = 'dear-affordable-antonyms'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
const { encounter, packed } = buildAntonymEncounter(profile)
encounter.id = packed.id = `daily-antonym:${date}:${profile.id}:v1`
const progression = certifyProgression(encounter, profile.routes)
assert.deepEqual(progression.issues, [])
const history = read('scripts/bingo/published-history.json')
const identity = puzzleIdentity(id, encounter)
assert.deepEqual(freshnessIssues(identity, history.filter((entry: { id: string }) => entry.id !== id)), [])
const payload = { version: 1, id, method: 'bingo-first', encounter: packed }
const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
const asset = `puzzles/${id}-${digest}.json`
const entry: ScheduledPuzzle = { date, id, enemy: profile.enemy, asset, method: 'bingo-first', report: `${directory}/${id}.json` }
decodeScheduledPuzzle(payload, entry)
mkdirSync(directory, { recursive: true })
write(`public/${asset}`, payload)
write(entry.report!, { accepted: true, asset, answer: profile.bingo, rules: 'same-part-of-speech-antonyms',
  review: profile.review, progression, twoWordWin: progression.routes.find(route => route.words.length === 2) })
const schedule = read('src/daily/schedule.json') as ScheduledPuzzle[]
assert.equal(schedule.filter(entry => entry.date === date).length, 1)
write('src/daily/schedule.json', schedule.map(old => old.date === date ? entry : old))
write('src/daily/guides.json', { ...read('src/daily/guides.json'), [id]: { answer: profile.bingo, hints: profile.hints,
  explanation: `${profile.bingo} is an opposite adjective for ${profile.enemy} in its price meaning. It contains every enemy letter.` } })
write('scripts/bingo/published-history.json', [...history.filter((entry: { id: string }) => entry.id !== id), identity])
console.log(`Queued ${profile.enemy} for ${date}; ${progression.positions} first-move positions checked.`)
