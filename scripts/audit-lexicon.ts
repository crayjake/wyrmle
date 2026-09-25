import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { getDailyPuzzleId } from '../src/daily/date.ts'
import { getDailyPuzzle, getSupportedDailyPuzzles } from '../src/daily/puzzle.ts'
import { auditEncounterLexicon } from '../src/generator/lexicalAudit.ts'

const args = process.argv.slice(2)
const option = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value.`)
  return value
}
if (args.includes('--help')) {
  console.log('node scripts/audit-lexicon.ts [--date YYYY-MM-DD] [--puzzle-version N] [--out path.json] [--summary]')
  console.log('Audits every dictionary spelling on the opening board and in the full refill-supply superset. The superset is not a claim of reachable boards.')
  console.log('Defaults to the current UTC daily and full per-spelling entries. --summary omits entries. JSON goes to stdout unless --out is provided.')
  process.exit(0)
}
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--summary') continue
  if (['--date', '--puzzle-version', '--out'].includes(args[index])) { index++; continue }
  throw new Error(`Unknown argument: ${args[index]}`)
}
const date = option('date') ?? getDailyPuzzleId()
const version = option('puzzle-version')
if (version !== undefined && (!/^\d+$/.test(version) || !Number.isSafeInteger(Number(version)))) {
  throw new Error('--puzzle-version needs a supported integer version.')
}
const puzzle = version === undefined ? getDailyPuzzle(date)
  : getSupportedDailyPuzzles(date).find(item => item.puzzleVersion === Number(version))
if (!puzzle) throw new Error(`Puzzle version ${version} is not supported on ${date}.`)
const audit = auditEncounterLexicon(puzzle.encounter, { includeEntries: !args.includes('--summary') })
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const report = {
  format: 'wyrmle-lexical-audit-v1', puzzleId: puzzle.puzzleId,
  gameVersion: puzzle.gameVersion, puzzleVersion: puzzle.puzzleVersion,
  encounterSha256: sha256(puzzle.encounter), auditSha256: sha256(audit), audit,
}
const json = `${JSON.stringify(report, null, 2)}\n`
const output = option('out')
if (output) {
  const path = resolve(output)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, json)
  console.log(`${path}: ${audit.opening.words} opening spellings; ${audit.supply.words} full-supply spellings; ${audit.supply.unknownPartOfSpeechWords} unknown POS; ${audit.supply.semanticFallbackWords} unlisted semantics.`)
} else process.stdout.write(json)
