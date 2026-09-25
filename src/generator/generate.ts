import { normalizeWord } from '../game/dictionary.ts'
import type { LetterStrikeEncounter } from '../game/letterStrike.ts'
import { analysePuzzle } from './analyse.ts'
import type { AnalysisOptions, PuzzleAnalysis } from './analyse.ts'
import { constructBoard, overlappingLetters } from './constructBoard.ts'
import { constructRefill } from './constructRefill.ts'
import { difficultyFromAnalysis } from './difficulty.ts'
import type { PuzzleDifficultyAnalysis } from './difficulty.ts'
import { analyseEnemySuitability } from './enemySuitability.ts'
import type { EnemySuitability } from './enemySuitability.ts'
import { selectEnemy } from './enemySelector.ts'
import { chooseGenerationGoal } from './generationGoals.ts'
import { currentLexicalProvider, localLexicalProvider } from './lexicalProvider.ts'
import { currentLexicalRules, enrichSemanticRelations } from '../game/lexicalRules.ts'
import type { LexicalEntry, LexicalProvider } from './lexicalProvider.ts'
import { mutateCandidate } from './mutate.ts'
import { placeArmour } from './placeArmour.ts'
import { placeSpecialTiles } from './placeSpecialTiles.ts'
import { createRandom } from './random.ts'
import { validateRefillLimit } from './refillLimit.ts'
import { scorePuzzle } from './score.ts'
import { validatePuzzle } from './validate.ts'
import type { ValidationConfig } from './config.ts'
import type { AnchorWord, CandidatePuzzle, GenerationGoal, WordRole } from './types.ts'
import { buildWordPools } from './wordPools.ts'
import { meaningLexicalProvider, withCompiledMeanings } from './meaningCompiler.ts'

export type GenerationOptions = {
  candidateCount?: number
  keep?: number
  refinementRounds?: number
  mutationsPerRound?: number
  refinementBeamWidth?: number
  allowResolveMutation?: boolean
  startingResolve?: number
  /** Opt-in preserves historical seed output and published daily snapshots. */
  includeRegenTile?: boolean
  /** Opt-in finite replacement supply; refinement may change its length. */
  refillLimit?: number
  /** Only archival reproduction opts out of the complete, versioned lookup. */
  lexicalMode?: 'current' | 'legacy'
  /** Only archival generation retains adjective and long-word bonuses. */
  scoringMode?: 'meaning' | 'legacy-bonuses'
  goal?: GenerationGoal
  provider?: LexicalProvider
  analysis?: AnalysisOptions
  validation?: Partial<ValidationConfig>
  onProgress?: (progress: { attempted: number; accepted: number; enemyWord: string }) => void
}
export type RankedCandidate = {
  candidate: CandidatePuzzle
  analysis: PuzzleAnalysis
  validation: ReturnType<typeof validatePuzzle>
  quality: ReturnType<typeof scorePuzzle>
  /** Unsolved candidates and archived review artifacts may omit a rating. */
  difficulty?: PuzzleDifficultyAnalysis
}
export type GenerationResult = {
  seed: string
  enemyWord: string | null
  enemySuitability: EnemySuitability
  enemyRejections: EnemySuitability[]
  attempted: number
  solvable: number
  acceptedCount: number
  accepted: RankedCandidate[]
  ranked: RankedCandidate[]
  rejectionCounts: Record<string, number>
}

