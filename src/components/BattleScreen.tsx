import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, Lightbulb, X } from 'lucide-react'
import { useUserPreferences } from '../useUserPreferences'
import Header from './Header'
import { useBattleFit } from './useBattleFit'
import { MyInfo } from './HealthInfo'
import Enemy from './Enemy'
import AttackInfo from './AttackInfo'
import TileGrid from './TileGrid'
import BingoHuntInstructions from './BingoHuntInstructions'
import WyrmDecoder from './WyrmDecoder'
import { createLetterStrikeGame, toggleLetterStrikeTile, clearLetterStrikeSelection, previewLetterStrike, submitLetterStrike } from '../game/letterStrike'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike'
import type { BingoGuide } from '../experimental/bingo/guides'
import { progressiveHint } from '../daily/progressiveHint'
import './BattleScreen.css'

type Phase = 'waiting' | 'enemy' | 'tiles' | 'ready'
type Panel = 'help' | 'log' | 'modes' | null
export type BattleAttempt = { game: LetterStrikeState; started: boolean }

/** Daily and archived puzzles share one battle UI and the same difficulty rules. */
export default function BattleScreen({ encounter, initial, onSave, onExit, guide, menu, renderResult,
  renderBestResult, bestStars, puzzleDate, completed = false }: {
  encounter: LetterStrikeEncounter
  initial?: BattleAttempt
  onSave: (game: LetterStrikeState, started: boolean) => boolean
  onExit: () => void
  guide?: BingoGuide
  menu?: ReactNode
  renderResult: (game: LetterStrikeState) => ReactNode
  renderBestResult?: (onClose: () => void) => ReactNode
  bestStars?: number
  puzzleDate?: string
  completed?: boolean
}) {
  const preferences = useUserPreferences()
  const easy = preferences.preferences.preferredMode === 'easy'
  const hard = preferences.preferences.preferredMode === 'hard' || preferences.preferences.preferredMode === 'hardcore'
  const hardHunt = hard && Boolean(encounter.bingoHunt)
  const [game, setGame] = useState(() => initial?.game ?? createLetterStrikeGame(encounter))
  // Hard misses can leave spares on the final life; only collapse a true anagram.
  const finalAnagram = Boolean(encounter.bingoHunt && game.playerResolve <= 1
    && game.tiles.filter(tile => tile.letter).length === encounter.bingoHunt.answer.length)
  const boardLayout = finalAnagram ? 'ring' : 'wheel'
  const [phase, setPhase] = useState<Phase>(initial?.started ? 'ready' : 'waiting')
  const [panel, setPanel] = useState<Panel>(null)
  const [viewingBest, setViewingBest] = useState(false)
  const wasViewingBest = useRef(false)
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
  const registerLetter = useCallback((index: number, element: HTMLDivElement | null) => {
    enemyElements.current[index] = element
  }, [])
  const registerTile = useCallback((index: number, element: HTMLButtonElement | null) => {
    tileElements.current[index] = element
  }, [])
  const revealEnemyLetter = useCallback((index: number) => {
    setRevealedEnemyIndices(current => current.includes(index) ? current : [...current, index])
  }, [])
  const revealTile = useCallback((index: number) => {
    setRevealedTileIndices(current => current.includes(index) ? current : [...current, index])
  }, [])
  const revealRefill = useCallback(() => {}, [])
  const enemyDecoded = useCallback(() => setPhase('tiles'), [])
  const tilesDecoded = useCallback(() => setPhase('ready'), [])

  const [resolvedTurnCount, setResolvedTurnCount] = useState(game.playedWords.length)
  const resolving = game.playedWords.length > resolvedTurnCount
  const resolutionComplete = useCallback(() => setResolvedTurnCount(game.playedWords.length), [game.playedWords.length])
  const enemy = game.encounter.enemy
  const showResult = (completed || game.status !== 'playing') && !resolving
  const hint = progressiveHint(game, guide?.hints, easy && !completed && phase === 'ready', resolvedTurnCount)
  useBattleFit(containerRef, !viewingBest && !showResult, boardLayout, hint)
  const interactive = !completed && phase === 'ready' && game.status === 'playing' && !resolving && !viewingBest
  const attackPreview = previewLetterStrike(game, undefined, { hardGuess: hardHunt })
  const preview = { ...attackPreview, amount: attackPreview.strikes, maximum: 0, bonuses: [] }
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
  function persist(next: LetterStrikeState, started: boolean) {
    setProgressSaved(onSave(next, started))
  }
  function attack() {
    if (!interactive) return
    const next = submitLetterStrike(game, undefined, { hardGuess: hardHunt })
    if (next.playedWords.length > game.playedWords.length) persist(next, true)
    setGame(next)
  }
  function begin() {
    if (onSave(game, true)) setPhase('enemy')
    else setProgressSaved(false)
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
      if (phase === 'waiting' && !viewingBest && !showResult) begin()
    }}>
    <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={false}
      bestStars={bestStars} puzzleDate={puzzleDate}
      onBest={renderBestResult && bestStars && !resolving && (phase === 'ready' || phase === 'waiting')
        ? () => setViewingBest(true) : undefined}
      onHelp={() => setPanel('help')} onHistory={() => setPanel('log')} onSettings={() => setPanel('modes')} />
    {!progressSaved && <div className="daily-notice" role="alert"><span>Progress could not be saved.</span><button className="daily-button" onClick={() => persist(game, phase !== 'waiting')}>Retry save</button></div>}
    {viewingBest ? renderBestResult?.(closeBest) : showResult ? renderResult(game) : <>
    <div className="battle-info">
      <MyInfo name="LIVES" health={displayedLives} maxHealth={game.encounter.startingResolve} wyrm
        wyrmRef={wyrmLifeRef} decoding={phase === 'enemy' || phase === 'tiles'} animateLives />
    </div>
    <div className="enemy-zone">
      <Enemy name={enemy.word} definition={enemy.definition} partOfSpeech={enemy.partOfSpeech}
        hideDefinition={hard}
        hideCopyCounts={hardHunt}
        modifiers={[]}
        modifierUnit="STRIKE"
        introFinished={phase === 'ready'}
        letterStates={game.enemyLetters}
        previewMode={encounter.bingoHunt ? 'bingo-match' : 'damage'}
        predictedHits={!hardHunt && interactive && preview.valid ? preview.bingoHunt?.matchingHits ?? preview.hits : []}
        predictedRecoveries={interactive && preview.valid && 'recoveries' in preview ? preview.recoveries : undefined}
        resolvedHits={resolving ? game.playedWords.at(-1)?.preview.hits : undefined}
        resolvedRecoveries={resolving ? game.playedWords.at(-1)?.preview.recoveries : undefined}
        resolutionKey={resolving ? game.playedWords.length : undefined}
        onResolutionComplete={resolutionComplete}
        revealedIndices={revealedEnemyIndices} registerLetter={registerLetter} />
      {hint && <p className="easy-hint" role="status" aria-label="Hint" aria-atomic="true">
        <Lightbulb size={16} aria-hidden="true" /><span key={hint}>{hint}</span>
      </p>}
    </div>
    <div className="player-zone">
      <AttackInfo word={preview.word} damage={preview.amount} maxDamage={preview.maximum}
        metric="strikes" ready={interactive && preview.valid} message={message} bonuses={preview.bonuses}
        strikePreview={!hardHunt ? preview : undefined} enemyWord={enemy.word}
        counterRules={encounter.counterRules}
        resolveBefore={interactive && preview.valid ? game.playerResolve : undefined}
      />
      <div className="controls">
        <TileGrid layout={boardLayout} tileShape="circle" revealedIndices={revealedTileIndices} registerTile={registerTile}
          ready={interactive} tiles={game.tiles} specialTiles={[]}
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

    {panel === 'modes' && <BattlePanel title="Settings" onClose={() => setPanel(null)}>
      <fieldset className="battle-difficulty">
        <legend>Difficulty</legend>
        <div>
          <button className="daily-button" aria-pressed={easy} onClick={() => preferences.update({ preferredMode: 'easy' })}>Easy</button>
          <button className="daily-button" aria-pressed={!easy && !hard} onClick={() => preferences.update({ preferredMode: 'normal' })}>Normal</button>
          <button className="daily-button" aria-pressed={hard} onClick={() => preferences.update({ preferredMode: 'hard' })}>Hard</button>
        </div>
        <p>{hard ? 'Definition, armour and guess previews are hidden. Wrong words cost a life but remove no tiles.'
          : easy ? 'Definition and armour shown. Wrong words cost no lives. A hint appears after each guess that removes spare tiles.'
            : 'Definition and armour shown. Wrong words cost no lives. No hints.'}</p>
      </fieldset>
      <p className="settings-attempt-rule">One attempt per puzzle. Leaving saves your place.</p>
      <nav className="settings-shortcuts" aria-label="Puzzle shortcuts">
        <button className="settings-shortcut" onClick={onExit}><CalendarDays aria-hidden="true" /><span>Calendar</span></button>
        {menu}
      </nav>
    </BattlePanel>}
    {panel === 'log' && <BattlePanel title="Played words" onClose={() => setPanel(null)}>
      {game.playedWords.length > 0 ? <ol className="hunt-history">{game.playedWords.map(move => <li key={move.word}>
        <strong>{move.word}</strong><span>{move.preview.bingoHunt?.won ? 'Bingo' : `${move.semanticLabel !== 'COUNTER' ? 'Not an antonym · ' : ''}${move.preview.bingoHunt?.removedTileIds.length} spare tiles removed`}</span>
      </li>)}</ol> : <p>No words played yet.</p>}
    </BattlePanel>}
    {panel === 'help' && <BattlePanel title="How to play" onClose={() => setPanel(null)}>
      <BingoHuntInstructions partOfSpeech={encounter.counterRules!.partOfSpeech} daily
        armour={encounter.enemyLetters.some(letter => letter.initialHits > 1)} hard={hard} />
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
      <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button>
    </div>
    {children}
  </dialog>
}
