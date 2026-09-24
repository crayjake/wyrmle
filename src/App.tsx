import { useCallback, useRef, useState } from "react"
import "./App.css"

import Header from "./components/Header"
import { MyInfo, EnemyInfo } from "./components/HealthInfo"
import Turn from "./components/Turn"
import Enemy from "./components/Enemy"
import AttackInfo from "./components/AttackInfo"
import TileGrid from "./components/TileGrid"
import WyrmDecoder from "./components/WyrmDecoder"
import EncounterHud from "./components/EncounterHud"
import { clearSelection, createGame, previewAttack, submitWord, toggleTile } from "./game/game"
import { melancholyEncounter } from "./game/encounters"
import { getActiveGrammarModifiers, getCurrentTileSummary, getRecentBattleEvents } from "./game/hud"

type Phase = "waiting" | "enemy" | "tiles" | "ready"

export default function App() {
  const [phase, setPhase] = useState<Phase>("waiting")
  const containerRef = useRef<HTMLElement>(null)
  const enemyLetters = useRef<(HTMLDivElement | null)[]>([])
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const wyrmDockRef = useRef<HTMLSpanElement>(null)
  const wyrmTitleRef = useRef<HTMLDivElement>(null)
  const [revealedEnemyIndices, setRevealedEnemyIndices] = useState<number[]>([])
  const [revealedTileIndices, setRevealedTileIndices] = useState<number[]>([])
  const [game, setGame] = useState(() => createGame(melancholyEncounter))
  const enemy = game.encounter.enemy
  const interactive = phase === "ready" && game.status === "playing"
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
    : phase === "waiting" ? "CLICK TO BEGIN"
    : phase !== "ready" ? "DECODING"
    : game.error ?? (game.selectedTileIds.length > 0 ? preview.error ?? undefined : undefined)

  function begin() {
    if (phase !== "waiting") return

    setPhase("enemy")
  }

  return (
    <main className="container"
      ref={containerRef}
      onClick={() => {
        if (phase === "waiting") begin()
      }}
    >
      <Header wyrmDockRef={wyrmDockRef} titleRef={wyrmTitleRef} showWyrm={phase === "ready"} />

      <hr />

      <div className="battle-info">
        <MyInfo
          name="YOU"
          health={game.playerResolve}
          maxHealth={game.encounter.startingResolve}
        />

        <Turn turn={game.playedWords.length + (game.status === "playing" ? 1 : 0)} />

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
          revealedIndices={revealedEnemyIndices}
          registerLetter={registerLetter}
        />

        <EncounterHud
          visible={phase === "ready"}
          modifiers={getActiveGrammarModifiers(game)}
          tiles={getCurrentTileSummary(game)}
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
            revealedIndices={revealedTileIndices}
            registerTile={registerTile}
            ready={interactive}
            tiles={game.tiles}
            selectedTileIds={game.selectedTileIds}
            damage={preview.totalDamage}
            canAttack={interactive && preview.valid}
            onToggleTile={id => {
              if (interactive) setGame(current => toggleTile(current, id))
            }}
            onClear={() => {
              if (interactive) setGame(current => clearSelection(current))
            }}
            onAttack={() => {
              if (interactive) setGame(current => submitWord(current, current.selectedTileIds))
            }}
          />
        </div>
      </div>

      <WyrmDecoder
        phase={phase}
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
      />
    </main>
  )
}
