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

type CombatMode = 'damage' | 'letter-strike'
type Run = { mode: 'damage'; game: GameState } | { mode: 'letter-strike'; game: LetterStrikeState }
type Phase = 'waiting' | 'enemy' | 'tiles' | 'ready'
type Panel = 'help' | 'log' | 'modes' | null

const modeLabels = { damage: 'DAMAGE MODE', 'letter-strike': 'LETTER-STRIKE MODE' }

// This entire entry point is lazy-loaded only in DEV. Playtests never call the
// daily hook or storage; a keyed remount discards all state on every mode change.
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

function PlaytestBattle({ mode, encounter, onMode, onExit, matchHint, onMatchHintChange, enemyGrid, onEnemyGridChange }: {
  mode: CombatMode; onMode: (mode: CombatMode) => void; onExit: () => void
  encounter?: LetterStrikeEncounter
  matchHint: MatchHintMode; onMatchHintChange: (mode: MatchHintMode) => void
  enemyGrid: boolean; onEnemyGridChange: (grid: boolean) => void
}) {
  const [run, setRun] = useState<Run>(() => mode === 'damage'
    ? { mode, game: createGame(melancholyEncounter) }
    : { mode, game: createLetterStrikeGame(encounter) })
  const [phase, setPhase] = useState<Phase>('waiting')
  const [panel, setPanel] = useState<Panel>(null)
  const containerRef = useRef<HTMLElement>(null)
  const enemyElements = useRef<(HTMLDivElement | null)[]>([])
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const wyrmDockRef = useRef<HTMLSpanElement>(null)
  const wyrmLifeRef = useRef<HTMLSpanElement>(null)
  const wyrmTitleRef = useRef<HTMLDivElement>(null)
  const [revealedEnemyIndices, setRevealedEnemyIndices] = useState<number[]>([])
  const [revealedTileIndices, setRevealedTileIndices] = useState<number[]>([])
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
    : game.status === 'won' ? 'VICTORY'
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
    if (interactive) setRun(current => current.mode === 'damage'
      ? { ...current, game: submitWord(current.game) }
      : { ...current, game: submitLetterStrike(current.game) })
  }

  return <main className={`container dev-combat${letterGame ? ' letter-combat' : ''}`} data-combat-mode={mode}
    data-enemy-grid={enemyGrid || undefined} ref={containerRef}
    onClick={event => {
      if ((event.target as HTMLElement).closest('button, a, input, dialog')) return
      if (phase === 'waiting') setPhase('enemy')
    }}>
    <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={!letterGame && phase === 'ready'}
      onHelp={() => setPanel('help')} onHistory={() => setPanel('log')} onSettings={() => setPanel('modes')} />
    <div className="daily-meta">
      <button type="button" onClick={() => setPanel('modes')} aria-label="Switch combat mode">
        DEV · {modeLabels[mode]}
      </button>
      {phase === 'waiting'
        ? <button type="button" onClick={() => setPhase('enemy')}>Begin</button>
        : <button type="button" onClick={() => onMode(mode)}>Restart</button>}
      {encounter && <button type="button" onClick={onExit}>Return to generator</button>}
    </div>
    <div className="battle-info">
      <MyInfo name={letterGame ? 'LIVES' : 'YOU'} health={game.playerResolve} maxHealth={game.encounter.startingResolve} wyrm={Boolean(letterGame)}
        wyrmRef={wyrmLifeRef} decoding={phase === 'enemy' || phase === 'tiles'} />
      {letterGame && <RefillSupply game={letterGame} decoded={phase === 'ready'} />}
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
        resolveBefore={letterGame && interactive && preview.valid ? game.playerResolve : undefined}
        resolveAfter={letterGame && interactive && preview.valid ? game.playerResolve - preview.resolveCost : undefined}
        recoveryText={'recoveries' in preview && preview.recoveries?.length
          ? `REGEN: ${preview.recoveries.map(hit => `${hit.letter} ${hit.hitsBefore === 0 ? 'returns' : 'gains armour'}`).join(', ')}` : undefined} />
      <div className="controls">
        <TileGrid revealedIndices={revealedTileIndices} registerTile={registerTile}
          ready={interactive} tiles={game.tiles} specialTiles={specialTiles}
          enemyLetters={letterGame?.enemyLetters} matchHint={letterGame ? matchHint : 'off'}
          selectedTileIds={game.selectedTileIds} damage={run.mode === 'damage' ? preview.amount : undefined} canAttack={interactive && preview.valid}
          onToggleTile={select} onClear={clear} onAttack={attack} />
      </div>
    </div>
    <WyrmDecoder phase={phase} containerRef={containerRef} enemyLetters={enemyElements}
      tileElements={tileElements} dockRef={letterGame ? wyrmLifeRef : wyrmDockRef} titleRef={wyrmTitleRef}
      lifeSegments={letterGame ? game.encounter.startingResolve : undefined}
      enemyCount={enemy.word.length} tileCount={game.tiles.length}
      onEnemyReveal={revealEnemyLetter} onTileReveal={revealTile}
      onEnemyDecoded={enemyDecoded} onTilesDecoded={tilesDecoded} />

    {panel === 'modes' && <PlaytestPanel title="Combat playtest" onClose={() => setPanel(null)}>
      <p>Each mode starts a fresh encounter. Playtests do not save to daily history.</p>
      {letterGame && <MatchHintControls value={matchHint} onChange={onMatchHintChange} />}
      <EnemyLayoutControls grid={enemyGrid} onChange={onEnemyGridChange} />
      <div className="dev-controls">
        {(encounter ? ['letter-strike'] as const : ['damage', 'letter-strike'] as const).map(value =>
          <button className="daily-button" key={value} onClick={() => onMode(value)}>{modeLabels[value]}</button>)}
        <button className="daily-button" onClick={onExit}>{encounter ? 'Return to generator' : 'Return to daily game'}</button>
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
      : <PlaytestPanel title="Letter-strike mode" onClose={() => setPanel(null)}>
        <div className="daily-help">
          <div>Remove every enemy letter before your {game.encounter.startingResolve} Resolve run out. Tiles can be selected in any order.</div>
          <div><strong>COUNTER</strong> words strike with every matching tile. <strong>NEUTRAL</strong> words get one normal matching strike, in spelling order. <strong>RESISTED</strong> words have no normal strikes.</div>
          {letterGame?.encounter.longWordRule && <div><strong>LONG +{letterGame.encounter.longWordRule.bonusStrikes}</strong> adds a normal strike allowance for neutral words of {letterGame.encounter.longWordRule.minimumLength}+ letters. It stacks with grammar weaknesses, but does not boost resisted words or counters.</div>}
          <div><strong>STRIKE</strong> guarantees its tile’s matching strike, even on a resisted word, without spending the normal or grammar allowance. Each tile strikes at most once. <strong>WARD</strong> makes the turn free.</div>
          <div>Double outlines need two hits. The first breaks armour; the next removes the letter. Matching tiles finish wounded copies first, then target from left to right.</div>
          <div>Blue − previews an armour break; red × previews removal. Defeated letters become centred dots with no outline. Repeated matching tiles can break and remove one armoured letter in the same word.</div>
          <div>Listed grammar weaknesses add matching-tile allowances: ADJECTIVE +1 lets resisted adjectives strike once and neutral adjectives twice. Counters already use all matching tiles.</div>
          <div>This DEV comparison does not save to daily history.</div>
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
