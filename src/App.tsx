import { useState } from "react"
import "./App.css"

import Header from "./components/Header"
import { MyInfo, EnemyInfo } from "./components/HealthInfo"
import Turn from "./components/Turn"
import Enemy from "./components/Enemy"
import AttackInfo from "./components/AttackInfo"
import TileGrid from "./components/TileGrid"

type Phase = "waiting" | "enemy" | "tiles" | "ready"

export default function App() {
  const [phase, setPhase] = useState<Phase>("waiting")

  function begin() {
    if (phase !== "waiting") return

    setPhase("enemy")

    // Later:
    // startTimer()
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
          health={4}
          maxHealth={5}
        />

        <Turn turn={1} />

        <EnemyInfo
          name="LAUGHTER"
          health={31}
          maxHealth={45}
        />
      </div>

      <div className="enemy-section">
      <Enemy
        name="MELANCHOLY"
        partOfSpeech="noun"
        definition="a feeling of pensive sadness, typically with no obvious cause"
        active={phase === "enemy"}
        onDecoded={() => setPhase("tiles")}
      />
      </div>


      <AttackInfo
        word="BALLOONED"
        damage={19}
        maxDamage={24}
        ready={phase === "ready"}
        bonuses={[
          { label: "SAPPHIRE", value: 5, symbol: "◆" },
          { label: "LONG", value: 3 },
          { label: "DOUBLE", value: 2 },
        ]}
      />

      <div className="controls">
        <TileGrid
          active={phase === "tiles"}
          ready={phase === "ready"}
          onDecoded={() => setPhase("ready")}
        />
      </div>
    </main>
  )
}