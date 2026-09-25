import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import savedMeaning from './data/meaning-review.json'
import { dailyEncounter20260925V11 } from '../daily/catalog.ts'
import type { GenerationResult, RankedCandidate } from './generate.ts'
import type { GeneratorProgress, GeneratorRequest, GeneratorResponse } from './workerMessages.ts'
import type { SolverMoveSummary } from './findMoves.ts'
import type { CandidatePuzzle } from './types.ts'
import './DevGenerator.css'
import { difficultyFromAnalysis } from './difficulty'
import { inspectPuzzleMeaning } from './inspectMeaning.ts'

type Props = { onPlay: (candidate: CandidatePuzzle) => void; onClose: () => void }
type ResultFilter = 'accepted' | 'all' | 'rejected'
// The review data omits the large meaning table: use the same frozen encounter
// that gameplay publishes, without shipping another copy in the DEV bundle.
const savedCandidates = [{ ...savedMeaning, candidate: {
  ...savedMeaning.candidate, encounter: dailyEncounter20260925V11,
} }] as unknown as RankedCandidate[]
// A playtest temporarily unmounts the browser. Keep this session's review queue
// and selection in module memory; daily/localStorage records are unrelated.
let reviewCache: {
  enemy: string; automatic: boolean; seed: string; count: number; includeRegenTile: boolean
  finiteRefills: boolean; refillLimit: number
  ranked: RankedCandidate[]; selectedId: string | null; filter: ResultFilter; result: GenerationResult | null
} = {
  enemy: 'CHAOS', automatic: false, seed: 'meaning-review', count: 8, includeRegenTile: true,
  finiteRefills: true, refillLimit: 20,
  ranked: savedCandidates.slice(0, 5), selectedId: savedCandidates[0]?.candidate.id ?? null,
  filter: 'accepted', result: null,
}
const percent = (value: number | null) => value === null ? 'Unknown' : `${Math.round(value * 100)}%`
const decimal = (value: number | null) => value === null ? 'Unknown' : value.toFixed(2)
const specialLabels = { ward: 'Life', strike: 'Hit', regen: 'Revive' }
const mechanicLabels = { semantic: 'Meaning', ward: 'Life', strike: 'Hit', regen: 'Revive', grammar: 'Word types', armour: 'Armour' }
const displayReviewText = (value: string) => value.replace(/\b(ward|heart|resolve|regen)\b/gi, word =>
  ({ ward: 'Life', heart: 'Life', resolve: 'lives', regen: 'Revive' })[word.toLowerCase()]!)

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>
}

function MoveList({ moves }: { moves: readonly SolverMoveSummary[] }) {
  return <ol className="generator-moves">{moves.map((move, index) => <li key={`${index}:${move.tileIds.join(',')}`}>
    <strong>{move.word}</strong><span>{move.semanticLabel} · {move.strikes} {move.strikes === 1 ? 'hit' : 'hits'} · {move.resolveCost} {move.resolveCost === 1 ? 'life' : 'lives'} spent</span>
    <span>{[move.wardUsed ? 'LIFE SAVED' : '', move.strikeUsed ? 'HIT TILE' : '', move.regenUsed ? 'REVIVE' : '', move.grammarModifier ? `Grammar ${move.grammarModifier > 0 ? '+' : ''}${move.grammarModifier}` : '', move.longWordModifier ? `LONG +${move.longWordModifier}` : ''].filter(Boolean).join(' · ')}</span>
    <small>Tile IDs: {move.tileIds.join(', ')}. Hits: {move.hits.map(hit => `${hit.letter} (${hit.enemyLetterId}, ${hit.hitsBefore}→${hit.hitsAfter})`).join('; ') || 'none'}.</small>
    {!!move.recoveries?.length && <small className="regen-warning">Recovery: {move.recoveries.map(hit => `${hit.letter} ${hit.hitsBefore}→${hit.hitsAfter}`).join('; ')}</small>}
  </li>)}</ol>
}

