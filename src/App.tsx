import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./App.css"

import Header from "./components/Header"
import { MyInfo } from "./components/HealthInfo"
import RefillSupply from './components/RefillSupply'
import Enemy from "./components/Enemy"
import AttackInfo from "./components/AttackInfo"
import TileGrid from "./components/TileGrid"
import type { MatchHintMode } from './components/tileMatchHints'
import WyrmDecoder from "./components/WyrmDecoder"
import { previewLetterStrike } from "./game/letterStrike"
import { getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from "./game/letterStrikeHud"
import { getDailyPuzzleId, validatePuzzleId } from "./daily/date"
import { getDailyPuzzle } from "./daily/puzzle"
import { getOpeningPuzzleId, getRunStorageKey, getResultStorageKey, resetDailyPuzzle } from "./daily/persistence"
import { useDailyRun } from "./daily/useDailyRun"
import { HelpPanel, HistoryErrorPanel, LogPanel, ResultPanel, SettingsPanel, StatsPanel } from "./components/DailyPanels"
import ModeSelection from './components/ModeSelection'
import { getOnboardingStage } from './preferences'
import { useUserPreferences } from './useUserPreferences'
import type { DifficultyMode } from './daily/types'
import type { CandidatePuzzle } from './generator/types'
import type { TutorialStep } from './tutorial/tutorial'
import "./components/DailyPanels.css"

const DevPanel = import.meta.env.DEV ? lazy(() => import('./components/DevPanel')) : null
const DevCombat = import.meta.env.DEV ? lazy(() => import('./experimental/DevCombat')) : null
const DevGenerator = import.meta.env.DEV ? lazy(() => import('./generator/DevGenerator')) : null
const TutorialBattle = lazy(() => import('./tutorial/TutorialBattle'))
const BingoPreview = lazy(() => import('./experimental/BingoPreview'))

type Phase = "waiting" | "enemy" | "tiles" | "ready"
type Panel = 'help' | 'log' | 'stats' | 'result' | 'settings' | 'dev' | null
type OnboardingAction = 'replay' | 'tutorial' | 'reset' | 'preview'

export default function App() {
  // The preview mounts before preferences or daily hooks: it cannot start,
  // overwrite or complete a daily attempt, even in a returning player's tab.
  if (new URLSearchParams(window.location.search).get('preview') === 'bingo') {
    return <Suspense fallback={<main className="container"><p>Loading beta puzzle…</p></main>}>
      <BingoPreview />
    </Suspense>
  }
  return <DailyApp />
}

function DailyApp() {
  const user = useUserPreferences()
  const [onboarding, setOnboarding] = useState(() => getOnboardingStage(user.preferences))
  const [tutorialCompleted, setTutorialCompleted] = useState(false)
  const [tutorialOnly, setTutorialOnly] = useState(user.preferences.hasChosenMode)
  const [initialTutorialStep, setInitialTutorialStep] = useState<TutorialStep | undefined>()
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
  const [generatorOpen, setGeneratorOpen] = useState(() => import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('generator') === '1')
  const [generatedCandidate, setGeneratedCandidate] = useState<CandidatePuzzle | null>(null)
  const [matchHint, setMatchHint] = useState<MatchHintMode>('off')
  const [enemyGrid, setEnemyGrid] = useState(false)

  useEffect(() => {
    // A beta reset in another tab also discards this tab's transient UI and pending turn.
    const onReset = (event: StorageEvent) => {
      if (event.newValue === null && (event.key === null
        || event.key === getRunStorageKey(puzzleId) || event.key === getResultStorageKey(puzzleId))) {
        setRevision(current => current + 1)
      }
    }
    window.addEventListener('storage', onReset)
    return () => window.removeEventListener('storage', onReset)
  }, [puzzleId])

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
    if (!previewOnboarding && !user.preferences.hasCompletedOnboarding) user.update({ hasCompletedOnboarding: true })
    if (tutorialOnly) { setOnboarding(null); return }
    setTutorialCompleted(completed)
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
    setInitialTutorialStep(undefined)
    setPreviewOnboarding(action === 'preview')
    setTutorialCompleted(false)
    setChoice(action === 'preview' ? 'normal' : user.preferences.preferredMode)
    setOnboarding('tutorial')
  }

  function replayTutorial(step?: string) {
    setInitialTutorialStep(step as TutorialStep | undefined)
    setTutorialOnly(true)
    setPreviewOnboarding(false)
    setOnboarding('tutorial')
  }

  function resetTutorial() {
    user.update({ hasCompletedOnboarding: false })
    replayTutorial()
  }

  if (DevGenerator && generatorOpen) return <Suspense fallback={<main className="container"><p>Loading generator…</p></main>}>
    <DevGenerator onClose={() => setGeneratorOpen(false)} onPlay={candidate => {
      setGeneratedCandidate(candidate); setGeneratorOpen(false); setPlaytestMode('letter-strike')
    }} />
  </Suspense>
  if (DevCombat && playtestMode && generatedCandidate) return <Suspense fallback={null}>
    <DevCombat key={generatedCandidate.id} initialMode="letter-strike" encounter={generatedCandidate.encounter}
      onExit={() => { setPlaytestMode(null); setGeneratedCandidate(null); setGeneratorOpen(true) }}
      matchHint={matchHint} onMatchHintChange={setMatchHint}
      enemyGrid={enemyGrid} onEnemyGridChange={setEnemyGrid} />
  </Suspense>

  if (onboarding === 'tutorial') return <Suspense fallback={<main className="container"><p>Loading tutorial…</p></main>}>
    <TutorialBattle key={initialTutorialStep ?? 'goal'} initialStep={initialTutorialStep} onComplete={() => finishTutorial(true)} onSkip={() => finishTutorial(false)} />
  </Suspense>
  if (onboarding === 'mode') return <ModeSelection value={choice} onChange={setChoice} onPlay={playDaily}
    completedTutorial={tutorialCompleted} error={user.error} />

  if (DevCombat && playtestMode) return <Suspense fallback={null}>
    <DevCombat initialMode={playtestMode} onExit={() => setPlaytestMode(null)}
      matchHint={matchHint} onMatchHintChange={setMatchHint}
      enemyGrid={enemyGrid} onEnemyGridChange={setEnemyGrid} />
  </Suspense>

  return <DailyBattle key={`${puzzleId}:${revision}`} puzzleId={puzzleId} todayId={todayId} onLoad={loadPuzzle}
    onPlaytest={setPlaytestMode} onGenerator={() => setGeneratorOpen(true)} matchHint={matchHint} onMatchHintChange={setMatchHint}
    enemyGrid={import.meta.env.DEV && enemyGrid} onEnemyGridChange={setEnemyGrid}
    preferredMode={user.preferences.preferredMode} onChangeMode={mode => user.update({ preferredMode: mode })}
    preferencesError={user.error} onDevOnboarding={devOnboarding} devModeOverride={devModeOverride}
    onForceMode={setDevModeOverride} onReplayTutorial={() => replayTutorial()} onResetTutorial={resetTutorial} onTutorialStep={replayTutorial} />
}

