import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Header from '../components/Header'
import { MyInfo, EnemyInfo } from '../components/HealthInfo'
import RefillSupply from '../components/RefillSupply'
import Enemy from '../components/Enemy'
import AttackInfo from '../components/AttackInfo'
import TileGrid from '../components/TileGrid'
import MatchHintControls from '../components/MatchHintControls'
import EnemyLayoutControls from '../components/EnemyLayoutControls'
import type { MatchHintMode } from '../components/tileMatchHints'
import EncounterHud from '../components/EncounterHud'
import WyrmDecoder from '../components/WyrmDecoder'
import { createGame, toggleTile, clearSelection, previewAttack, submitWord } from '../game/game'
import { melancholyEncounter } from '../game/encounters'
import { getActiveGrammarModifiers, getCurrentTileSummary, getRecentBattleEvents } from '../game/hud'
import type { GameState } from '../game/types'
import {
  createLetterStrikeGame, toggleLetterStrikeTile, clearLetterStrikeSelection,
  previewLetterStrike, submitLetterStrike,
} from '../game/letterStrike'
import type { LetterStrikeEncounter, LetterStrikeState } from '../game/letterStrike'
import { getLetterStrikeBattleEvents, getLetterStrikeBonuses, getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from '../game/letterStrikeHud'
import './DevCombat.css'
import type { BingoGuide } from './bingo/guides'
import { resumeBingoAttempt, saveBingoAttempt } from './bingo/progress'

type CombatMode = 'damage' | 'letter-strike'
type Run = { mode: 'damage'; game: GameState } | { mode: 'letter-strike'; game: LetterStrikeState }
type Phase = 'waiting' | 'enemy' | 'tiles' | 'ready'
type Panel = 'help' | 'log' | 'modes' | 'hints' | null

const modeLabels = { damage: 'DAMAGE MODE', 'letter-strike': 'LETTER-STRIKE MODE' }

// The development chooser is DEV-only. The named battle renderer also powers
// isolated beta previews. Beta attempts use their own small replay logs; daily
// hooks and storage are never involved. A keyed remount handles explicit restarts.
export default function DevCombat({ initialMode, encounter, onExit, matchHint, onMatchHintChange, enemyGrid, onEnemyGridChange }: {
  initialMode: CombatMode; onExit: () => void
  encounter?: LetterStrikeEncounter
  matchHint: MatchHintMode; onMatchHintChange: (mode: MatchHintMode) => void
  enemyGrid: boolean; onEnemyGridChange: (grid: boolean) => void
}) {
  const [session, setSession] = useState({ mode: initialMode, revision: 0 })
  if (!import.meta.env.DEV) return null
  return <PlaytestBattle key={`${session.mode}:${session.revision}`} mode={session.mode}
    encounter={encounter}
    onMode={mode => setSession(current => ({ mode, revision: current.revision + 1 }))}
    onExit={onExit} matchHint={matchHint} onMatchHintChange={onMatchHintChange}
    enemyGrid={enemyGrid} onEnemyGridChange={onEnemyGridChange} />
}

export function PlaytestBattle({ mode, encounter, onMode, onExit, matchHint, onMatchHintChange, enemyGrid, onEnemyGridChange, bingoPreview = false, previewName, onChoosePreview, bingoGuide, bingoProgressKey, freshBingoAttempt = false }: {
  mode: CombatMode; onMode: (mode: CombatMode) => void; onExit: () => void
  encounter?: LetterStrikeEncounter
  matchHint: MatchHintMode; onMatchHintChange: (mode: MatchHintMode) => void
  enemyGrid: boolean; onEnemyGridChange: (grid: boolean) => void
  bingoPreview?: boolean
  previewName?: string
  onChoosePreview?: () => void
  bingoGuide?: BingoGuide
  bingoProgressKey?: string
  freshBingoAttempt?: boolean
}) {
  const [resumed] = useState(() => !freshBingoAttempt && bingoPreview && bingoProgressKey && encounter
    ? resumeBingoAttempt(bingoProgressKey, encounter) : null)
  const [run, setRun] = useState<Run>(() => mode === 'damage'
    ? { mode, game: createGame(melancholyEncounter) }
    : { mode, game: resumed?.game ?? createLetterStrikeGame(encounter) })
  const [phase, setPhase] = useState<Phase>(resumed?.started ? 'ready' : 'waiting')
  const [panel, setPanel] = useState<Panel>(null)
  const [hintStep, setHintStep] = useState(resumed?.hintStep ?? 1)
  const [progressSaved, setProgressSaved] = useState(true)
  const containerRef = useRef<HTMLElement>(null)
  const enemyElements = useRef<(HTMLDivElement | null)[]>([])
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const refillElements = useRef<(HTMLSpanElement | null)[]>([])
  const wyrmDockRef = useRef<HTMLSpanElement>(null)
  const wyrmLifeRef = useRef<HTMLSpanElement>(null)
  const wyrmTitleRef = useRef<HTMLDivElement>(null)
  const [revealedEnemyIndices, setRevealedEnemyIndices] = useState<number[]>(() => resumed?.started ? [...run.game.encounter.enemy.word].map((_, index) => index) : [])
  const [revealedTileIndices, setRevealedTileIndices] = useState<number[]>(() => resumed?.started ? run.game.tiles.map((_, index) => index) : [])
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

  const letterGame = run.mode === 'letter-strike' ? run.game : null
  const game = run.game
  const [resolvedTurnCount, setResolvedTurnCount] = useState(game.playedWords.length)
  const resolving = letterGame !== null && game.playedWords.length > resolvedTurnCount
  const resolutionComplete = useCallback(() => setResolvedTurnCount(game.playedWords.length), [game.playedWords.length])
  const enemy = game.encounter.enemy
  const interactive = phase === 'ready' && game.status === 'playing' && !resolving
  const preview = run.mode === 'damage' ? (() => {
    const attack = previewAttack(run.game)
    return { ...attack, amount: attack.totalDamage, maximum: run.game.encounter.enemy.maxHealth }
  })() : (() => {
    const attack = previewLetterStrike(run.game)
    return {
      ...attack, amount: attack.strikes, maximum: 0,
      bonuses: getLetterStrikeBonuses(attack),
    }
  })()
  const metric = run.mode === 'damage' ? 'damage' : 'strikes'
  const events = run.mode === 'damage' ? getRecentBattleEvents(run.game) : getLetterStrikeBattleEvents(run.game)
  const specialTiles = run.mode === 'damage' ? getCurrentTileSummary(run.game)
    : getLetterStrikeTileSummary(run.game)
  const message = resolving ? undefined
    : game.status === 'won' ? bingoPreview && game.playedWords.length === 1 ? 'BINGO · ONE WORD!' : 'VICTORY'
    : game.status === 'lost' ? game.playerResolve > 0 ? 'NO PLAYABLE WORDS' : 'OUT OF LIVES'
    : phase === 'waiting' ? 'CLICK TO BEGIN'
    : phase !== 'ready' ? 'DECODING'
    : game.error ?? (game.selectedTileIds.length > 0 ? preview.error ?? undefined : undefined)

  function select(id: number) {
    if (interactive) setRun(current => current.mode === 'damage'
      ? { ...current, game: toggleTile(current.game, id) }
      : { ...current, game: toggleLetterStrikeTile(current.game, id) })
  }
  function clear() {
    if (interactive) setRun(current => current.mode === 'damage'
      ? { ...current, game: clearSelection(current.game) }
      : { ...current, game: clearLetterStrikeSelection(current.game) })
  }
  function attack() {
    if (!interactive) return
    const next: Run = run.mode === 'damage'
      ? { ...run, game: submitWord(run.game) }
      : { ...run, game: submitLetterStrike(run.game) }
    if (next.mode === 'letter-strike' && next.game.playedWords.length > game.playedWords.length) persist(next.game, true)
    setRun(next)
  }
  function persist(next: LetterStrikeState | null, started: boolean, step = hintStep) {
    if (bingoPreview && bingoProgressKey && next) setProgressSaved(saveBingoAttempt(bingoProgressKey, next, started, step))
  }
  function begin() {
    persist(letterGame, true)
    setPhase('enemy')
  }
  function showHint(step: number) {
    persist(letterGame, phase !== 'waiting', step)
    setHintStep(step)
  }

  const displayedLives = bingoPreview && resolving
    ? game.playerResolve + (game.playedWords.at(-1)?.preview.resolveCost ?? 0) : game.playerResolve
  const alternativeTurns = game.encounter.startingResolve === 3 ? 'two or three'
    : game.encounter.startingResolve === 4 ? 'two, three or four' : 'two, three, four or five'

  return <main className={`container dev-combat${letterGame ? ' letter-combat' : ''}${bingoPreview ? ' bingo-preview' : ''}`} data-combat-mode={mode}
    data-game-status={game.status} data-phase={phase} data-turns={game.playedWords.length}
    data-enemy-grid={enemyGrid || undefined} ref={containerRef}
    onClick={event => {
      if ((event.target as HTMLElement).closest('button, a, input, dialog')) return
      if (phase === 'waiting') begin()
    }}>
    <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={!letterGame && phase === 'ready'}
      onHelp={() => setPanel('help')} onHistory={() => setPanel('log')} onSettings={() => setPanel('modes')} />
    <div className="daily-meta">
      {bingoPreview ? <span className="beta-label">BETA · {game.encounter.startingResolve} LIVES</span> : <button type="button" onClick={() => setPanel('modes')} aria-label="Switch combat mode">
          DEV · {modeLabels[mode]}
        </button>}
      {phase === 'waiting'
        ? <button type="button" onClick={begin}>Begin</button>
        : <button type="button" onClick={() => onMode(mode)}>Restart</button>}
      {encounter && <button type="button" onClick={onExit}>{bingoPreview ? 'Back to daily' : 'Return to generator'}</button>}
    </div>
    {bingoPreview && <div className="beta-intro">
      {onChoosePreview && <button type="button" onClick={onChoosePreview} aria-label="Choose a preview puzzle">{previewName} ▾</button>}
      <span role={progressSaved ? undefined : 'status'}>{progressSaved ? 'Hidden one-word win' : 'Progress not saved'}</span>
      {bingoGuide && <button type="button" className="beta-hints-button" onClick={() => setPanel('hints')}>Hints</button>}
    </div>}
    <div className="battle-info">
      <MyInfo name={letterGame ? 'LIVES' : 'YOU'} health={displayedLives} maxHealth={game.encounter.startingResolve} wyrm={Boolean(letterGame)}
        wyrmRef={wyrmLifeRef} decoding={phase === 'enemy' || phase === 'tiles'} animateLives={bingoPreview} />
      {letterGame && <RefillSupply game={letterGame} decoded={phase === 'ready'} revealed={revealedRefills} registerTile={registerRefill} />}
      {run.mode === 'damage'
        ? <EnemyInfo name={enemy.word} health={run.game.enemyHp} maxHealth={run.game.encounter.enemy.maxHealth} />
        : null}
    </div>
    <div className="enemy-zone" data-grid-preview={enemyGrid || undefined}>
      <Enemy name={enemy.word} definition={enemy.definition} partOfSpeech={enemy.partOfSpeech}
        modifiers={run.mode === 'damage' ? getActiveGrammarModifiers(run.game) : getLetterStrikeGrammarModifiers(run.game)}
        modifierUnit={letterGame ? 'STRIKE' : undefined}
        experimentalGrid={enemyGrid} introFinished={phase === 'ready'}
        letterStates={letterGame?.enemyLetters}
        predictedHits={interactive && preview.valid && 'hits' in preview ? preview.hits : []}
        predictedRecoveries={interactive && preview.valid && 'recoveries' in preview ? preview.recoveries : undefined}
        resolvedHits={resolving ? letterGame?.playedWords.at(-1)?.preview.hits : undefined}
        resolvedRecoveries={resolving ? letterGame?.playedWords.at(-1)?.preview.recoveries : undefined}
        resolutionKey={resolving ? game.playedWords.length : undefined}
        onResolutionComplete={resolutionComplete}
        revealedIndices={revealedEnemyIndices} registerLetter={registerLetter} />
      {run.mode === 'damage' && <EncounterHud visible={phase === 'ready'} events={events.slice(0, 2)} metric={metric} />}
    </div>
    <div className="player-zone">
      <AttackInfo word={preview.word} damage={preview.amount} maxDamage={preview.maximum}
        metric={metric} ready={interactive && preview.valid} message={message} bonuses={preview.bonuses}
        strikePreview={'hits' in preview ? preview : undefined} enemyWord={enemy.word}
        resolveBefore={letterGame && interactive && preview.valid ? game.playerResolve : undefined}
      />
      <div className="controls">
        <TileGrid revealedIndices={revealedTileIndices} registerTile={registerTile}
          ready={interactive} tiles={game.tiles} specialTiles={specialTiles}
          enemyLetters={letterGame?.enemyLetters} matchHint={letterGame ? matchHint : 'off'}
          selectedTileIds={game.selectedTileIds} damage={run.mode === 'damage' ? preview.amount : undefined} canAttack={interactive && preview.valid}
          onToggleTile={select} onClear={clear} onAttack={attack} />
      </div>
    </div>
    <WyrmDecoder phase={phase} containerRef={containerRef} enemyLetters={enemyElements}
      tileElements={tileElements} refillElements={refillElements} dockRef={letterGame ? wyrmLifeRef : wyrmDockRef}
      lifeSegments={letterGame ? game.encounter.startingResolve : undefined}
      enemyCount={enemy.word.length} tileCount={game.tiles.length}
      onEnemyReveal={revealEnemyLetter} onTileReveal={revealTile} onRefillReveal={revealRefill}
      onEnemyDecoded={enemyDecoded} onTilesDecoded={tilesDecoded} />

    {panel === 'hints' && bingoPreview && bingoGuide && <PlaytestPanel title="Bingo hints" onClose={() => setPanel(null)}>
      <div className="bingo-hint-content" aria-live="polite" aria-atomic="true">
        {hintStep <= 3 ? <>
          <p className="bingo-hint-step">Hint {hintStep} of 3</p>
          <p className="bingo-hint-text">{bingoGuide.hints[hintStep - 1]}</p>
        </> : <>
          <p className="bingo-answer">{bingoGuide.answer}</p>
          <p>{bingoGuide.explanation}</p>
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
          <button className="daily-button" onClick={() => onMode(mode)}>Restart puzzle</button>
        </>}
      </div>
    </PlaytestPanel>}
    {panel === 'modes' && <PlaytestPanel title={bingoPreview ? `${game.encounter.startingResolve}-life beta` : 'Combat playtest'} onClose={() => setPanel(null)}>
      <p>{bingoPreview ? `${game.encounter.startingResolve} lives, familiar rules, and a hidden one-word win. You can also win in ${alternativeTurns} words. Draft meanings are still under review. Retry as often as you like; this preview does not affect your daily puzzle or statistics.` : 'Each mode starts a fresh encounter. Playtests do not save to daily history.'}</p>
      {!bingoPreview && letterGame && <MatchHintControls value={matchHint} onChange={onMatchHintChange} />}
      {!bingoPreview && <EnemyLayoutControls grid={enemyGrid} onChange={onEnemyGridChange} />}
      <div className="dev-controls">
        {onChoosePreview && <button className="daily-button" onClick={onChoosePreview}>Choose puzzle / lives</button>}
        {bingoPreview ? <button className="daily-button" onClick={() => onMode(mode)}>Try again</button> : (encounter ? ['letter-strike'] as const : ['damage', 'letter-strike'] as const).map(value =>
          <button className="daily-button" key={value} onClick={() => onMode(value)}>{modeLabels[value]}</button>)}
        <button className="daily-button" onClick={onExit}>{bingoPreview ? 'Back to daily' : encounter ? 'Return to generator' : 'Return to daily game'}</button>
      </div>
    </PlaytestPanel>}
    {panel === 'log' && <PlaytestPanel title="Playtest log" onClose={() => setPanel(null)}>
      {events.length > 0 ? <div className="dev-combat-log"><EncounterHud visible events={events} metric={metric} /></div>
        : <p>No submitted words in this attempt.</p>}
    </PlaytestPanel>}
    {panel === 'help' && (run.mode === 'damage'
      ? <PlaytestPanel title="Damage mode" onClose={() => setPanel(null)}>
        <p>Select any tiles in word order to spell at least three letters. Longer words deal more damage; counters add a bonus. Power adds damage and Ward prevents Resolve loss.</p>
        <p>Reduce enemy HP to zero before Resolve runs out. This DEV comparison does not save to daily history.</p>
      </PlaytestPanel>
      : <PlaytestPanel title={bingoPreview ? `${game.encounter.startingResolve} lives · one hidden bingo` : 'Letter-strike mode'} onClose={() => setPanel(null)}>
        <div className="daily-help">
          <div>Remove every enemy letter before your {game.encounter.startingResolve} lives run out. Tap or swipe across tiles in spelling order; you can mix both.</div>
          {bingoPreview && <div>One long counter can remove the whole enemy in a single word. You can also win in {alternativeTurns} words. Each played word uses one life; removing the final letter on your last life still wins.</div>}
          <div><strong>Meaning drives your hits.</strong> Counter words hit with every matching tile. Neutral words get one normal matching hit, in spelling order. Similar meanings are resisted and have no normal hits.</div>
          {letterGame?.encounter.longWordRule && <div><strong>LONG +{letterGame.encounter.longWordRule.bonusStrikes}</strong> adds a normal strike allowance for neutral words of {letterGame.encounter.longWordRule.minimumLength}+ letters. It stacks with grammar weaknesses, but does not boost resisted words or counters.</div>}
          {!bingoPreview && <div>A blue <strong>HIT</strong> tile guarantees its matching hit, even on a resisted word. A green <strong>LIFE</strong> tile saves the life this turn would cost. A red <strong>REVIVE</strong> tile restores its enemy letter or its armour after your hits.</div>}
          <div>Double outlines need two hits. The first breaks armour; the next removes the letter. Matching tiles finish wounded copies first, then target from left to right.</div>
          <div>Blue − previews an armour break; red × previews removal. Defeated letters become centred dots with no outline. Repeated matching tiles can break and remove one armoured letter in the same word.</div>
          {Object.values(letterGame?.encounter.grammarModifiers ?? {}).some(value => value !== 0) && <div>This encounter also has word-type bonuses: an ADJECTIVE +1 weakness gives adjectives one extra normal matching hit. Counters already use all matching tiles.</div>}
          <div>{bingoPreview ? 'This is a practice preview. Restart freely; your daily progress and statistics are kept separate.' : 'This DEV comparison does not save to daily history.'}</div>
        </div>
      </PlaytestPanel>)}
  </main>
}

function PlaytestPanel({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
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
