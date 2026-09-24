import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./App.css"

import Header from "./components/Header"
import { MyInfo, EnemyInfo } from "./components/HealthInfo"
import Enemy from "./components/Enemy"
import AttackInfo from "./components/AttackInfo"
import TileGrid from "./components/TileGrid"
import WyrmDecoder from "./components/WyrmDecoder"
import EncounterHud from "./components/EncounterHud"
import { previewAttack } from "./game/game"
import { getActiveGrammarModifiers, getCurrentTileSummary, getRecentBattleEvents } from "./game/hud"
import { getDailyPuzzleId, validatePuzzleId } from "./daily/date"
import { getDailyPuzzle } from "./daily/puzzle"
import { getOpeningPuzzleId } from "./daily/persistence"
import { useDailyRun } from "./daily/useDailyRun"
import { HelpPanel, HistoryErrorPanel, ResultPanel, StatsPanel } from "./components/DailyPanels"
import "./components/DailyPanels.css"

const DevPanel = import.meta.env.DEV ? lazy(() => import('./components/DevPanel')) : null
const DevCombat = import.meta.env.DEV ? lazy(() => import('./experimental/DevCombat')) : null

type Phase = "waiting" | "enemy" | "tiles" | "ready"
type Panel = 'help' | 'stats' | 'result' | 'dev' | null

export default function App() {
  const [todayId, setTodayId] = useState(() => getDailyPuzzleId(new Date()))
  const [puzzleId, setPuzzleId] = useState(() => {
    const requested = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('puzzle') : null
    try { return requested ? validatePuzzleId(requested) : getOpeningPuzzleId(todayId, window.localStorage) }
    catch { return todayId }
  })
  const [revision, setRevision] = useState(0)
  const [playtestMode, setPlaytestMode] = useState<'damage' | 'letter-strike' | null>(null)

  useEffect(() => {
    const updateDay = () => setTodayId(getDailyPuzzleId(new Date()))
    const timer = window.setInterval(updateDay, 30_000)
    window.addEventListener('focus', updateDay)
    document.addEventListener('visibilitychange', updateDay)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', updateDay)
      document.removeEventListener('visibilitychange', updateDay)
    }
  }, [])

  function loadPuzzle(id: string) {
    setPuzzleId(validatePuzzleId(id))
    setRevision(current => current + 1)
    if (import.meta.env.DEV) {
      const url = new URL(window.location.href)
      url.searchParams.set('puzzle', id)
      window.history.replaceState(null, '', url)
    }
  }

  if (DevCombat && playtestMode) return <Suspense fallback={null}>
    <DevCombat initialMode={playtestMode} onExit={() => setPlaytestMode(null)} />
  </Suspense>

  return <DailyBattle key={`${puzzleId}:${revision}`} puzzleId={puzzleId} todayId={todayId} onLoad={loadPuzzle}
    onPlaytest={setPlaytestMode} />
}

