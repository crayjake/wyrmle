import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { getDailyPuzzleId } from '../src/daily/date.ts'
import { getDailyPuzzle } from '../src/daily/puzzle.ts'
import type { LetterStrikeEncounter } from '../src/game/letterStrike.ts'
import { certifyOpeningSafety } from '../src/generator/openingSafety.ts'
import type { OpeningSafetyReport, OpeningSafetyScope } from '../src/generator/openingSafety.ts'
import { getWordCommonness, localLexicalProvider } from '../src/generator/lexicalProvider.ts'

const args = process.argv.slice(2)
const argument = (name: string, fallback?: string) => {
  const index = args.indexOf(`--${name}`)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value.`)
  return value
}
const number = (name: string, fallback: number, minimum = 0) => {
  const value = Number(argument(name, String(fallback)))
  if (!Number.isFinite(value) || value < minimum) throw new Error(`--${name} must be a number >= ${minimum}.`)
  return value
}
if (args.includes('--help')) {
  console.log('node scripts/certify-opening-safety.ts [--input candidate.json | --date YYYY-MM-DD] --out report.json')
  console.log('[--scope all-damaging-openings|all-valid-openings] [--common-openings | --words WORD,WORD] [--minimum-commonness 0.5] [--allow-obscure]')
  console.log('[--successors 100] [--seconds 30] [--states 100] [--beam 12] [--moves 64] [--selections 800] [--resume checkpoint.json] [--witnesses report.json] [--checkpoint checkpoint.json] [--checkpoint-every 10] [--stop-on-unsafe]')
  console.log('Every physical opening choice in the declared word scope is enumerated. Unknown continuations fail certification. Time limits apply cooperatively after root enumeration.')
  process.exit(0)
}
const flags = new Set(['--common-openings', '--allow-obscure', '--stop-on-unsafe'])
const values = new Set(['--input', '--date', '--out', '--scope', '--words', '--minimum-commonness', '--successors', '--seconds', '--states', '--beam', '--moves', '--selections', '--resume', '--witnesses', '--checkpoint', '--checkpoint-every'])
for (let index = 0; index < args.length; index++) {
  if (flags.has(args[index])) continue
  if (values.has(args[index])) { index++; continue }
  throw new Error(`Unknown argument: ${args[index]}`)
}
const inputPath = argument('input')
if (inputPath && argument('date')) throw new Error('Choose --input or --date, not both.')
let encounter: LetterStrikeEncounter
if (inputPath) {
  const input = JSON.parse(readFileSync(resolve(inputPath), 'utf8'))
  encounter = input.candidate?.encounter ?? input.encounter ?? input
  if (!encounter.startingTiles) throw new Error('--input needs one ranked candidate, candidate or encounter object.')
} else encounter = getDailyPuzzle(argument('date', getDailyPuzzleId())!).encounter
const scope = argument('scope', 'all-damaging-openings') as OpeningSafetyScope
if (!['all-damaging-openings', 'all-valid-openings'].includes(scope)) throw new Error('Unsupported opening scope.')
const minimum = number('minimum-commonness', 0.5)
const words = argument('words')
if (words && args.includes('--common-openings')) throw new Error('Choose --words or --common-openings, not both.')
const openingVocabulary = words?.split(',') ?? (args.includes('--common-openings')
  ? localLexicalProvider.vocabulary().filter(entry => (getWordCommonness(entry.word) ?? -1) >= minimum).map(entry => entry.word)
  : undefined)
const resumePath = argument('resume')
const resume: OpeningSafetyReport | undefined = resumePath ? JSON.parse(readFileSync(resolve(resumePath), 'utf8')) : undefined
const witnessPath = argument('witnesses')
const witnesses: OpeningSafetyReport | undefined = witnessPath ? JSON.parse(readFileSync(resolve(witnessPath), 'utf8')) : undefined
const output = argument('out')
const checkpoint = argument('checkpoint', output)
const save = (path: string, report: OpeningSafetyReport) => {
  const absolute = resolve(path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(`${absolute}.tmp`, `${JSON.stringify(report, null, 2)}\n`)
  renameSync(`${absolute}.tmp`, absolute)
}
let lastProgress = ''
const report = certifyOpeningSafety(encounter, {
  scope, openingVocabulary, minimumCommonness: minimum,
  requireFamiliarContinuation: !args.includes('--allow-obscure'),
  maxSuccessors: number('successors', 100), maxDurationMs: number('seconds', 30) * 1000,
  solver: { maxStates: number('states', 100), beamWidth: number('beam', 12, 1),
    maxMovesPerState: number('moves', 64), maxSelectionsPerState: number('selections', 800) },
  resume, checkpointEvery: number('checkpoint-every', 10, 1), stopOnUnsafe: args.includes('--stop-on-unsafe'),
  witnessLines: witnesses?.results.filter(result => result.status === 'safe').map(result => result.continuation ?? []),
  onCheckpoint(value) {
    if (checkpoint) save(checkpoint, value)
    const progress = `${value.safeSelections} safe / ${value.unsafeSelections} unsafe / ${value.unknownSelections} unknown physical openings; ${value.work.invocationSuccessorsSearched} successors searched.`
    if (progress !== lastProgress) { process.stderr.write(`${progress}\n`); lastProgress = progress }
  },
})
if (output) save(output, report)
else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
process.stderr.write(`${report.status.toUpperCase()}: ${report.scope}, ${report.openingVocabulary.scope}; ${report.work.stoppedBy}; ${report.work.elapsedMs}ms.\n`)
