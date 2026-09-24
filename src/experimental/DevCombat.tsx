import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Header from '../components/Header'
import { MyInfo, EnemyInfo } from '../components/HealthInfo'
import Enemy from '../components/Enemy'
import AttackInfo from '../components/AttackInfo'
import TileGrid from '../components/TileGrid'
import EncounterHud from '../components/EncounterHud'
import WyrmDecoder from '../components/WyrmDecoder'
import { HelpPanel } from '../components/DailyPanels'
import { createGame, toggleTile, clearSelection, previewAttack, submitWord } from '../game/game'
import { melancholyEncounter } from '../game/encounters'
import { getActiveGrammarModifiers, getCurrentTileSummary, getRecentBattleEvents } from '../game/hud'
import type { GameState } from '../game/types'
import {
  createLetterStrikeGame, toggleLetterStrikeTile, clearLetterStrikeSelection,
  previewLetterStrike, submitLetterStrike,
} from './letterStrike'
import type { LetterStrikeState } from './letterStrike'
import { getMaximumImmediateStrikes } from './maxStrikes'
import './DevCombat.css'

type CombatMode = 'damage' | 'letter-strike'
type Run = { mode: 'damage'; game: GameState } | { mode: 'letter-strike'; game: LetterStrikeState }
type Phase = 'waiting' | 'enemy' | 'tiles' | 'ready'
type Panel = 'help' | 'log' | 'modes' | null

const modeLabels = { damage: 'DAMAGE MODE', 'letter-strike': 'LETTER-STRIKE MODE' }

// This entire entry point is lazy-loaded only in DEV. Playtests never call the
// daily hook or storage; a keyed remount discards all state on every mode change.
export default function DevCombat({ initialMode, onExit }: {
  initialMode: CombatMode; onExit: () => void
}) {
  const [session, setSession] = useState({ mode: initialMode, revision: 0 })
  if (!import.meta.env.DEV) return null
  return <PlaytestBattle key={`${session.mode}:${session.revision}`} mode={session.mode}
    onMode={mode => setSession(current => ({ mode, revision: current.revision + 1 }))}
    onExit={onExit} />
}

