/** Freshly replay archived witnesses and complete a model-era opening certificate. */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import type { LetterStrikeState, LetterStrikeTile } from '../src/game/letterStrike.ts'
import { getEncounterPartsOfSpeech } from '../src/game/lexicalRules.ts'
import { hasImpossibleLetterSupply } from '../src/generator/analyse.ts'
import { discoverValidMoves, moveSummary } from '../src/generator/findMoves.ts'
import type { SolverMoveSummary } from '../src/generator/findMoves.ts'
import { getGenerationFamiliarVocabulary, getGenerationWordCommonness, GENERATION_COMMONNESS_SOURCE } from '../src/generator/familiarity.ts'
import { assertMeaningPublicationReady, meaningLexicalProvider, withCompiledMeanings } from '../src/generator/meaningCompiler.ts'
import { certifyOpeningSafety } from '../src/generator/openingSafety.ts'
import type { OpeningSafetyReport } from '../src/generator/openingSafety.ts'
import type { CandidatePuzzle } from '../src/generator/types.ts'

const [inputPath, witnessPath, directory, ...args] = process.argv.slice(2)
if (!inputPath || !witnessPath || !directory || inputPath === '--help') {
  console.log('node scripts/prepare-assessed-openings.ts CANDIDATE.json OLD_PROOF.json OUTPUT_DIRECTORY [--states 500] [--seconds 600]')
  process.exit(inputPath === '--help' ? 0 : 1)
}
const limits = { states: 500, seconds: 600 }
for (let index = 0; index < args.length; index += 2) {
  const key = args[index].slice(2) as keyof typeof limits
  const value = Number(args[index + 1])
  if (!args[index].startsWith('--') || !Object.hasOwn(limits, key) || !Number.isFinite(value) || value < 0
    || (key === 'states' && !Number.isSafeInteger(value))) throw new Error('Invalid witness-search limit.')
  limits[key] = value
}
const readJson = (path: string) => {
  const bytes = readFileSync(path)
  return JSON.parse((bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString('utf8'))
}
const input = readJson(inputPath)
const supplied = (input.candidate ?? input) as CandidatePuzzle
const candidate: CandidatePuzzle = { ...supplied, encounter: withCompiledMeanings(supplied.encounter),
  provenance: { ...supplied.provenance, lexicalProvider: meaningLexicalProvider.id } }
assertMeaningPublicationReady(candidate.encounter)
mkdirSync(directory, { recursive: true })
writeFileSync(join(directory, 'candidate.json'), JSON.stringify(candidate) + '\n')
const old = readJson(witnessPath) as OpeningSafetyReport
const vocabulary = getGenerationFamiliarVocabulary().filter(word => candidate.encounter.meaningLexicon!.words[word])
const commonness = (word: string) => getGenerationWordCommonness(word) ?? 0
const options = { scope: 'all-valid-openings' as const, requireFamiliarContinuation: true, minimumCommonness: 0.5,
  wordCommonness: getGenerationWordCommonness, commonnessSource: GENERATION_COMMONNESS_SOURCE,
  familiarVocabulary: vocabulary, maxSuccessors: 0, maxDurationMs: 0 }
const report = certifyOpeningSafety(candidate, options)
const initial = createLetterStrikeGame(candidate.encounter)
type Witness = { moves: SolverMoveSummary[]; resolve: number }
type TypedMove = { word: string; tokens: string[] }
const token = (tile: LetterStrikeTile) => `${tile.letter}:${tile.type}:${tile.gem ?? ''}`
// This key is used only to suggest routes. Every suggestion is replayed with
// real current IDs, and the ordinary certifier independently checks it again.
const suggestionKey = (state: LetterStrikeState) => JSON.stringify([state.status, state.playerResolve, state.refillIndex,
  state.tiles.map(token).sort(), state.enemyLetters.map(letter => [letter.hitsRemaining, letter.armourGained ?? false])])
const suggestions = new Map<string, TypedMove[]>()
function replay(state: LetterStrikeState, steps: readonly { word: string; tileIds?: readonly number[]; tokens?: readonly string[] }[]): Witness | null {
  const moves: SolverMoveSummary[] = []
  for (const step of steps) {
    if (state.status === 'won') break
    if (state.status !== 'playing' || commonness(step.word) < 0.5) return null
    const used = new Set<number>()
    const ids = step.tileIds ? [...step.tileIds] : step.tokens!.map(value => {
      const tile = state.tiles.find(item => !used.has(item.id) && token(item) === value)
      if (!tile) return -1
      used.add(tile.id)
      return tile.id
    })
    if (ids.includes(-1)) return null
    const next = submitLetterStrike(state, ids)
    if (next.error || next.playedWords.length !== state.playedWords.length + 1 || next.playedWords.at(-1)!.word !== step.word) return null
    const preview = next.playedWords.at(-1)!.preview
    moves.push({ word: preview.word, tileIds: ids, semanticLabel: preview.semanticLabel,
      partsOfSpeech: getEncounterPartsOfSpeech(state.encounter, preview.word) ?? [],
      grammarModifier: preview.grammaticalModifier, longWordModifier: preview.longWordModifier,
      wardUsed: preview.resolveCost === 0, strikeUsed: preview.effectLabels.includes('STRIKE'),
      ...(preview.effectLabels.includes('REGEN') ? { regenUsed: true as const, recoveries: preview.recoveries ?? [] } : {}),
      strikes: preview.strikes, resolveCost: preview.resolveCost, hits: preview.hits, letterOutcomes: preview.letterOutcomes })
    state = next
  }
  return state.status === 'won' ? { moves, resolve: state.playerResolve } : null
}
function remember(state: LetterStrikeState, moves: readonly SolverMoveSummary[]) {
  const positions: string[] = [], typed: TypedMove[] = []
  for (const move of moves) {
    positions.push(suggestionKey(state))
    typed.push({ word: move.word, tokens: move.tileIds.map(id => token(state.tiles.find(tile => tile.id === id)!)) })
    state = submitLetterStrike(state, move.tileIds)
    if (state.error) throw new Error('Only replayed winning witnesses may be remembered.')
  }
  if (state.status !== 'won') throw new Error('A suggested route must end in victory.')
  for (const [index, key] of positions.entries()) {
    const route = typed.slice(index)
    if (!suggestions.has(key) || suggestions.get(key)!.length > route.length) suggestions.set(key, route)
  }
}
const openingKey = (word: string, ids: readonly number[]) => `${word}:${ids.join(',')}`
const oldRoutes = new Map<string, SolverMoveSummary[]>()
for (const result of old.results) if (result.status === 'safe' && result.continuation) {
  for (const opening of result.openings) oldRoutes.set(openingKey(opening.word, opening.tileIds), result.continuation)
}
function accept(result: OpeningSafetyReport['results'][number], state: LetterStrikeState, witness: Witness) {
  result.status = 'safe'; result.evidence = 'winning-witness'; result.continuation = witness.moves
  result.resolveRemaining = witness.resolve; result.cutoffReasons = []
  remember(state, witness.moves)
}
for (const result of report.results) {
  if (result.status !== 'unknown') continue
  const opening = result.openings[0], state = submitLetterStrike(initial, opening.tileIds)
  for (const entry of result.openings) {
    const route = oldRoutes.get(openingKey(entry.word, entry.tileIds))
    const witness = route ? replay(state, route) : null
    if (witness) { accept(result, state, witness); break }
  }
}
const progress = () => ({ safe: report.results.filter(result => result.status === 'safe').reduce((sum, result) => sum + result.openings.length, 0),
  unsafe: report.results.filter(result => result.status === 'unsafe').reduce((sum, result) => sum + result.openings.length, 0),
  unknown: report.results.filter(result => result.status === 'unknown').reduce((sum, result) => sum + result.openings.length, 0) })
function saveVerifiedCheckpoint() {
  // Checkpoints can be supplied as OLD_PROOF on the next invocation. They get
  // fresh headers and an independent engine replay before being written.
  const verified = certifyOpeningSafety(candidate, { ...options, resume: report })
  verified.notes.push(`External bounded first-win witness search: at most ${limits.states} states per successor and ${limits.seconds} seconds; no failed search is an impossibility claim.`)
  const output = join(directory, 'opening-safety.json')
  writeFileSync(`${output}.tmp`, JSON.stringify(verified) + '\n')
  renameSync(`${output}.tmp`, output)
  return verified
}
console.log(JSON.stringify({ event: 'fresh-witness-replay', ...progress() }))
saveVerifiedCheckpoint()
const started = performance.now()
let lastCheckpoint = started
if (report.unsafeSelections === 0) for (const result of report.results) {
  if (result.status !== 'unknown') continue
  if (performance.now() - started >= limits.seconds * 1000) break
  const state = submitLetterStrike(initial, result.openings[0].tileIds)
  let explored = 0
  const visited = new Set<string>()
  function visit(current: LetterStrikeState): Witness | null {
    if (current.status === 'won') return { moves: [], resolve: current.playerResolve }
    if (current.status !== 'playing' || hasImpossibleLetterSupply(current)) return null
    if (explored >= limits.states || performance.now() - started >= limits.seconds * 1000) return null
    const key = suggestionKey(current), suggested = suggestions.get(key)
    const remembered = suggested ? replay(current, suggested) : null
    if (remembered) return remembered
    if (visited.has(key)) return null
    visited.add(key); explored++
    const moves = discoverValidMoves(current, { vocabulary, wordCommonness: commonness, maxMoves: 180, maxSelections: 2200 }).moves
    const children = new Set<string>()
    for (const move of moves) {
      const child = suggestionKey(move.resultingState)
      if (children.has(child)) continue
      children.add(child)
      const tail = visit(move.resultingState)
      if (tail) {
        const witness = { moves: [moveSummary(move), ...tail.moves], resolve: tail.resolve }
        remember(current, witness.moves)
        return witness
      }
    }
    return null
  }
  const witness = visit(state)
  result.attempts++; result.solverStatesExplored += explored
  if (witness) accept(result, state, witness)
  console.log(JSON.stringify({ event: 'bounded-witness-search', opening: result.openings[0].word, states: explored, won: !!witness, ...progress() }))
  if (performance.now() - lastCheckpoint >= 60_000) {
    saveVerifiedCheckpoint()
    lastCheckpoint = performance.now()
  }
}
// These are fresh proof headers. Archived hashes, labels, hit counts and loss
// claims are never reused; the normal certifier replays only actual witnesses.
const normalized = saveVerifiedCheckpoint()
console.log(JSON.stringify({ event: 'opening-certificate', status: normalized.status, safe: normalized.safeSelections,
  unsafe: normalized.unsafeSelections, unknown: normalized.unknownSelections }))
if (!normalized.certified) process.exitCode = 2
