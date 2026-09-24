import { useCallback, useState } from "react"
import "./App.css"

import Header from "./components/Header"
import { MyInfo, EnemyInfo } from "./components/HealthInfo"
import Turn from "./components/Turn"
import Enemy from "./components/Enemy"
import AttackInfo from "./components/AttackInfo"
import TileGrid from "./components/TileGrid"
import { clearSelection, createGame, previewAttack, submitWord, toggleTile } from "./game/game"
import { melancholyEncounter } from "./game/encounters"

type Phase = "waiting" | "enemy" | "tiles" | "ready"

export default function App() {
  const [phase, setPhase] = useState<Phase>("waiting")
  const [game, setGame] = useState(() => createGame(melancholyEncounter))
  const enemy = game.encounter.enemy
  const interactive = phase === "ready" && game.status === "playing"
  const preview = previewAttack(game)
  const enemyDecoded = useCallback(() => setPhase("tiles"), [])
  const tilesDecoded = useCallback(() => setPhase("ready"), [])

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
      onClick={() => {
        if (phase === "waiting") begin()
      }}
    >
      <Header />

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

      <div className="enemy-section">
      <Enemy
        name={enemy.word}
        partOfSpeech={enemy.partOfSpeech}
        definition={enemy.definition}
        active={phase === "enemy"}
        onDecoded={enemyDecoded}
      />
      </div>


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
          active={phase === "tiles"}
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
          onDecoded={tilesDecoded}
        />
      </div>
    </main>
  )
}