function PlaytestBattle({ mode, onMode, onExit }: {
  mode: CombatMode; onMode: (mode: CombatMode) => void; onExit: () => void
}) {
  const [run, setRun] = useState<Run>(() => mode === 'damage'
    ? { mode, game: createGame(melancholyEncounter) }
    : { mode, game: createLetterStrikeGame() })
  const [phase, setPhase] = useState<Phase>('waiting')
  const [panel, setPanel] = useState<Panel>(null)
  const containerRef = useRef<HTMLElement>(null)
  const enemyElements = useRef<(HTMLDivElement | null)[]>([])
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const wyrmDockRef = useRef<HTMLSpanElement>(null)
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
  const strikeTiles = letterGame?.tiles
  const strikeEnemy = letterGame?.enemyLetters
  const strikeEncounter = letterGame?.encounter
  const strikeStatus = letterGame?.status
  // Selection changes do not change which complete words are available.
  const maximumStrikes = useMemo(() => strikeTiles && strikeEnemy && strikeEncounter && strikeStatus
    ? getMaximumImmediateStrikes({ tiles: strikeTiles, enemyLetters: strikeEnemy, encounter: strikeEncounter, status: strikeStatus })
    : 0, [strikeTiles, strikeEnemy, strikeEncounter, strikeStatus])
  const game = run.game
  const enemy = game.encounter.enemy
  const interactive = phase === 'ready' && game.status === 'playing'
  const preview = run.mode === 'damage' ? (() => {
    const attack = previewAttack(run.game)
    return { ...attack, amount: attack.totalDamage, maximum: run.game.encounter.enemy.maxHealth }
  })() : (() => {
    const attack = previewLetterStrike(run.game)
    return {
      ...attack, amount: attack.strikes, maximum: maximumStrikes,
      bonuses: attack.valid
        ? [attack.semanticLabel, ...attack.effectLabels].map(label => ({ label })) : [],
    }
  })()
  const metric = run.mode === 'damage' ? 'damage' : 'strikes'
  const events = run.mode === 'damage' ? getRecentBattleEvents(run.game) : run.game.playedWords
    .map((attack, index) => ({
      id: index, word: attack.word, damage: attack.strikes,
      semanticLabel: attack.semanticLabel, effectLabels: attack.effectLabels,
    })).reverse()
  const specialTiles = run.mode === 'damage' ? getCurrentTileSummary(run.game)
    : Object.entries(run.game.encounter.tileEffects).map(([id, rule]) => ({
      id, label: id.toUpperCase(), symbol: id === 'ward' ? '◇' : '◆',
      detail: [rule.strike ? 'MATCHING LETTER STRIKE' : '', rule.preventResolveLoss ? 'SAVE RESOLVE' : '']
        .filter(Boolean).join(' · '),
    }))
  const message = game.status === 'won' ? 'VICTORY'
    : game.status === 'lost' ? 'OUT OF RESOLVE'
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

  return <main className="container dev-combat" data-combat-mode={mode} ref={containerRef}
    onClick={event => {
      if ((event.target as HTMLElement).closest('button, a, input, dialog')) return
      if (phase === 'waiting') setPhase('enemy')
    }}>
    <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={phase === 'ready'}
      onHelp={() => setPanel('help')} onHistory={() => setPanel('log')} onSettings={() => setPanel('modes')} />
    <div className="daily-meta">
      <button type="button" onClick={() => setPanel('modes')} aria-label="Switch combat mode">
        DEV · {modeLabels[mode]}
      </button>
      {phase === 'waiting'
        ? <button type="button" onClick={() => setPhase('enemy')}>Begin</button>
        : <button type="button" onClick={() => onMode(mode)}>Restart</button>}
    </div>
    <div className="battle-info">
      <MyInfo name="YOU" health={game.playerResolve} maxHealth={game.encounter.startingResolve} />
      {run.mode === 'damage'
        ? <EnemyInfo name={enemy.word} health={run.game.enemyHp} maxHealth={run.game.encounter.enemy.maxHealth} />
        : <div className="health-info">
          <div className="name">ENEMY LETTERS</div>
          <div className="health">{run.game.enemyLetters.filter(letter => letter.hitsRemaining > 0).length} LEFT</div>
        </div>}
    </div>
    <div className="enemy-zone">
      <Enemy name={enemy.word} definition={enemy.definition} partOfSpeech={enemy.partOfSpeech}
        modifiers={run.mode === 'damage' ? getActiveGrammarModifiers(run.game) : []}
        letterStates={letterGame?.enemyLetters}
        revealedIndices={revealedEnemyIndices} registerLetter={registerLetter} />
      <EncounterHud visible={phase === 'ready'} events={events.slice(0, 2)} metric={metric} />
    </div>
    <div className="player-zone">
      <AttackInfo word={preview.word} damage={preview.amount} maxDamage={preview.maximum}
        metric={metric} ready={interactive && preview.valid} message={message} bonuses={preview.bonuses} />
      <div className="controls">
        <TileGrid revealedIndices={revealedTileIndices} registerTile={registerTile}
          ready={interactive} tiles={game.tiles} specialTiles={specialTiles}
          selectedTileIds={game.selectedTileIds} damage={preview.amount} canAttack={interactive && preview.valid}
          onToggleTile={select} onClear={clear} onAttack={attack} />
      </div>
    </div>
    <WyrmDecoder phase={phase} containerRef={containerRef} enemyLetters={enemyElements}
      tileElements={tileElements} dockRef={wyrmDockRef} titleRef={wyrmTitleRef}
      enemyCount={enemy.word.length} tileCount={game.tiles.length}
      onEnemyReveal={revealEnemyLetter} onTileReveal={revealTile}
      onEnemyDecoded={enemyDecoded} onTilesDecoded={tilesDecoded} />

    {panel === 'modes' && <PlaytestPanel title="Combat playtest" onClose={() => setPanel(null)}>
      <p>Each mode starts a fresh encounter. Playtests do not save to daily history.</p>
      <div className="dev-controls">
        {(['damage', 'letter-strike'] as const).map(value =>
          <button className="daily-button" key={value} onClick={() => onMode(value)}>{modeLabels[value]}</button>)}
        <button className="daily-button" onClick={onExit}>Return to daily game</button>
      </div>
    </PlaytestPanel>}
    {panel === 'log' && <PlaytestPanel title="Playtest log" onClose={() => setPanel(null)}>
      {events.length > 0 ? <div className="dev-combat-log"><EncounterHud visible events={events} metric={metric} /></div>
        : <p>No submitted words in this attempt.</p>}
    </PlaytestPanel>}
    {panel === 'help' && (run.mode === 'damage' ? <HelpPanel onClose={() => setPanel(null)} />
      : <PlaytestPanel title="Letter-strike mode" onClose={() => setPanel(null)}>
        <div className="daily-help">
          <div>Remove every enemy letter before your five Resolve run out. Tiles can be selected in any order.</div>
          <div><strong>COUNTER</strong> words strike with every matching tile. <strong>NEUTRAL</strong> words strike with only the first matching tile in your spelling. <strong>RESISTED</strong> words have no normal strikes.</div>
          <div><strong>STRIKE</strong> guarantees its tile’s matching strike, even on a resisted word. Each tile strikes at most once. <strong>WARD</strong> makes the turn free.</div>
          <div>Double outlines need two hits. The first breaks armour; the next removes the letter. Matching tiles finish wounded copies first, then target from left to right.</div>
          <div>The charge bar compares this word’s strikes with the maximum immediate strikes available on this board.</div>
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
