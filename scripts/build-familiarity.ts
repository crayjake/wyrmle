/** Build once at authoring time; neither corpus lookup nor Python ships in gameplay. */
import { createHash } from 'node:crypto'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getDefinedDictionaryWords, MEANING_DICTIONARY_VERSION } from '../src/lexicon/meaningDictionary.ts'

const python = process.argv[2]
if (!python) throw new Error('Usage: node scripts/build-familiarity.ts /tmp/wordfreq-venv/bin/python [OUTPUT.json]')
const output = process.argv[3] ?? fileURLToPath(new URL('../src/generator/data/familiarity-v1.json', import.meta.url))
const words = [...getDefinedDictionaryWords()].sort()
const dictionaryDigest = createHash('sha256').update(`${words.join('\n')}\n`).digest('hex')
const temporary = mkdtempSync(join(tmpdir(), 'wyrmle-wordfreq-'))
const inputPath = join(temporary, 'words.json')
const resultPath = join(temporary, 'frequencies.json')
writeFileSync(inputPath, JSON.stringify({ words, dictionaryVersion: MEANING_DICTIONARY_VERSION, dictionaryDigest }))
const inputFd = openSync(inputPath, 'r')
const outputFd = openSync(resultPath, 'w')
let bytes: string
try {
  // File descriptors avoid large synchronous subprocess-pipe backpressure.
  const result = spawnSync(python, [fileURLToPath(new URL('./familiarity/export.py', import.meta.url))], {
    stdio: [inputFd, outputFd, 'pipe'], encoding: 'utf8', timeout: 60_000,
  })
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Familiarity export failed.')
  bytes = readFileSync(resultPath, 'utf8')
} finally {
  closeSync(inputFd)
  closeSync(outputFd)
  rmSync(temporary, { recursive: true, force: true })
}
const generated = JSON.parse(bytes)
writeFileSync(output, bytes)
process.stdout.write(`${JSON.stringify({ ...generated.counts, dictionaryDigest,
  bytes: Buffer.byteLength(bytes), sha256: createHash('sha256').update(readFileSync(output)).digest('hex') }, null, 2)}\n`)