function DailyBattle({ puzzleId, todayId, onLoad, onPlaytest, onGenerator, matchHint, onMatchHintChange,
  enemyGrid, onEnemyGridChange, preferredMode, onChangeMode, preferencesError, onDevOnboarding, devModeOverride, onForceMode, onReplayTutorial, onResetTutorial, onTutorialStep }: {
  puzzleId: string; todayId: string; onLoad: (id: string) => void
  onPlaytest: (mode: 'damage' | 'letter-strike') => void
  onGenerator: () => void
  matchHint: MatchHintMode; onMatchHintChange: (mode: MatchHintMode) => void
  enemyGrid: boolean; onEnemyGridChange: (grid: boolean) => void
  preferredMode: DifficultyMode; onChangeMode: (mode: DifficultyMode) => void
  preferencesError: string | null; onDevOnboarding: (action: OnboardingAction) => void
  devModeOverride: DifficultyMode | null; onForceMode: (mode: DifficultyMode | null) => void
  onReplayTutorial: () => void
  onResetTutorial: () => void
  onTutorialStep: (step: string) => void
}) {
  const puzzle = useMemo(() => getDailyPuzzle(puzzleId), [puzzleId])
  const daily = useDailyRun(puzzle, preferredMode)
  const displayMode = import.meta.env.DEV && devModeOverride ? devModeOverride : daily.mode
  const { game, result } = daily
  const [panel, setPanel] = useState<Panel>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resultDismissed, setResultDismissed] = useState(false)
  const [resolvedTurnCount, setResolvedTurnCount] = useState(game.playedWords.length)
  const [undoEpoch, setUndoEpoch] = useState(0)
  const resolving = game.playedWords.length > resolvedTurnCount
  const resolutionComplete = useCallback(() => setResolvedTurnCount(game.playedWords.length), [game.playedWords.length])
  const visiblePanel = panel ?? (result && !resultDismissed && !resolving ? 'result' : null)
  const [phase, setPhase] = useState<Phase>("waiting")
  const visiblePhase = daily.resumed ? 'ready' : phase
  const containerRef = useRef<HTMLElement>(null)
  const enemyLetters = useRef<(HTMLDivElement | null)[]>([])
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const refillElements = useRef<(HTMLSpanElement | null)[]>([])
  const wyrmDockRef = useRef<HTMLSpanElement>(null)
  const wyrmLifeRef = useRef<HTMLSpanElement>(null)
  const wyrmTitleRef = useRef<HTMLDivElement>(null)
  const [revealedEnemyIndices, setRevealedEnemyIndices] = useState<number[]>([])
  const [revealedTileIndices, setRevealedTileIndices] = useState<number[]>([])
  const [revealedRefills, setRevealedRefills] = useState<boolean[]>([])
  const enemy = game.encounter.enemy
  const interactive = visiblePhase === "ready" && game.status === "playing" && !daily.error && !result && !resolving
  const preview = previewLetterStrike(game)
  function undoTurn() {
    if (!resolving && daily.undo()) {
      setResolvedTurnCount(Math.max(0, game.playedWords.length - 1))
      setUndoEpoch(value => value + 1)
      setPanel(null)
    }
  }
  // Also handle an undo restored by another tab, before rendering its board.
  if (game.playedWords.length < resolvedTurnCount) {
    setResolvedTurnCount(game.playedWords.length)
    setUndoEpoch(value => value + 1)
  }
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

  const message = resolving ? undefined
    : game.status === "won" ? "VICTORY"
    : game.status === "lost" ? game.playerResolve > 0 ? "NO PLAYABLE WORDS" : "OUT OF LIVES"
    : daily.error ? "SAVE UNAVAILABLE"
    : visiblePhase === "waiting" ? "CLICK TO BEGIN"
    : visiblePhase !== "ready" ? "DECODING"
    : game.error ?? (game.selectedTileIds.length > 0 ? preview.error ?? undefined : undefined)

  function begin() {
    if (visiblePhase === "waiting" && daily.start()) setPhase("enemy")
  }

  return (
    <main className="container letter-combat" data-combat-mode="letter-strike" data-difficulty={displayMode}
      data-enemy-grid={import.meta.env.DEV && enemyGrid || undefined}
      ref={containerRef}
      onClick={event => {
        if ((event.target as HTMLElement).closest('button, a, input, dialog')) return
        if (visiblePhase === "waiting") begin()
      }}
    >
      <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={false}
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
          name="LIVES"
          health={game.playerResolve}
          maxHealth={game.encounter.startingResolve}
          wyrmRef={wyrmLifeRef}
          decoding={visiblePhase === 'enemy' || visiblePhase === 'tiles'}
        />
        <RefillSupply game={game} decoded={visiblePhase === 'ready'} revealed={revealedRefills} registerTile={registerRefill} />
        {!daily.started && puzzle.difficulty && <span className="daily-puzzle-difficulty">TODAY · DIFFICULTY: {puzzle.difficulty}</span>}
      </div>

      <div className="enemy-zone" data-grid-preview={import.meta.env.DEV && enemyGrid || undefined}>
        <Enemy
          name={enemy.word}
          partOfSpeech={enemy.partOfSpeech}
          definition={enemy.definition}
          hideDefinition={displayMode !== 'normal'}
          modifiers={getLetterStrikeGrammarModifiers(game)}
          modifierUnit="STRIKE"
          experimentalGrid={enemyGrid}
          introFinished={visiblePhase === 'ready'}
          letterStates={game.enemyLetters}
          predictedHits={interactive && preview.valid ? preview.hits : []}
          predictedRecoveries={interactive && preview.valid ? preview.recoveries : undefined}
          resolvedHits={resolving ? game.playedWords.at(-1)?.preview.hits : undefined}
          resolvedRecoveries={resolving ? game.playedWords.at(-1)?.preview.recoveries : undefined}
          resolutionKey={resolving ? `${undoEpoch}:${game.playedWords.length}` : undefined}
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
          strikePreview={preview}
          enemyWord={enemy.word}
          resolveBefore={interactive && preview.valid ? game.playerResolve : undefined}
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
        refillElements={refillElements}
        dockRef={wyrmLifeRef}
        lifeSegments={game.encounter.startingResolve}
        enemyCount={enemy.word.length}
        tileCount={game.tiles.length}
        onEnemyReveal={revealEnemyLetter}
        onTileReveal={revealTile}
        onRefillReveal={revealRefill}
        onEnemyDecoded={enemyDecoded}
        onTilesDecoded={tilesDecoded}
      />}
      {visiblePanel === 'help' && <HelpPanel strikeConsumesAllowance={game.encounter.strikeConsumesAllowance}
        finiteRefills={game.encounter.finiteRefills}
        anyRecognizedGrammar={Boolean(game.encounter.lexicalRules)}
        hasGrammarModifiers={Object.values(game.encounter.grammarModifiers ?? {}).some(value => value !== 0)}
        definitionBacked={Boolean(game.encounter.meaningLexicon)}
        longWordRule={game.encounter.longWordRule} onReplayTutorial={onReplayTutorial} onClose={() => setPanel(null)} />}
      {visiblePanel === 'log' && <LogPanel game={game} date={puzzle.date}
        onUndo={undoTurn} canUndo={daily.canUndo && !resolving} undosRemaining={daily.undosRemaining} undosUsed={daily.undosUsed}
        onClose={() => setPanel(null)} onShowStats={() => setPanel('stats')} />}
      {visiblePanel === 'result' && result && <ResultPanel result={result}
        onClose={() => { setResultDismissed(true); setPanel(null) }}
        onShowStats={() => { setResultDismissed(true); setPanel('stats') }} />}
      {visiblePanel === 'stats' && (daily.history.error
        ? <HistoryErrorPanel error={daily.history.error} onClose={() => setPanel(null)} />
        : <StatsPanel results={daily.history.results} todayId={todayId}
            inProgressIds={daily.history.inProgressIds} onResume={onLoad} onClose={() => setPanel(null)} />)}
      {visiblePanel === 'settings' && <SettingsPanel preferredMode={preferredMode} runMode={daily.mode}
        onResetTutorial={onResetTutorial}
        onResetPuzzle={() => {
          try {
            resetDailyPuzzle(puzzleId, window.localStorage)
            onLoad(puzzleId)
          } catch {
            setResetError('Could not reset this puzzle. Please try again.')
          }
        }}
        started={daily.started} onChangeMode={onChangeMode} error={resetError ?? preferencesError}
        onDev={DevPanel ? () => setPanel('dev') : undefined} onClose={() => setPanel(null)} />}
      {visiblePanel === 'dev' && DevPanel && <Suspense fallback={null}>
        <DevPanel puzzle={puzzle} onLoad={onLoad} onPlaytest={onPlaytest} onGenerator={onGenerator} onClose={() => setPanel(null)}
          matchHint={matchHint} onMatchHintChange={onMatchHintChange} onOnboarding={onDevOnboarding}
          enemyGrid={enemyGrid} onEnemyGridChange={onEnemyGridChange}
          onForceMode={onForceMode} onTutorialStep={onTutorialStep}
          onSetUndosUsed={daily.setUndosUsed} undosUsed={daily.undosUsed} undoLimit={daily.undoLimit} />
      </Suspense>}
    </main>
  )
}