export function createCandidate(enemyWord: string, seed: string | number, options: GenerationOptions = {}): CandidatePuzzle {
  const meaningOnly = options.lexicalMode !== 'legacy' && options.scoringMode !== 'legacy-bonuses'
  const refillLimit = validateRefillLimit(options.refillLimit)
  const enemy = normalizeWord(enemyWord)
  const provider = options.provider ?? (meaningOnly ? meaningLexicalProvider : options.lexicalMode === 'legacy' ? localLexicalProvider : currentLexicalProvider)
  const suitability = analyseEnemySuitability(enemy, provider)
  if (!suitability.eligible) throw new Error(suitability.rejectionReasons.join(' '))
  const entry = provider.getEntry(enemy)!
  const pools = buildWordPools(enemy, provider, { grammarPolicy: options.lexicalMode === 'legacy' ? 'single' : 'any-recognized' })
  const random = createRandom(seed)
  const goal = options.goal ?? chooseGenerationGoal(random)
  const currentGoal = meaningOnly && goal.archetypes.includes('grammar-twist') ? {
    ...goal, archetypes: [...new Set(goal.archetypes.map(type => type === 'grammar-twist' ? 'semantic-contrast' as const : type))],
    description: 'Meaning and Hit tiles offer different ways through resisted words.',
  } : goal
  const anchors: AnchorWord[] = []
  function addAnchor(pool: readonly LexicalEntry[], role: WordRole, maxLength = 9) {
    const compatible = pool.filter(entry => entry.word.length <= maxLength
      && !anchors.some(anchor => anchor.word === entry.word)
      && overlappingLetters([...anchors.map(anchor => anchor.word), entry.word]).length <= 15)
    if (!compatible.length) return
    const selected = random.pick(compatible.slice(0, 16))
    const roles: WordRole[] = [role]
    if (!meaningOnly && pools.grammar.some(entry => entry.word === selected.word) && role !== 'grammar') roles.push('grammar')
    if (role === 'resisted') roles.push('decoy', 'strike')
    if (role === 'neutral') roles.push('ward')
    anchors.push({ word: selected.word, roles, expected: 'opening', commonness: selected.commonness })
  }
  addAnchor(pools.counters, 'counter', 7)
  addAnchor(pools.resisted, 'resisted', 7)
  if (meaningOnly) addAnchor(pools.counters, 'counter', 7)
  else addAnchor(pools.grammar.filter(entry => pools.neutral.includes(entry)), 'grammar', 7)
  addAnchor(pools.neutral, 'neutral', 6)
  const words = pools.all.map(entry => entry.word)
  const board = constructBoard(anchors.map(anchor => anchor.word), words, random)
  const startingTiles = placeSpecialTiles(board, enemy, pools.counters.map(entry => entry.word),
    anchors.filter(anchor => anchor.roles.includes('resisted')).map(anchor => anchor.word), random, options)
  const armourCount = goal.archetypes.includes('armour-break') ? 2 : 1
  const id = `generated-${enemy.toLowerCase()}-${meaningOnly ? 'meaning2-' : options.lexicalMode === 'legacy' ? '' : 'lex2-'}${encodeURIComponent(String(seed))}${refillLimit === undefined ? '' : `-finite${refillLimit}`}`
  const startingResolve = options.startingResolve ?? 5
  let encounter: LetterStrikeEncounter = {
    id, enemy: { word: enemy, definition: entry.definition, partOfSpeech: entry.partsOfSpeech[0],
      semanticRelations: meaningOnly || options.lexicalMode === 'legacy' ? pools.semanticRelations : enrichSemanticRelations(enemy, pools.semanticRelations) },
    enemyLetters: placeArmour(enemy, words, armourCount, random),
    startingResolve, startingTiles, refillQueue: 'E'.repeat((startingResolve + 1) * 16), minimumWordLength: 3,
    ...(refillLimit === undefined ? {} : { finiteRefills: true as const }),
    grammarModifiers: meaningOnly ? {} : { adjective: 1 }, wordPartsOfSpeech: pools.wordPartsOfSpeech,
    ...(options.lexicalMode === 'legacy' ? {} : { lexicalRules: { ...currentLexicalRules } }),
    ...(meaningOnly ? {} : { longWordRule: { minimumLength: 6, bonusStrikes: 1 } }),
    tileEffects: { strike: { strike: true, preventResolveLoss: false }, ward: { strike: false, preventResolveLoss: true },
      ...(options.includeRegenTile ? { regen: { strike: false, preventResolveLoss: false, regenerate: true } } : {}),
    },
  }
  const targetTurns = goal.archetypes.includes('clutch-finish') ? startingResolve + 1 : startingResolve
  const refill = constructRefill(encounter, pools.all, random, targetTurns, refillLimit)
  encounter.refillQueue = refill.refillQueue
  if (meaningOnly) encounter = withCompiledMeanings(encounter)
  for (const word of refill.construction.plannedWords) {
    if (anchors.some(anchor => anchor.word === word)) continue
    const roles: WordRole[] = pools.counters.some(entry => entry.word === word) ? ['counter'] : ['neutral']
    if (pools.clutch.some(entry => entry.word === word)) roles.push('clutch')
    if (!meaningOnly && pools.grammar.some(entry => entry.word === word)) roles.push('grammar')
    anchors.push({ word, roles, expected: 'refill', commonness: provider.getEntry(word)?.commonness ?? null })
  }
  return { id, seed: String(seed), enemyWord: enemy, encounter, goal: structuredClone(currentGoal), anchors,
    construction: refill.construction, provenance: { generatorVersion: meaningOnly ? 'letter-strike-generator-4' : options.lexicalMode === 'legacy' ? 'letter-strike-generator-1' : 'letter-strike-generator-2', lexicalProvider: provider.id } }
}

function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  return Number(b.validation.accepted) - Number(a.validation.accepted) || b.quality.total - a.quality.total
    || a.candidate.id.localeCompare(b.candidate.id)
}

