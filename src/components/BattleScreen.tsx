import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useUserPreferences } from '../useUserPreferences'
import Header from './Header'
import { useBattleFit } from './useBattleFit'
import { MyInfo } from './HealthInfo'
import RefillSupply from './RefillSupply'
import Enemy from './Enemy'
import AttackInfo from './AttackInfo'
import TileGrid from './TileGrid'
import EncounterHud from './EncounterHud'
import BingoHuntInstructions from './BingoHuntInstructions'
import WyrmDecoder from './WyrmDecoder'
import { createLetterStrikeGame, toggleLetterStrikeTile, clearLetterStrikeSelection, previewLetterStrike, submitLetterStrike } from '../game/letterStrike'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike'
import { getLetterStrikeBattleEvents, getLetterStrikeBonuses, getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from '../game/letterStrikeHud'
import BattleResult from './BattleResult'
import type { BingoGuide } from '../experimental/bingo/guides'
import './BattleScreen.css'

type Phase = 'waiting' | 'enemy' | 'tiles' | 'ready'
type Panel = 'help' | 'log' | 'modes' | 'hints' | null
export type BattleAttempt = { game: LetterStrikeState; started: boolean; hintStep?: number }

/** Daily and archived puzzles share one battle UI and the same difficulty rules. */
export default function BattleScreen({ encounter, initial, onSave, onRestart, onExit, title, onChoose, onNext,
  guide, menu, renderResult, renderBestResult, bestStars, puzzleDate, boardLayout: layoutOverride, tileShape: shapeOverride,
  onBoardLayoutChange, onTileShapeChange, notice, exitLabel = 'Calendar', autoBegin = false }: {
  encounter: LetterStrikeEncounter
  initial?: BattleAttempt
  onSave: (game: LetterStrikeState, started: boolean, hintStep: number) => boolean
  onRestart: () => void
  autoBegin?: boolean
  onExit: () => void
  exitLabel?: string
  title: string
  onChoose?: () => void
  onNext?: () => void
  guide?: BingoGuide
  menu?: ReactNode
  renderResult?: (game: LetterStrikeState) => ReactNode
  renderBestResult?: (onClose: () => void) => ReactNode
  bestStars?: number
  puzzleDate?: string
  boardLayout?: 'grid' | 'wheel' | 'ring'
  tileShape?: 'square' | 'circle'
  onBoardLayoutChange?: (layout: 'grid' | 'wheel' | 'ring') => void
  onTileShapeChange?: (shape: 'square' | 'circle') => void
  notice?: ReactNode
}) {
  const preferences = useUserPreferences()
  const preferredLayout = layoutOverride ?? preferences.preferences.boardLayout ?? 'wheel'
  const tileShape = shapeOverride ?? preferences.preferences.tileShape ?? 'circle'
  const easy = preferences.preferences.preferredMode === 'easy'
  const hard = preferences.preferences.preferredMode === 'hard' || preferences.preferences.preferredMode === 'hardcore'
  const hintsAvailable = easy && Boolean(guide)
  const [game, setGame] = useState(() => initial?.game ?? createLetterStrikeGame(encounter))
  // The last hunt guess is a single anagram, without changing the saved layout.
  const finalAnagram = Boolean(encounter.bingoHunt && game.playerResolve <= 1)
  const boardLayout = finalAnagram ? 'ring' : preferredLayout
  const [phase, setPhase] = useState<Phase>(initial?.started ? 'ready' : 'waiting')
  useLayoutEffect(() => {
    // Start after the board and wyrm dock refs have mounted.
    if (!autoBegin || initial?.started) return
    const frame = requestAnimationFrame(() => setPhase('enemy'))
    return () => cancelAnimationFrame(frame)
  }, [autoBegin, initial?.started])
  const [panel, setPanel] = useState<Panel>(null)
  const [viewingBest, setViewingBest] = useState(false)
  const wasViewingBest = useRef(false)
  const [hintStep, setHintStep] = useState(initial?.hintStep ?? 1)
  const [progressSaved, setProgressSaved] = useState(true)
  const containerRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (wasViewingBest.current && !viewingBest) {
      containerRef.current?.querySelector<HTMLButtonElement>('.header-best')?.focus({ preventScroll: true })
    }
    wasViewingBest.current = viewingBest
  }, [viewingBest])
  const enemyElements = useRef<(HTMLDivElement | null)[]>([])
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const refillElements = useRef<(HTMLSpanElement | null)[]>([])
  const wyrmDockRef = useRef<HTMLSpanElement>(null)
  const wyrmLifeRef = useRef<HTMLSpanElement>(null)
  const wyrmTitleRef = useRef<HTMLDivElement>(null)
  const [revealedEnemyIndices, setRevealedEnemyIndices] = useState<number[]>(() => initial?.started ? [...game.encounter.enemy.word].map((_, index) => index) : [])
  const [revealedTileIndices, setRevealedTileIndices] = useState<number[]>(() => initial?.started ? game.tiles.map((_, index) => index) : [])
  const [revealedRefills, setRevealedRefills] = useState<boolean[]>([])
  const registerLetter = useCallback((index: number, element: HTMLDivElement | null) => {
    enemyElements.current[index] = element
  }, [])
  const registerTile = useCallback((index: number, element: HTMLButtonElement | null) => {
    tileElements.current[index] = element
  }, [])
  const registerRefill = useCallback((index: number, element: HTMLSpanElement | null) => {
    refillElements.current[index] = element
  }, [])
  const revealEnemyLetter = useCallback((index: number) => {
    setRevealedEnemyIndices(current => current.includes(index) ? current : [...current, index])
  }, [])
  const revealTile = useCallback((index: number) => {
    setRevealedTileIndices(current => current.includes(index) ? current : [...current, index])
  }, [])
  const revealRefill = useCallback((index: number) => {
    setRevealedRefills(current => {
      if (current[index]) return current
      const next = [...current]
      next[index] = true
      return next
    })
  }, [])
  const enemyDecoded = useCallback(() => setPhase('tiles'), [])
  const tilesDecoded = useCallback(() => setPhase('ready'), [])

  const [resolvedTurnCount, setResolvedTurnCount] = useState(game.playedWords.length)
  const resolving = game.playedWords.length > resolvedTurnCount
  const resolutionComplete = useCallback(() => setResolvedTurnCount(game.playedWords.length), [game.playedWords.length])
  const enemy = game.encounter.enemy
  const showResult = game.status !== 'playing' && !resolving
  useBattleFit(containerRef, !viewingBest && !showResult, boardLayout)
  const interactive = phase === 'ready' && game.status === 'playing' && !resolving && !viewingBest
  const attackPreview = previewLetterStrike(game)
  const preview = { ...attackPreview, amount: attackPreview.strikes, maximum: 0, bonuses: getLetterStrikeBonuses(attackPreview) }
  const events = getLetterStrikeBattleEvents(game).map(event => game.encounter.counterRules
    ? { ...event, semanticLabel: event.semanticLabel === 'COUNTER' ? (game.encounter.counterRules.kind === 'antonym' ? 'ANTONYM' : 'COUNTER') : 'NO MATCH' } : event)
  const specialTiles = getLetterStrikeTileSummary(game)
  const message = resolving ? undefined
    : game.status === 'won' ? game.playedWords.length === 1 ? 'BINGO · ONE WORD!' : 'VICTORY'
    : game.status === 'lost' ? game.playerResolve > 0 ? 'NO PLAYABLE WORDS' : 'OUT OF LIVES'
    : phase === 'waiting' ? 'CLICK TO BEGIN' : phase !== 'ready' ? 'DECODING'
    : game.error ?? (game.selectedTileIds.length > 0 ? preview.error ?? undefined : undefined)

  function select(id: number) {
    if (interactive) setGame(current => toggleLetterStrikeTile(current, id))
  }
  function clear() {
    if (interactive) setGame(clearLetterStrikeSelection)
  }
  function persist(next: LetterStrikeState, started: boolean, step = hintStep) {
    setProgressSaved(onSave(next, started, step))
  }
  function attack() {
    if (!interactive) return
    const next = submitLetterStrike(game)
    if (next.playedWords.length > game.playedWords.length) persist(next, true)
    setGame(next)
  }
  function begin() {
    persist(game, true)
    setPhase('enemy')
  }
  function showHint(step: number) {
    persist(game, phase !== 'waiting', step)
    setHintStep(step)
  }
  const closeBest = () => setViewingBest(false)

  const displayedLives = resolving
    ? game.playerResolve + (game.playedWords.at(-1)?.preview.resolveCost ?? 0) : game.playerResolve
  return <main className="container letter-combat bingo-preview" data-combat-mode="letter-strike"
    data-board-layout={boardLayout}
    data-counter-rules={encounter.counterRules ? true : undefined}
    data-bingo-hunt={encounter.bingoHunt ? true : undefined}
    data-game-status={game.status} data-result={showResult || viewingBest || undefined} data-phase={phase} data-turns={game.playedWords.length}
    ref={containerRef}
    onClick={event => {
      if ((event.target as HTMLElement).closest('button, a, input, dialog')) return
      if (phase === 'waiting' && !viewingBest) begin()
    }}>
    <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={false}
      bestStars={bestStars} puzzleDate={puzzleDate}
      onBest={renderBestResult && bestStars && !resolving && (phase === 'ready' || phase === 'waiting')
        ? () => setViewingBest(true) : undefined}
      onHelp={() => setPanel('help')} onHistory={() => setPanel('log')} onSettings={() => setPanel('modes')} />
    {notice}
    {!progressSaved && <div className="daily-notice" role="alert"><span>Progress could not be saved.</span><button className="daily-button" onClick={() => persist(game, phase !== 'waiting')}>Retry save</button></div>}
    {viewingBest ? renderBestResult?.(closeBest) : showResult ? renderResult?.(game) ?? <BattleResult game={game} onRetry={onRestart} onNext={onNext}
      onChoose={onChoose} onHints={hintsAvailable ? () => setPanel('hints') : undefined} /> : <>
    <div className="battle-info">
      <MyInfo name="LIVES" health={displayedLives} maxHealth={game.encounter.startingResolve} wyrm
        wyrmRef={wyrmLifeRef} decoding={phase === 'enemy' || phase === 'tiles'} animateLives />
      {encounter.bingoHunt ? <div className="hunt-resource"><span className="resource-label">TILES LEFT</span>
        <span>{game.tiles.filter(tile => tile.letter).length}</span></div>
        : <RefillSupply game={game} decoded={phase === 'ready'} revealed={revealedRefills} registerTile={registerRefill} />}
    </div>
    <div className="enemy-zone">
      <Enemy name={enemy.word} definition={enemy.definition} partOfSpeech={enemy.partOfSpeech}
        hideDefinition={hard}
        modifiers={getLetterStrikeGrammarModifiers(game)}
        modifierUnit="STRIKE"
        introFinished={phase === 'ready'}
        letterStates={game.enemyLetters}
        previewMode={encounter.bingoHunt ? 'bingo-match' : 'damage'}
        predictedHits={interactive && preview.valid ? preview.bingoHunt?.matchingHits ?? preview.hits : []}
        predictedRecoveries={interactive && preview.valid && 'recoveries' in preview ? preview.recoveries : undefined}
        resolvedHits={resolving ? game.playedWords.at(-1)?.preview.hits : undefined}
        resolvedRecoveries={resolving ? game.playedWords.at(-1)?.preview.recoveries : undefined}
        resolutionKey={resolving ? game.playedWords.length : undefined}
        onResolutionComplete={resolutionComplete}
        revealedIndices={revealedEnemyIndices} registerLetter={registerLetter} />
    </div>
    <div className="player-zone">
      <AttackInfo word={preview.word} damage={preview.amount} maxDamage={preview.maximum}
        metric="strikes" ready={interactive && preview.valid} message={message} bonuses={preview.bonuses}
        strikePreview={'hits' in preview ? preview : undefined} enemyWord={enemy.word}
        counterRules={encounter.counterRules}
        resolveBefore={interactive && preview.valid ? game.playerResolve : undefined}
      />
      <div className="controls">
        <TileGrid layout={boardLayout} tileShape={tileShape} revealedIndices={revealedTileIndices} registerTile={registerTile}
          ready={interactive} tiles={game.tiles} specialTiles={specialTiles}
          enemyLetters={game.enemyLetters} matchHint="underline"
          selectedTileIds={game.selectedTileIds} canAttack={phase === 'waiting' || interactive && preview.valid}
          primaryLabel={phase === 'waiting' ? 'BEGIN' : 'ATTACK'}
          onToggleTile={select} onClear={clear} onAttack={phase === 'waiting' ? begin : attack} />
      </div>
    </div>
    <WyrmDecoder phase={phase} containerRef={containerRef} enemyLetters={enemyElements}
      tileElements={tileElements} refillElements={refillElements} dockRef={wyrmLifeRef}
      lifeSegments={game.encounter.startingResolve}
      enemyCount={enemy.word.length} tileCount={game.tiles.length} boardLayout={boardLayout}
      onEnemyReveal={revealEnemyLetter} onTileReveal={revealTile} onRefillReveal={revealRefill}
      onEnemyDecoded={enemyDecoded} onTilesDecoded={tilesDecoded} />
    </>}

    {panel === 'hints' && hintsAvailable && guide && <BattlePanel title="Bingo hints" onClose={() => setPanel(null)}>
      <div className="bingo-hint-content" aria-live="polite" aria-atomic="true">
        {hintStep <= 3 ? <>
          <p className="bingo-hint-step">Hint {hintStep} of 3</p>
          <p className="bingo-hint-text">{guide.hints[hintStep - 1]}</p>
        </> : <>
          <p className="bingo-answer">{guide.answer}</p>
          <p>{guide.explanation}</p>
          <p className="bingo-hint-step">A one-word win on the starting board.</p>
        </>}
      </div>
      <div className="bingo-hint-actions">
        {hintStep <= 3 ? <>
          <button className="daily-button" disabled={hintStep === 1} onClick={() => showHint(hintStep - 1)}>Previous hint</button>
          <button className="daily-button" onClick={() => showHint(hintStep + 1)}>
            {hintStep === 3 ? 'Reveal answer' : `Next hint (${hintStep + 1}/3)`}
          </button>
        </> : <>
          <button className="daily-button" onClick={() => showHint(3)}>Back to hints</button>
          <button className="daily-button" onClick={onRestart}>Restart puzzle</button>
        </>}
      </div>
    </BattlePanel>}
    {panel === 'modes' && <BattlePanel title={title} onClose={() => setPanel(null)}>
      <fieldset className="battle-difficulty battle-layout-settings">
        <legend>Letter layout</legend>
        <div>
          {([{ value: 'grid', label: 'Grid' }, { value: 'wheel', label: '2 rings' }, { value: 'ring', label: '1 ring' }] as const).map(option =>
            <button className="daily-button" key={option.value} aria-pressed={boardLayout === option.value} disabled={finalAnagram}
              onClick={() => { preferences.update({ boardLayout: option.value }); onBoardLayoutChange?.(option.value) }}>{option.label}</button>)}
        </div>
        {finalAnagram && <p>The final anagram uses one ring.</p>}
        <div className="battle-shape-settings">
          {(['square', 'circle'] as const).map(shape => <button className="daily-button" key={shape} aria-pressed={tileShape === shape}
            onClick={() => { preferences.update({ tileShape: shape }); onTileShapeChange?.(shape) }}>{shape === 'square' ? 'Square tiles' : 'Round tiles'}</button>)}
        </div>
      </fieldset>
      <fieldset className="battle-difficulty">
        <legend>Difficulty</legend>
        <div>
          <button className="daily-button" aria-pressed={easy} onClick={() => preferences.update({ preferredMode: 'easy' })}>Easy</button>
          <button className="daily-button" aria-pressed={!easy && !hard} onClick={() => preferences.update({ preferredMode: 'normal' })}>Normal</button>
          <button className="daily-button" aria-pressed={hard} onClick={() => preferences.update({ preferredMode: 'hard' })}>Hard</button>
        </div>
        <p>{hard ? 'Enemy definition hidden. No hints.' : easy ? 'Enemy definition shown. Three hints and an answer reveal.' : 'Enemy definition shown. No hints.'}</p>
      </fieldset>
      <div className="dev-controls">
        {menu}
        <button className="daily-button" onClick={onRestart}>Restart puzzle</button>
        {hintsAvailable && <button className="daily-button" onClick={() => setPanel('hints')}>Hints</button>}
        {onChoose && <button className="daily-button" onClick={onChoose}>All puzzles</button>}
        <button className="daily-button" onClick={onExit}>{exitLabel}</button>
      </div>
    </BattlePanel>}
    {panel === 'log'  && <BattlePanel title="Played words" onClose={() => setPanel(null)}>
      {events.length > 0 ? encounter.bingoHunt ? <ol className="hunt-history">{game.playedWords.map(move => <li key={move.word}>
        <strong>{move.word}</strong><span>{move.preview.bingoHunt?.won ? 'Bingo' : `${move.preview.bingoHunt?.removedTileIds.length} spare tiles removed`}</span>
      </li>)}</ol> : <div className="dev-combat-log"><EncounterHud visible events={events} metric="strikes" /></div>
        : <p>No submitted words in this attempt.</p>}
    </BattlePanel>}
    {panel === 'help' && <BattlePanel title="How to play" onClose={() => setPanel(null)}>
        {encounter.bingoHunt ? <BingoHuntInstructions partOfSpeech={encounter.counterRules!.partOfSpeech} /> : <div className="daily-help">
          <div>Remove every enemy letter before your {game.encounter.startingResolve} lives run out. Tap or swipe across tiles in spelling order; you can mix both.</div>
          <div>One {encounter.counterRules?.kind === 'antonym' ? 'antonym' : 'counter'} can remove the whole enemy in a single word. Each played word uses one life; removing the final letter on your last life still wins.</div>
          <div>Underlined tiles match a surviving enemy letter. Refills show the letters still available after you play.</div>
          {encounter.counterRules ? <>
            <div>{encounter.counterRules.kind === 'family'
              ? <><strong>Counter family: {encounter.counterRules.family}.</strong> Find {encounter.counterRules.partOfSpeech}s in this family.</>
              : <><strong>Find opposite {encounter.counterRules.partOfSpeech}s.</strong> Use the enemy’s displayed meaning and the same word type.</>}
              {' '}Every matching letter in a counter hits. Other words do no damage, but still use a life and draw refills.</div>
            <div>The enemy word and its own inflections cannot be played. Ordinary forms of counters count when they keep the required meaning and word type.</div>
            {specialTiles.some(tile => tile.id === 'ward') && <div>The green LIFE tile saves your life for that turn, even in a word that does no damage. It becomes an ordinary tile when refilled.</div>}
            {game.encounter.tileEffects.power?.bonusStrike && <div>A counter using the blue POWER tile hits one extra enemy letter after its matching letters hit. No matching letter is needed for that extra hit. The tile loses its power when used. Other words cannot trigger it.</div>}
          </> : <div><strong>Meaning drives your hits.</strong> Counter words hit with every matching tile. Neutral words get one normal matching hit, in spelling order. Similar meanings are resisted and have no normal hits.</div>}
          <div>Double outlines need two hits. The first breaks armour; the next removes the letter. Matching tiles finish wounded copies first, then target from left to right.</div>
          <div>Blue − previews an armour break; red × previews removal. Defeated letters become centred dots with no outline. Repeated matching tiles can break and remove one armoured letter in the same word.</div>
          {hintsAvailable && <button className="daily-button" onClick={() => setPanel('hints')}>Hints</button>}
          <div>Replay freely. Best win: ★★★ in one word, ★★ in two, ★ in three or more.</div>
        </div>}
      </BattlePanel>}
  </main>
}

export function BattlePanel({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog className="daily-panel" ref={dialog} onCancel={onClose} aria-label={title}>
    <div className="daily-panel-heading">
      <h2>{title}</h2>
      <button type="button" className="daily-button" onClick={onClose}>Close</button>
    </div>
    {children}
  </dialog>
}