function DailyBattle({ puzzleId, todayId, onLoad, onPlaytest }: {
  puzzleId: string; todayId: string; onLoad: (id: string) => void
  onPlaytest: (mode: 'damage' | 'letter-strike') => void
}) {
  const puzzle = useMemo(() => getDailyPuzzle(puzzleId), [puzzleId])
  const daily = useDailyRun(puzzle)
  const { game, result } = daily
  const [panel, setPanel] = useState<Panel>(null)
  const [resultDismissed, setResultDismissed] = useState(false)
  const visiblePanel = panel ?? (result && !resultDismissed ? 'result' : null)
  const [phase, setPhase] = useState<Phase>("waiting")
  const visiblePhase = daily.resumed ? 'ready' : phase
  const containerRef = useRef<HTMLElement>(null)
  const enemyLetters = useRef<(HTMLDivElement | null)[]>([])
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const wyrmDockRef = useRef<HTMLSpanElement>(null)
  const wyrmTitleRef = useRef<HTMLDivElement>(null)
  const [revealedEnemyIndices, setRevealedEnemyIndices] = useState<number[]>([])
  const [revealedTileIndices, setRevealedTileIndices] = useState<number[]>([])
  const enemy = game.encounter.enemy
  const interactive = visiblePhase === "ready" && game.status === "playing" && !daily.error && !result
  const preview = previewAttack(game)
  const enemyDecoded = useCallback(() => setPhase("tiles"), [])
  const tilesDecoded = useCallback(() => setPhase("ready"), [])
  const registerLetter = useCallback((index: number, element: HTMLDivElement | null) => {
    enemyLetters.current[index] = element
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

  const message = game.status === "won" ? "VICTORY"
    : game.status === "lost" ? "OUT OF RESOLVE"
    : daily.error ? "SAVE UNAVAILABLE"
    : visiblePhase === "waiting" ? "CLICK TO BEGIN"
    : visiblePhase !== "ready" ? "DECODING"
    : game.error ?? (game.selectedTileIds.length > 0 ? preview.error ?? undefined : undefined)

  function begin() {
    if (visiblePhase === "waiting" && daily.start()) setPhase("enemy")
  }

  return (
    <main className="container"
      ref={containerRef}
      onClick={event => {
        if ((event.target as HTMLElement).closest('button, a, input, dialog')) return
        if (visiblePhase === "waiting") begin()
      }}
    >
      <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={visiblePhase === "ready"}
        onHelp={() => setPanel('help')} onHistory={() => setPanel('stats')}
        onSettings={DevPanel ? () => setPanel('dev') : undefined} />

      <div className="daily-meta" onClick={event => event.stopPropagation()}>
        <span>Daily {puzzle.date} · UTC</span>
        {result ? <button type="button" onClick={() => setPanel('result')}>View result</button>
          : visiblePhase === 'waiting' ? <button type="button" onClick={begin} disabled={!!daily.error}>Begin</button>
          : <span>{daily.resumed ? 'Resumed' : 'One attempt'}</span>}
      </div>
      {todayId !== puzzleId && <div className="daily-notice" onClick={event => event.stopPropagation()}>
        <span>{puzzleId < todayId ? 'A new daily puzzle is ready.' : 'Development puzzle date.'}</span>
        <button className="daily-button" onClick={() => onLoad(todayId)}>Play today</button>
      </div>}
      {daily.error && <div className="daily-notice" role="alert" onClick={event => event.stopPropagation()}>
        <span>Progress could not be saved or restored. {daily.error}</span>
        <button className="daily-button" onClick={daily.retry}>Retry local save</button>
        <button className="daily-button" onClick={daily.reloadSaved}>Reload saved run</button>
      </div>}

      <div className="battle-info">
        <MyInfo
          name="YOU"
          health={game.playerResolve}
          maxHealth={game.encounter.startingResolve}
        />

        <EnemyInfo
          name={enemy.word}
          health={game.enemyHp}
          maxHealth={enemy.maxHealth}
        />
      </div>

      <div className="enemy-zone">
        <Enemy
          name={enemy.word}
          partOfSpeech={enemy.partOfSpeech}
          definition={enemy.definition}
          modifiers={getActiveGrammarModifiers(game)}
          revealedIndices={daily.resumed ? [...enemy.word].map((_, index) => index) : revealedEnemyIndices}
          registerLetter={registerLetter}
        />

        <EncounterHud
          visible={visiblePhase === "ready"}
          events={getRecentBattleEvents(game, 2)}
        />
      </div>

      <div className="player-zone">
        <AttackInfo
          word={preview.word}
          damage={preview.totalDamage}
          maxDamage={enemy.maxHealth}
          ready={interactive && preview.valid}
          message={message}
          bonuses={preview.bonuses}
        />

        <div className="controls">
          <TileGrid
            revealedIndices={daily.resumed ? game.tiles.map((_, index) => index) : revealedTileIndices}
            registerTile={registerTile}
            ready={interactive}
            tiles={game.tiles}
            specialTiles={getCurrentTileSummary(game)}
            selectedTileIds={game.selectedTileIds}
            damage={preview.totalDamage}
            canAttack={interactive && preview.valid}
            onToggleTile={id => {
              if (interactive) daily.select(id)
            }}
            onClear={() => {
              if (interactive) daily.clear()
            }}
            onAttack={() => {
              if (interactive) daily.attack()
            }}
          />
        </div>
      </div>

      {!daily.resumed && <WyrmDecoder
        phase={visiblePhase}
        containerRef={containerRef}
        enemyLetters={enemyLetters}
        tileElements={tileElements}
        dockRef={wyrmDockRef}
        titleRef={wyrmTitleRef}
        enemyCount={enemy.word.length}
        tileCount={game.tiles.length}
        onEnemyReveal={revealEnemyLetter}
        onTileReveal={revealTile}
        onEnemyDecoded={enemyDecoded}
        onTilesDecoded={tilesDecoded}
      />}
      {visiblePanel === 'help' && <HelpPanel onClose={() => setPanel(null)} />}
      {visiblePanel === 'result' && result && <ResultPanel result={result}
        onClose={() => { setResultDismissed(true); setPanel(null) }}
        onShowStats={() => { setResultDismissed(true); setPanel('stats') }} />}
      {visiblePanel === 'stats' && (daily.history.error
        ? <HistoryErrorPanel error={daily.history.error} onClose={() => setPanel(null)} />
        : <StatsPanel results={daily.history.results} todayId={todayId}
            inProgressIds={daily.history.inProgressIds} onResume={onLoad} onClose={() => setPanel(null)} />)}
      {visiblePanel === 'dev' && DevPanel && <Suspense fallback={null}>
        <DevPanel puzzle={puzzle} onLoad={onLoad} onPlaytest={onPlaytest} onClose={() => setPanel(null)} />
      </Suspense>}
    </main>
  )
}