/** Bounded deterministic hill climbing. Acceptance is always decided by analysis. */
export function generateForEnemy(enemyWord: string, seed: string | number, options: GenerationOptions = {}): GenerationResult {
  validateRefillLimit(options.refillLimit)
  const provider = options.provider ?? (options.lexicalMode === 'legacy' ? localLexicalProvider
    : options.scoringMode === 'legacy-bonuses' ? currentLexicalProvider : meaningLexicalProvider)
  const enemy = normalizeWord(enemyWord)
  const enemySuitability = analyseEnemySuitability(enemy, provider)
  const report: GenerationResult = { seed: String(seed), enemyWord: enemy, enemySuitability,
    enemyRejections: [], attempted: 0, solvable: 0, acceptedCount: 0, accepted: [], ranked: [], rejectionCounts: {} }
  if (!enemySuitability.eligible) { report.enemyRejections.push(enemySuitability); return report }
  function evaluate(candidate: CandidatePuzzle, proposedLine?: readonly (readonly number[])[]): RankedCandidate {
    const analysis = analysePuzzle(candidate, {
      ...options.analysis,
      wordCommonness: options.analysis?.wordCommonness ?? (word => provider.getEntry(word)?.commonness ?? null),
      solver: { ...options.analysis?.solver,
        // Parent routes are suggestions, replayed and validated on the mutation.
        // The solver never treats an inherited route as an inherited proof.
        hintLine: proposedLine ?? (candidate.construction.plannedTileIds.length ? candidate.construction.plannedTileIds : options.analysis?.solver?.hintLine),
      },
    })
    const validation = validatePuzzle(candidate, analysis, options.validation)
    const quality = scorePuzzle(candidate, analysis)
    const ranked: RankedCandidate = { candidate, analysis, validation, quality,
      ...(analysis.bestWinDepth !== null ? { difficulty: difficultyFromAnalysis(candidate.encounter, analysis) } : {}),
    }
    report.attempted++
    report.solvable += Number(analysis.solvable === true)
    report.acceptedCount += Number(validation.accepted)
    for (const reason of validation.reasons) report.rejectionCounts[reason.code] = (report.rejectionCounts[reason.code] ?? 0) + 1
    report.ranked.push(ranked)
    options.onProgress?.({ attempted: report.attempted, accepted: report.acceptedCount, enemyWord: enemy })
    return ranked
  }
  for (let index = 0; index < (options.candidateCount ?? 8); index++) {
    evaluate(createCandidate(enemy, `${seed}:${index}`, options))
  }
  let beam = [...report.ranked].sort(compareCandidates).slice(0, options.refinementBeamWidth ?? 2)
  for (let generation = 0; generation < (options.refinementRounds ?? 1); generation++) {
    const neighbourhood = [...beam]
    for (const [parentIndex, parent] of beam.entries()) {
      for (let mutation = 0; mutation < (options.mutationsPerRound ?? 2); mutation++) {
        neighbourhood.push(evaluate(mutateCandidate(parent.candidate, `${seed}:g${generation}:p${parentIndex}:m${mutation}`, options),
          parent.analysis.winningLines[0]?.moves.map(move => move.tileIds)))
      }
    }
    beam = neighbourhood.sort(compareCandidates).slice(0, options.refinementBeamWidth ?? 2)
  }
  report.ranked.sort(compareCandidates)
  // Do not present identical encounters as five different puzzles.
  const seen = new Set<string>()
  report.accepted = report.ranked.filter(item => {
    if (!item.validation.accepted) return false
    const key = JSON.stringify([item.candidate.encounter.startingTiles, item.candidate.encounter.refillQueue,
      item.candidate.encounter.enemyLetters, item.candidate.encounter.startingResolve, item.candidate.encounter.finiteRefills])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, options.keep ?? 5)
  return report
}

/** Enemy screening precedes construction; the daily catalog is never modified. */
export function generatePuzzle(seed: string | number, options: GenerationOptions = {}): GenerationResult {
  validateRefillLimit(options.refillLimit)
  const provider = options.provider ?? (options.lexicalMode === 'legacy' ? localLexicalProvider
    : options.scoringMode === 'legacy-bonuses' ? currentLexicalProvider : meaningLexicalProvider)
  const selection = selectEnemy(seed, { provider })
  const eligible = selection.candidates.filter(entry => entry.eligible)
    .sort((a, b) => Number(b.word === selection.selected) - Number(a.word === selection.selected))
  const rejections = selection.rejected
  if (!eligible.length) {
    const result = generateForEnemy(provider.enemyWords()[0] ?? '', seed, options)
    return { ...result, enemyWord: null, enemyRejections: rejections }
  }
  // Try suitable concepts in seeded order if a concept produces no accepted board.
  let previous: GenerationResult | undefined
  for (const selected of eligible) {
    const attemptedOffset = previous?.attempted ?? 0
    const acceptedOffset = previous?.acceptedCount ?? 0
    const result = generateForEnemy(selected.word, `${seed}:${selected.word}`, {
      ...options,
      onProgress: options.onProgress ? progress => options.onProgress!({ ...progress,
        attempted: attemptedOffset + progress.attempted,
        accepted: acceptedOffset + progress.accepted,
      }) : undefined,
    })
    result.seed = String(seed)
    result.enemyRejections = rejections
    if (previous) {
      result.attempted += previous.attempted
      result.solvable += previous.solvable
      result.acceptedCount += previous.acceptedCount
      result.ranked.push(...previous.ranked)
      for (const [reason, count] of Object.entries(previous.rejectionCounts)) result.rejectionCounts[reason] = (result.rejectionCounts[reason] ?? 0) + count
      result.ranked.sort(compareCandidates)
    }
    // keep=0 suppresses returned review cards, not successful generation.
    if (result.acceptedCount > 0) return result
    previous = result
  }
  return previous!
}