function CandidateReview({ ranked, onPlay }: { ranked: RankedCandidate; onPlay: Props['onPlay'] }) {
  const { candidate, analysis, validation, quality } = ranked
  const { encounter } = candidate
  const meanings = encounter.meaningLexicon
  const [meaningQuery, setMeaningQuery] = useState('')
  const inspection = inspectPuzzleMeaning(encounter, meaningQuery)
  const meaningCounts = meanings && Object.values(meanings.words).reduce((counts, word) => {
    counts[word.relation === 'opposite' ? 'counter' : word.relation === 'similar' ? 'resisted' : 'neutral']++
    return counts
  }, { counter: 0, neutral: 0, resisted: 0 })
  const difficulty = ranked.difficulty ?? (analysis.bestWinDepth === null ? null : difficultyFromAnalysis(encounter, analysis))
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(ranked, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${candidate.id}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <article className="generator-review" aria-label={`Review ${candidate.id}`}>
    <header className="generator-review-heading">
      <div><p className="generator-kicker">{displayReviewText(candidate.goal.archetypes.join(' · '))}</p><h3>{candidate.enemyWord}</h3>
        <p>{encounter.enemy.definition}</p><code>{candidate.seed}</code></div>
      <div className="generator-score"><strong>{quality.total.toFixed(1)}</strong><span>quality / 100</span></div>
    </header>
    <p className={validation.accepted ? 'generator-accepted' : 'generator-rejected'}>{validation.accepted ? 'Accepted for DEV review' : 'Rejected'} · {displayReviewText(candidate.goal.description)}</p>
    <p className="generator-note">{meanings ? 'Meaning-first rules · frozen definitions and classifications · no word-type or length bonuses'
      : 'Archived lexical rules · this saved candidate keeps its original vocabulary and configured bonuses'}</p>
    {difficulty && <details><summary>Puzzle difficulty: {difficulty.label}{difficulty.estimated ? ' (estimate)' : ''}</summary><pre>{JSON.stringify(difficulty, null, 2)}</pre></details>}
    <div className="generator-actions">
      <button type="button" className="generator-primary" onClick={() => onPlay(candidate)}>Play this puzzle</button>
      <button type="button" onClick={download}>Export JSON</button>
    </div>
    <div className="generator-layout">
      <section aria-label="Starting position">
        <h4>Starting board</h4>
        <div className="generator-board" role="img" aria-label={encounter.startingTiles.map(tile => `${tile.letter}${tile.gem ? ` ${specialLabels[tile.gem]}` : ''}`).join(', ')}>
          {encounter.startingTiles.map(tile => <div key={tile.id} className={`generator-tile${tile.gem ? ` generator-${tile.gem}` : ''}`}
            title={`${tile.letter} · tile ID ${tile.id}${tile.gem ? ` · ${specialLabels[tile.gem]}` : ' · normal'}`}>
            <span>{tile.letter}</span><small>#{tile.id}{tile.gem === 'ward' ? ' ▪ LIFE' : tile.gem === 'strike' ? ' ◆ HIT' : tile.gem === 'regen' ? ' + REVIVE' : ''}</small>
          </div>)}
        </div>
        <p className="generator-tile-legend">▪ Life saves a life. ◆ Hit guarantees a matching hit. {encounter.tileEffects.regen && '+ Revive restores a matching enemy letter or its armour.'}</p>
        <h4>Enemy letters &amp; armour</h4>
        <div className="generator-enemy">{encounter.enemyLetters.map((letter, index) => <span key={letter.id} className={letter.initialHits > 1 ? 'generator-armoured' : ''}
          title={`Position ${index + 1}: ${letter.letter}, ${letter.initialHits} hits`}>
          {letter.letter}<small>{letter.initialHits > 1 ? '2 hits' : '1 hit'}</small>
        </span>)}</div>
        <p>{encounter.startingResolve} starting lives{meanings ? ' · Meaning determines normal hits'
          : ` · ${Object.entries(encounter.grammarModifiers ?? {}).map(([part, amount]) => `${part} ${amount! > 0 ? '+' : ''}${amount} hit`).join(', ') || 'No word-type modifier'}`}
          {!meanings && encounter.longWordRule ? ` · LONG ${encounter.longWordRule.minimumLength}+ adds ${encounter.longWordRule.bonusStrikes}` : ''}</p>
      </section>
      <section aria-label="Analysis overview">
        <h4>Observed analysis</h4>
        <dl className="generator-metrics">
          <Metric label="Winning lines found">{analysis.winningLinesFound}</Metric>
          <Metric label="Best win depth">{analysis.bestWinDepth ?? 'None'}{analysis.minimumTurnsProven ? ' (minimum proved)' : ' (witness)'}</Metric>
          <Metric label="Best lives remaining">{analysis.maximumResolveRemaining ?? 'Unknown'}</Metric>
          <Metric label="Reasonable openings">{analysis.reasonableOpeningMoves}</Metric>
          <Metric label="Viable openings found">{analysis.viableOpeningMoves}</Metric>
          <Metric label="Winning strategies found">{analysis.numberOfDistinctWinningStrategies}</Metric>
          <Metric label="States explored">{analysis.statesExplored}</Metric>
          <Metric label="Search">{analysis.searchLimitReached ? 'Bounded / incomplete' : 'Complete'}</Metric>
          <Metric label="Counter / neutral / resisted">{percent(analysis.counterMoveUsage)} / {percent(analysis.neutralMoveUsage)} / {percent(analysis.resistedMoveUsage)}</Metric>
          <Metric label="Winning word familiarity">{percent(analysis.winningWordCommonness)}</Metric>
          <Metric label="Witness familiarity coverage">{percent(analysis.winningVocabularyCoverage)}</Metric>
          <Metric label="Least familiar, best witness">{analysis.requiredObscureWordScore === null ? 'Unknown' : percent(1 - analysis.requiredObscureWordScore)}</Metric>
          {encounter.finiteRefills && <Metric label="Finite refill tiles">{encounter.refillQueue.length}</Metric>}
          {analysis.refillPressure && <>
            <Metric label="Wins played on a reduced board">{analysis.refillPressure.winsOnReducedBoard} / {analysis.refillPressure.replayedWinningLines}</Metric>
            <Metric label="Wins played after reserve emptied">{analysis.refillPressure.winsAfterRefillsExhausted}</Metric>
            <Metric label="Fewest tiles before winning word">{analysis.refillPressure.minimumTilesBeforeWinningMove ?? 'Unknown'}</Metric>
          </>}
        </dl>
        <p className="generator-note">Winning counts are observed lower bounds. Familiarity is an authoring estimate; its source and coverage are recorded in the analysis notes.</p>
      </section>
    </div>
    {meanings && meaningCounts && <details>
      <summary>Frozen meaning coverage · {Object.keys(meanings.words).length.toLocaleString()} defined words</summary>
      <p>Every definition-backed spelling that fits the complete starting and refill supply is stored before solver search. The same table controls valid words, meaning classes, hit counts and exhausted-board detection. Words absent from it cannot be played.</p>
      <dl className="generator-metrics">
        <Metric label="Counters / neutral / resisted">{meaningCounts.counter} / {meaningCounts.neutral} / {meaningCounts.resisted}</Metric>
        <Metric label="Dictionary version">{meanings.dictionaryVersion}</Metric>
        <Metric label="Assessment version">{meanings.profileVersion}</Metric>
        {meanings.assessment && <Metric label="Base assessment">{meanings.assessment.modelId}</Metric>}
        {meanings.assessment?.refinement && <>
          <Metric label="Context model">{meanings.assessment.refinement.modelId}</Metric>
          <Metric label="Context review coverage">{meanings.assessment.refinement.reviewedWords} / {meanings.assessment.refinement.eligibleWords}</Metric>
        </>}
        <Metric label="Word lengths">{meanings.minimumWordLength}–{meanings.maximumWordLength}</Metric>
      </dl>
      <p>{meanings.assessment
        ? 'Every applicable source sense was assessed offline. Neutral means the stored evidence did not support a counter or reinforcing meaning under the versioned scoring policy.'
        : 'This archived table used reviewed profiles; unmatched words received a neutral classification.'}</p>
      <label>Inspect a word<input value={meaningQuery} onChange={event => setMeaningQuery(event.target.value)} placeholder="CHEERFUL" autoCapitalize="characters" spellCheck={false} maxLength={32} /></label>
      {inspection && <div role="status" aria-live="polite">{inspection.kind === 'stored' ? <>
        <p><strong>{inspection.word} · {inspection.meaning.relation === 'opposite' ? 'COUNTER' : inspection.meaning.relation === 'similar' ? 'RESISTED' : 'NEUTRAL'}</strong>: {inspection.meaning.definition}</p>
        {inspection.meaning.evidence === 'defined-neutral'
          ? <p><strong>No reviewed relation matched.</strong> This is the default neutral classification, not an individual review of every possible relationship.</p>
          : <p>{inspection.meaning.reason}</p>}
        <p className="generator-note">{inspection.meaning.source} · {inspection.meaning.senseId} · {inspection.meaning.evidence}</p>
        {inspection.meaning.assessment && <p className="generator-note">
          {inspection.meaning.assessment.sensesEvaluated} senses assessed · decision: {inspection.meaning.assessment.decisionBasis ?? 'model'} · base NLI counter {inspection.meaning.assessment.counterScore.toFixed(3)} · base NLI resisted {inspection.meaning.assessment.resistedScore.toFixed(3)} · base anchor: {inspection.meaning.assessment.selectedAnchor}
        </p>}
      </> : <>
        <p><strong>{inspection.word}</strong>: {inspection.message}</p>
        {inspection.kind !== 'undefined' && <><p>{inspection.meaning.definition}</p>
          <p className="generator-note">{inspection.meaning.source} · {inspection.meaning.senseId}</p></>}
      </>}</div>}
    </details>}
    {analysis.lexicalAudit && <details>
      <summary>Dictionary classification audit · {analysis.lexicalAudit.opening.words.toLocaleString()} opening words</summary>
      <p>{meanings ? 'This audit independently checks the full definition-backed vocabulary against the frozen puzzle table, before bounded search.'
        : 'Every spellable dictionary word is annotated before bounded search. In these archived rules, unknown means the source cannot classify it; unlisted meaning uses neutral gameplay without claiming unrelated meaning.'}</p>
      <dl className="generator-metrics">
        <Metric label="Dictionary version">{analysis.lexicalAudit.dictionary.version}</Metric>
        {meanings ? <Metric label="Opening stored meanings">{analysis.lexicalAudit.opening.semanticSources.compiled ?? 0} / {analysis.lexicalAudit.opening.words}</Metric> : <>
          <Metric label="Opening POS known">{analysis.lexicalAudit.opening.words - analysis.lexicalAudit.opening.unknownPartOfSpeechWords} / {analysis.lexicalAudit.opening.words}</Metric>
          <Metric label="Opening POS unknown">{analysis.lexicalAudit.opening.unknownPartOfSpeechWords}</Metric>
          <Metric label="Opening semantic fallback">{analysis.lexicalAudit.opening.semanticFallbackWords}</Metric>
        </>}
        <Metric label="Supply spelling superset">{analysis.lexicalAudit.supply.words}</Metric>
      </dl>
      <p>The supply superset includes possible spellings from the whole refill supply, not proof that every spelling is reachable on a future board.</p>
      <p>Full word-by-word export: <code>npm run audit-lexicon -- --date YYYY-MM-DD --out audit.json</code></p>
    </details>}
    {analysis.openingSafety && <details>
      <summary>Opening recovery certificate · {analysis.openingSafety.safeSelections} safe / {analysis.openingSafety.enumeration.requiredSelections}</summary>
      <p>{analysis.openingSafety.scope} · {analysis.openingSafety.openingVocabulary.scope}. {analysis.openingSafety.unknownSelections} unknown; {analysis.openingSafety.unsafeSelections} proved unsafe. Each safe choice has a replayed winning continuation.</p>
      <p>A restricted spelling certificate covers only its listed words, including every physical tile choice. It does not certify the whole dictionary.</p>
    </details>}
    <section aria-label="Fairness and suspense">
      <h4>Reasonable play &amp; late suspense</h4>
      <dl className="generator-metrics generator-metrics-wide">
        <Metric label="Premature dead states, assessed">{percent(analysis.prematureDeadStateRate)}</Metric>
        <Metric label="Full sample possible range">{percent(analysis.fairness.prematureDeadStateRateLowerBound)} – {percent(analysis.fairness.prematureDeadStateRateUpperBound)}</Metric>
        <Metric label="Reasonable states assessed">{analysis.fairness.provenDeadStates + analysis.fairness.provenWinningStates} / {analysis.fairness.reasonableStates}</Metric>
        <Metric label="Reasonable states unknown">{analysis.fairness.unknownStates}</Metric>
        <Metric label="Final-life rescue rate, assessed">{percent(analysis.penultimateRescueRate)}</Metric>
        <Metric label="Final states unknown">{analysis.fairness.finalStatesUnknown} / {analysis.fairness.finalResolveStates}</Metric>
        <Metric label="Clutch positions / winning moves">{analysis.clutchOpportunityCount} / {analysis.clutchWinningMoves}</Metric>
        <Metric label="Clutch familiarity / mean length">{percent(analysis.clutchWordCommonness)} / {analysis.clutchWordLength?.toFixed(1) ?? 'Unknown'}</Metric>
      </dl>
      <p className="generator-note">Fairness samples useful moves. Unexplored states remain unknown; a low measured loss rate does not establish safety for the whole puzzle.</p>
    </section>
    <section aria-label="Mechanic importance">
      <h4>Mechanic comparisons</h4>
      <div className="generator-table-wrap"><table><thead><tr><th>Disabled mechanic</th><th>Importance</th><th>Changed replay outcomes</th><th>Best alternate win</th><th>Evidence</th></tr></thead>
        <tbody>{analysis.counterfactuals.map(item => <tr key={item.mechanic}><th>{mechanicLabels[item.mechanic]}</th><td>{decimal(item.importance)}</td>
          <td>{item.changedWinningOutcomes} / {item.replayedWinningLines}</td><td>{item.withoutBestWinDepth === null ? item.withoutStatus : `${item.withoutBestWinDepth} turns`}</td>
          <td>{item.evidence}{item.withoutSearchComplete ? ' (complete)' : ''}</td></tr>)}</tbody></table></div>
      {analysis.specialTileDecisions && <details><summary>Special-tile preservation and timing</summary>
        {(['ward', 'strike'] as const).map(gem => {
          const decision = analysis.specialTileDecisions[gem]
          return <p key={gem}><strong>{gem === 'ward' ? 'LIFE' : 'HIT'}</strong>: {decision.reasonableOpeningWordsUsing} reasonable opening words use it;
            {' '}{decision.reasonableOpeningWordsPreserving} preserve it. Observed winning use turns: {decision.winningUseTurns.join(', ') || 'none'}.
            {' '}Automatic among reasonable openings: {decision.automaticInReasonableOpenings === null ? 'unknown (bounded discovery)' : decision.automaticInReasonableOpenings ? 'yes' : 'no'}.</p>
        })}
      </details>}
    </section>
    <details open={!validation.accepted}>
      <summary>Acceptance reasons &amp; caveats ({validation.reasons.length} rejections, {validation.warnings.length} notes)</summary>
      {validation.accepted && <p>All current DEV review gates passed.</p>}
      {validation.reasons.length > 0 && <ul className="generator-rejected">{validation.reasons.map(reason => <li key={reason.code}>{displayReviewText(reason.message)}</li>)}</ul>}
      {validation.warnings.length > 0 && <ul>{validation.warnings.map(warning => <li key={warning.code}>{displayReviewText(warning.message)}</li>)}</ul>}
    </details>
    <details><summary>Refill queue &amp; construction</summary>
      <p>Read left to right; consumed board positions refill in board order.</p><code className="generator-queue">{encounter.refillQueue.match(/.{1,16}/g)?.join(' ')}</code>
      <ul>{candidate.construction.refillBlocks.map((block, index) => <li key={index}>Offset {block.offset}: <code>{block.letters}</code> supports <strong>{block.supports}</strong></li>)}</ul>
      <p>{candidate.construction.mutations.length ? `Refinements: ${candidate.construction.mutations.join('; ')}` : 'Original generated candidate.'}</p>
      {candidate.construction.mutations.length > 0 && <p>The blocks above describe the original construction plan. The displayed queue is the current mutated queue; winning lines below are replayed against it.</p>}
    </details>
    <details><summary>{meanings ? 'Semantic anchors and stored groups · spoilers' : 'Semantic anchors & grammar annotations · spoilers'}</summary>
      <div className="generator-table-wrap"><table><thead><tr><th>Anchor</th><th>Role</th><th>Expected</th><th>Familiarity</th></tr></thead><tbody>
        {candidate.anchors.map(anchor => <tr key={anchor.word}><th>{anchor.word}</th><td>{displayReviewText(anchor.roles.join(', '))}</td><td>{anchor.expected}</td><td>{percent(anchor.commonness)}</td></tr>)}
      </tbody></table></div>
      <p><strong>Counters:</strong> {encounter.enemy.semanticRelations.opposite.join(', ')}</p>
      <p><strong>Resisted:</strong> {encounter.enemy.semanticRelations.similar.join(', ')}</p>
      <p><strong>Related (neutral):</strong> {encounter.enemy.semanticRelations.related.join(', ')}</p>
      {!meanings && <details><summary>Explicit part-of-speech annotations</summary><pre>{JSON.stringify(encounter.wordPartsOfSpeech, null, 2)}</pre></details>}
    </details>
    <details><summary>Winning lines ({analysis.winningLines.length}) · spoilers</summary>
      <p>Immediate choice: {analysis.strongestImmediateMove ?? 'Unknown'}. Best observed strategic opening: {analysis.optimalStrategicMove ?? 'Unknown'}.</p>
      {analysis.winningLines.map((line, index) => <details key={index}><summary>Line {index + 1}: {line.turns} turns, {line.resolveRemaining} lives remaining</summary><MoveList moves={line.moves} /></details>)}
      {!analysis.winningLines.length && <p>No winning witness found.</p>}
    </details>
    <details><summary>Clutch / rescue lines ({analysis.clutchLines.length}) · spoilers</summary>
      {analysis.clutchLines.map((line, index) => <details key={index}><summary>Rescue {index + 1}: 1 life, remaining {line.remainingLetters} · {line.winningMoves.length} winning move(s)</summary>
        {line.prefix.length > 0 && <><h4>Reach this position</h4><MoveList moves={line.prefix} /></>}
        <h4>Winning continuations</h4><MoveList moves={line.winningMoves} />
        <p>Familiarity {percent(line.commonness)} · Difficulty estimate {decimal(line.difficulty)} · {line.discoveryComplete ? 'Move discovery complete' : 'Move discovery bounded'}.</p>
      </details>)}
      {!analysis.clutchLines.length && <p>No final-life rescue witnessed within this search.</p>}
    </details>
    <details><summary>Enemy-letter opportunities</summary>
      <div className="generator-table-wrap"><table><thead><tr><th>Position</th><th>Hits</th><th>Board copies</th><th>Refill copies (upper bound)</th><th>Observed word routes</th><th>Categories</th></tr></thead><tbody>
        {analysis.letterOpportunityCounts.map(letter => <tr key={letter.position}><th>{letter.position + 1}: {letter.letter}{analysis.criticalSinglePointLetters.includes(letter.position) ? ' ⚠' : ''}</th>
          <td>{letter.requiredHits}</td><td>{letter.currentBoardCopies}</td><td>{letter.reachableRefillCopies}</td><td>{letter.observedMatchingMoves}</td><td>{displayReviewText(letter.observedCategories.join(', '))}</td></tr>)}
      </tbody></table></div>
      <p>Refill supply is an optimistic physical bound. Word routes are observed opportunities, not guarantees that every future position remains playable.</p>
    </details>
    <details><summary>Quality score breakdown &amp; analysis scope</summary>
      <div className="generator-table-wrap"><table><thead><tr><th>Component</th><th>Value</th><th>Weight</th><th>Points</th><th>Reason</th></tr></thead><tbody>
        {quality.components.map(component => <tr key={component.name}><th>{displayReviewText(component.name)}</th><td>{component.value.toFixed(2)}</td><td>{component.weight}</td><td>{component.contribution.toFixed(2)}</td><td>{displayReviewText(component.explanation)}</td></tr>)}
      </tbody></table></div><ul>{analysis.notes.map(note => <li key={note}>{displayReviewText(note)}</li>)}</ul>
      <p>Generator: {candidate.provenance.generatorVersion}. Lexical provider: {candidate.provenance.lexicalProvider}.</p>
    </details>
  </article>
}

export default function DevGenerator({ onPlay, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const worker = useRef<Worker | null>(null)
  const requestId = useRef(0)
  const [enemy, setEnemy] = useState(reviewCache.enemy)
  const [automatic, setAutomatic] = useState(reviewCache.automatic)
  const [seed, setSeed] = useState(reviewCache.seed)
  const [count, setCount] = useState(reviewCache.count)
  const [includeRegenTile, setIncludeRegenTile] = useState(reviewCache.includeRegenTile)
  const [finiteRefills, setFiniteRefills] = useState(reviewCache.finiteRefills)
  const [refillLimit, setRefillLimit] = useState(reviewCache.refillLimit)
  const [ranked, setRanked] = useState<RankedCandidate[]>(reviewCache.ranked)
  const [selectedId, setSelectedId] = useState<string | null>(reviewCache.selectedId)
  const [filter, setFilter] = useState<ResultFilter>(reviewCache.filter)
  const [result, setResult] = useState<GenerationResult | null>(reviewCache.result)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<GeneratorProgress | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    reviewCache = { enemy, automatic, seed, count, includeRegenTile, finiteRefills, refillLimit, ranked, selectedId, filter, result }
  }, [enemy, automatic, seed, count, includeRegenTile, finiteRefills, refillLimit, ranked, selectedId, filter, result])
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element?.showModal()
    return () => {
      worker.current?.terminate()
      element?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  function generate() {
    worker.current?.terminate()
    setError(null); setNotice(null); setProgress(null); setSeconds(0); setBusy(true)
    const id = ++requestId.current
    try {
      const instance = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' })
      worker.current = instance
      instance.onmessage = ({ data }: MessageEvent<GeneratorResponse>) => {
        if (data.id !== requestId.current) return
        if (data.type === 'progress') { setProgress(data.progress); return }
        instance.terminate(); worker.current = null; setBusy(false)
        if (data.type === 'error') { setError(data.message); return }
        setResult(data.result); setRanked(data.result.ranked)
        const best = data.result.accepted[0] ?? data.result.ranked[0]
        setSelectedId(best?.candidate.id ?? null)
        setFilter(data.result.accepted.length ? 'accepted' : 'all')
      }
      instance.onerror = event => {
        if (id !== requestId.current) return
        instance.terminate(); worker.current = null; setBusy(false)
        setError(event.message || 'Generator worker failed. The previous results are still available.')
      }
      const request: GeneratorRequest = { id, enemy: automatic ? null : enemy.trim().toUpperCase(), seed, candidateCount: count, includeRegenTile,
        ...(finiteRefills ? { refillLimit } : {}) }
      instance.postMessage(request)
    } catch (failure) {
      worker.current?.terminate(); worker.current = null; setBusy(false)
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }
  function cancel() {
    requestId.current++
    worker.current?.terminate(); worker.current = null; setBusy(false)
    setNotice('Generation cancelled. Previous results are still available.')
  }
  const visible = ranked.filter(item => filter === 'all' || item.validation.accepted === (filter === 'accepted'))
  const selected = ranked.find(item => item.candidate.id === selectedId)
  if (!import.meta.env.DEV) return null
  return <dialog className="generator-dialog" ref={dialog} aria-labelledby="generator-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="generator-heading"><div><p className="generator-kicker">DEV · local generator / solver / validator</p><h2 id="generator-title">Puzzle workshop</h2></div>
      <button type="button" onClick={onClose} aria-label="Close puzzle workshop">Close</button></header>
    <p>Generate meaning-first puzzles: every accepted word gets a stored definition and meaning class before solving. Word-type and long-word bonuses are disabled. Accepted results enter a human review queue; daily puzzles are published separately.</p>
    <form className="generator-form" onSubmit={event => { event.preventDefault(); generate() }}>
      <label>Enemy choice<select value={automatic ? 'auto' : 'manual'} disabled={busy} onChange={event => setAutomatic(event.target.value === 'auto')}><option value="manual">Choose an enemy</option><option value="auto">Choose a suitable enemy automatically</option></select></label>
      <label>Enemy word<input value={enemy} disabled={automatic || busy} onChange={event => setEnemy(event.target.value)} required={!automatic} pattern="[A-Za-z]+" maxLength={24} /></label>
      <label>Seed<input value={seed} disabled={busy} onChange={event => setSeed(event.target.value)} required maxLength={128} /></label>
      <label>Initial candidates<input type="number" min={1} max={100} value={count} disabled={busy} onChange={event => setCount(Number(event.target.value))} required /></label>
      <label><input type="checkbox" checked={includeRegenTile} disabled={busy} onChange={event => setIncludeRegenTile(event.target.checked)} /> Include enemy Revive tile</label>
      <label><input type="checkbox" checked={finiteRefills} disabled={busy} onChange={event => setFiniteRefills(event.target.checked)} /> Finite refill supply</label>
      {finiteRefills && <label>Initial refill tiles<input type="number" min={0} max={96} step={1} value={refillLimit} disabled={busy} onChange={event => setRefillLimit(Number(event.target.value))} required />
        <small>Refinement may adjust this budget. Every candidate shows its final supply.</small></label>}
      <button className="generator-primary" type="submit" disabled={busy}>Generate candidates</button>
      {busy && <button type="button" onClick={cancel}>Cancel</button>}
    </form>
    <div className="generator-status" role="status" aria-live="polite">{busy ? <><progress aria-label="Generating and analysing puzzles" /><span>{progress ? `${progress.enemyWord}: ${progress.attempted} evaluated, ${progress.accepted} accepted` : 'Constructing and analysing candidates'} · {seconds}s. Refinements add further evaluations.</span></>
      : notice ?? (result ? `${result.attempted} evaluated · ${result.solvable} witnessed solvable · ${result.acceptedCount} passed DEV gates · ${seconds}s` : `${ranked.length} saved Revive candidate${ranked.length === 1 ? '' : 's'} ready for review.`)}</div>
    {error && <p className="generator-rejected" role="alert">{error}</p>}
    {result && !result.enemySuitability.eligible && <section className="generator-rejected" aria-label="Rejected enemy">
      <h3>Enemy rejected: {result.enemySuitability.word || 'No suitable concept'}</h3>
      <ul>{result.enemySuitability.rejectionReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    </section>}
    {result && <details><summary>Enemy suitability &amp; batch rejections</summary><pre>{JSON.stringify({ enemySuitability: result.enemySuitability, enemyRejections: result.enemyRejections, candidateRejections: result.rejectionCounts }, null, 2)}</pre></details>}
    <div className="generator-browser">
      <aside className="generator-results" aria-label="Ranked candidates">
        <label>Ranked results<select value={filter} onChange={event => setFilter(event.target.value as ResultFilter)}><option value="accepted">Accepted ({ranked.filter(item => item.validation.accepted).length})</option><option value="all">All ({ranked.length})</option><option value="rejected">Rejected ({ranked.filter(item => !item.validation.accepted).length})</option></select></label>
        <ol>{visible.map((item, index) => <li key={item.candidate.id}><button type="button" aria-pressed={item.candidate.id === selectedId} onClick={() => setSelectedId(item.candidate.id)}>
          <span><strong>#{index + 1} {item.candidate.enemyWord}</strong><b>{item.quality.total.toFixed(1)}</b></span><small>{item.candidate.seed}</small><small>{displayReviewText(item.candidate.goal.archetypes.join(' · '))}</small>
          <small>{item.validation.accepted ? 'Accepted for review' : `${item.validation.reasons.length} rejection reasons`} · {item.analysis.winningLinesFound} winning lines</small>
        </button></li>)}</ol>
        {!visible.length && <p>No candidates in this view.</p>}
      </aside>
      {selected ? <CandidateReview key={selected.candidate.id} ranked={selected} onPlay={onPlay} /> : <p className="generator-empty">Generate candidates to inspect boards, search evidence, and winning routes.</p>}
    </div>
  </dialog>
}
