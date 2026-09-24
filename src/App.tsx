import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./App.css"

import Header from "./components/Header"
import { MyInfo } from "./components/HealthInfo"
import Enemy from "./components/Enemy"
import AttackInfo from "./components/AttackInfo"
import TileGrid from "./components/TileGrid"
import type { MatchHintMode } from './components/tileMatchHints'
import WyrmDecoder from "./components/WyrmDecoder"
import { previewLetterStrike } from "./game/letterStrike"
import { getLetterStrikeBonuses, getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from "./game/letterStrikeHud"
import { getDailyPuzzleId, validatePuzzleId } from "./daily/date"
import { getDailyPuzzle } from "./daily/puzzle"
import { getOpeningPuzzleId } from "./daily/persistence"
import { useDailyRun } from "./daily/useDailyRun"
import { HelpPanel, HistoryErrorPanel, LogPanel, ResultPanel, SettingsPanel, StatsPanel } from "./components/DailyPanels"
import ModeSelection from './components/ModeSelection'
import { getOnboardingStage } from './preferences'
import { useUserPreferences } from './useUserPreferences'
import type { DifficultyMode } from './daily/types'
import "./components/DailyPanels.css"

const DevPanel = import.meta.env.DEV ? lazy(() => import('./components/DevPanel')) : null
const DevCombat = import.meta.env.DEV ? lazy(() => import('./experimental/DevCombat')) : null
const TutorialBattle = lazy(() => import('./tutorial/TutorialBattle'))

type Phase = "waiting" | "enemy" | "tiles" | "ready"
type Panel = 'help' | 'log' | 'stats' | 'result' | 'settings' | 'dev' | null
type OnboardingAction = 'replay' | 'tutorial' | 'reset' | 'preview'

export default function App() {
  const user = useUserPreferences()
  const [onboarding, setOnboarding] = useState(() => getOnboardingStage(user.preferences))
  const [tutorialCompleted, setTutorialCompleted] = useState(false)
  const [tutorialOnly, setTutorialOnly] = useState(false)
  const [previewOnboarding, setPreviewOnboarding] = useState(false)
  const [choice, setChoice] = useState<DifficultyMode>(user.preferences.preferredMode)
  const [devModeOverride, setDevModeOverride] = useState<DifficultyMode | null>(null)
  const [todayId, setTodayId] = useState(() => getDailyPuzzleId(new Date()))
  const [puzzleId, setPuzzleId] = useState(() => {
    const requested = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('puzzle') : null
    try { return requested ? validatePuzzleId(requested) : getOpeningPuzzleId(todayId, window.localStorage) }
    catch { return todayId }
  })
  const [revision, setRevision] = useState(0)
  const [playtestMode, setPlaytestMode] = useState<'damage' | 'letter-strike' | null>(null)
  const [matchHint, setMatchHint] = useState<MatchHintMode>('off')

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

  function finishTutorial(completed: boolean) {
    if (tutorialOnly) { setOnboarding(null); return }
    setTutorialCompleted(completed)
    if (!previewOnboarding) user.update({ hasCompletedOnboarding: true })
    setOnboarding('mode')
  }

  function playDaily() {
    if (!previewOnboarding) {
      user.update({ preferredMode: choice, hasCompletedOnboarding: true, hasChosenMode: true })
      loadPuzzle(todayId)
    }
    setOnboarding(null)
  }

  function devOnboarding(action: OnboardingAction) {
    if (!import.meta.env.DEV) return
    if (action === 'reset') {
      user.update({ hasCompletedOnboarding: false, hasChosenMode: false })
      return
    }
    setTutorialOnly(action === 'tutorial')
    setPreviewOnboarding(action === 'preview')
    setTutorialCompleted(false)
    setChoice(action === 'preview' ? 'normal' : user.preferences.preferredMode)
    setOnboarding('tutorial')
  }

  if (onboarding === 'tutorial') return <Suspense fallback={<main className="container"><p>Loading tutorial…</p></main>}>
    <TutorialBattle onComplete={() => finishTutorial(true)} onSkip={() => finishTutorial(false)} />
  </Suspense>
  if (onboarding === 'mode') return <ModeSelection value={choice} onChange={setChoice} onPlay={playDaily}
    completedTutorial={tutorialCompleted} error={user.error} />

  if (DevCombat && playtestMode) return <Suspense fallback={null}>
    <DevCombat initialMode={playtestMode} onExit={() => setPlaytestMode(null)}
      matchHint={matchHint} onMatchHintChange={setMatchHint} />
  </Suspense>

  return <DailyBattle key={`${puzzleId}:${revision}`} puzzleId={puzzleId} todayId={todayId} onLoad={loadPuzzle}
    onPlaytest={setPlaytestMode} matchHint={matchHint} onMatchHintChange={setMatchHint}
    preferredMode={user.preferences.preferredMode} onChangeMode={mode => user.update({ preferredMode: mode })}
    preferencesError={user.error} onDevOnboarding={devOnboarding} devModeOverride={devModeOverride}
    onForceMode={setDevModeOverride} />
}

function DailyBattle({ puzzleId, todayId, onLoad, onPlaytest, matchHint, onMatchHintChange,
  preferredMode, onChangeMode, preferencesError, onDevOnboarding, devModeOverride, onForceMode }: {
  puzzleId: string; todayId: string; onLoad: (id: string) => void
  onPlaytest: (mode: 'damage' | 'letter-strike') => void
  matchHint: MatchHintMode; onMatchHintChange: (mode: MatchHintMode) => void
  preferredMode: DifficultyMode; onChangeMode: (mode: DifficultyMode) => void
  preferencesError: string | null; onDevOnboarding: (action: OnboardingAction) => void
  devModeOverride: DifficultyMode | null; onForceMode: (mode: DifficultyMode | null) => void
}) {
  const puzzle = useMemo(() => getDailyPuzzle(puzzleId), [puzzleId])
  const daily = useDailyRun(puzzle, preferredMode)
  const displayMode = import.meta.env.DEV && devModeOverride ? devModeOverride : daily.mode
  const { game, result } = daily
  const [panel, setPanel] = useState<Panel>(null)
  const [resultDismissed, setResultDismissed] = useState(false)
  const [resolvedTurnCount, setResolvedTurnCount] = useState(game.playedWords.length)
  const resolving = game.playedWords.length > resolvedTurnCount
  const resolutionComplete = useCallback(() => setResolvedTurnCount(game.playedWords.length), [game.playedWords.length])
  const visiblePanel = panel ?? (result && !resultDismissed && !resolving ? 'result' : null)
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
  const interactive = visiblePhase === "ready" && game.status === "playing" && !daily.error && !result && !resolving
  const preview = previewLetterStrike(game)
  const primaryLabel = result ? 'VIEW RESULT' : visiblePhase === 'waiting' ? 'BEGIN' : 'ATTACK'
  const primaryEnabled = result ? !resolving
    : visiblePhase === 'waiting' ? !daily.error
    : interactive && preview.valid
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

  const message = resolving ? undefined
    : game.status === "won" ? "VICTORY"
    : game.status === "lost" ? "OUT OF RESOLVE"
    : daily.error ? "SAVE UNAVAILABLE"
    : visiblePhase === "waiting" ? "CLICK TO BEGIN"
    : visiblePhase !== "ready" ? "DECODING"
    : game.error ?? (game.selectedTileIds.length > 0 ? preview.error ?? undefined : undefined)

  function begin() {
    if (visiblePhase === "waiting" && daily.start()) setPhase("enemy")
  }

  return (
    <main className="container letter-combat" data-combat-mode="letter-strike" data-difficulty={displayMode}
      ref={containerRef}
      onClick={event => {
        if ((event.target as HTMLElement).closest('button, a, input, dialog')) return
        if (visiblePhase === "waiting") begin()
      }}
    >
      <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={visiblePhase === "ready"}
        onHelp={() => setPanel('help')} onHistory={() => setPanel('log')}
        onSettings={() => setPanel('settings')} />

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
          name="RESOLVE"
          health={game.playerResolve}
          maxHealth={game.encounter.startingResolve}
        />
      </div>

      <div className="enemy-zone">
        <Enemy
          name={enemy.word}
          partOfSpeech={enemy.partOfSpeech}
          definition={enemy.definition}
          hideDefinition={displayMode === 'hard'}
          modifiers={getLetterStrikeGrammarModifiers(game)}
          modifierUnit="STRIKE"
          letterStates={game.enemyLetters}
          predictedHits={interactive && preview.valid ? preview.hits : []}
          resolvedHits={resolving ? game.playedWords.at(-1)?.preview.hits : undefined}
          resolutionKey={resolving ? game.playedWords.length : undefined}
          onResolutionComplete={resolutionComplete}
          revealedIndices={daily.resumed ? [...enemy.word].map((_, index) => index) : revealedEnemyIndices}
          registerLetter={registerLetter}
        />
      </div>

      <div className="player-zone">
        <AttackInfo
          word={preview.word}
          damage={preview.strikes}
          maxDamage={0}
          metric="strikes"
          ready={interactive && preview.valid}
          message={message}
          bonuses={getLetterStrikeBonuses(preview)}
        />

        <div className="controls">
          <TileGrid
            revealedIndices={daily.resumed ? game.tiles.map((_, index) => index) : revealedTileIndices}
            registerTile={registerTile}
            ready={interactive}
            tiles={game.tiles}
            enemyLetters={game.enemyLetters}
            matchHint={matchHint}
            specialTiles={getLetterStrikeTileSummary(game)}
            selectedTileIds={game.selectedTileIds}
            primaryLabel={primaryLabel}
            canAttack={primaryEnabled}
            onToggleTile={id => {
              if (interactive) daily.select(id)
            }}
            onClear={() => {
              if (interactive) daily.clear()
            }}
            onAttack={() => {
              if (result) {
                if (!resolving) setPanel('result')
                return
              }
              if (visiblePhase === 'waiting') {
                if (!daily.error) begin()
                return
              }
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
      {visiblePanel === 'help' && <HelpPanel strikeConsumesAllowance={game.encounter.strikeConsumesAllowance}
        longWordRule={game.encounter.longWordRule} onClose={() => setPanel(null)} />}
      {visiblePanel === 'log' && <LogPanel game={game} date={puzzle.date}
        onClose={() => setPanel(null)} onShowStats={() => setPanel('stats')} />}
      {visiblePanel === 'result' && result && <ResultPanel result={result}
        onClose={() => { setResultDismissed(true); setPanel(null) }}
        onShowStats={() => { setResultDismissed(true); setPanel('stats') }} />}
      {visiblePanel === 'stats' && (daily.history.error
        ? <HistoryErrorPanel error={daily.history.error} onClose={() => setPanel(null)} />
        : <StatsPanel results={daily.history.results} todayId={todayId}
            inProgressIds={daily.history.inProgressIds} onResume={onLoad} onClose={() => setPanel(null)} />)}
      {visiblePanel === 'settings' && <SettingsPanel preferredMode={preferredMode} runMode={daily.mode}
        started={daily.started} onChangeMode={onChangeMode} error={preferencesError}
        onDev={DevPanel ? () => setPanel('dev') : undefined} onClose={() => setPanel(null)} />}
      {visiblePanel === 'dev' && DevPanel && <Suspense fallback={null}>
        <DevPanel puzzle={puzzle} onLoad={onLoad} onPlaytest={onPlaytest} onClose={() => setPanel(null)}
          matchHint={matchHint} onMatchHintChange={onMatchHintChange} onOnboarding={onDevOnboarding}
          onForceMode={onForceMode} />
      </Suspense>}
    </main>
  )
}
