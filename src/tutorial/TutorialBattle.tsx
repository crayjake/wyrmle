import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import Enemy from '../components/Enemy'
import AttackInfo from '../components/AttackInfo'
import TileGrid from '../components/TileGrid'
import { MyInfo } from '../components/HealthInfo'
import WyrmCharacter from '../components/WyrmCharacter'
import { previewLetterStrike } from '../game/letterStrike'
import { getLetterStrikeBonuses, getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from '../game/letterStrikeHud'
import { canAttackInTutorial, createTutorial, getTutorialMove, tutorialReducer } from './tutorial'
import type { TutorialState } from './tutorial'
import './TutorialBattle.css'

const enemyIndices = [0, 1, 2, 3]
const tileIndices = Array.from({ length: 16 }, (_, index) => index)
const registerLetter = () => {}

export default function TutorialBattle({ onComplete, onSkip }: {
  onComplete: () => void
  onSkip: () => void
}) {
  const [state, dispatch] = useReducer(tutorialReducer, undefined, createTutorial)
  const [resolving, setResolving] = useState(false)
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const { game, step } = state
  const move = getTutorialMove(state)
  const preview = previewLetterStrike(game)
  const canAttack = !resolving && canAttackInTutorial(state)
  const selectedExpectedPrefix = Boolean(move && game.selectedTileIds.every((id, index) => id === move.tileIds[index]))
  const nextTileId = selectedExpectedPrefix ? move?.tileIds[game.selectedTileIds.length] : undefined
  const registerTile = useCallback((index: number, element: HTMLButtonElement | null) => {
    tileElements.current[index] = element
  }, [])
  useEffect(() => {
    tileElements.current.forEach((element, index) => {
      if (!element) return
      const highlighted = game.tiles[index].id === nextTileId && !resolving
      element.dataset.tutorialHint = String(highlighted)
      if (highlighted) element.setAttribute('aria-description', 'Next tile in this tutorial word')
      else element.removeAttribute('aria-description')
    })
  }, [game.tiles, nextTileId, resolving])
  const lastMove = game.playedWords.at(-1)
  const canContinue = !move && !resolving
  const onResolutionComplete = useCallback(() => setResolving(false), [])
  const bonuses = preview.valid ? [
    ...getLetterStrikeBonuses(preview),
    { label: `${preview.strikes} ${preview.strikes === 1 ? 'STRIKE' : 'STRIKES'}` },
  ] : []

  return <main className="container letter-combat tutorial-battle" data-tutorial-step={step}>
    <header className="header">
      <div className="title">WYRMLE<span className="wyrm-dock" aria-hidden="true"><WyrmCharacter idle /></span></div>
      <button type="button" className="tutorial-skip" onClick={onSkip}>SKIP TUTORIAL</button>
    </header>

    <div className="battle-info">
      <MyInfo name="Resolve" health={game.playerResolve} maxHealth={game.encounter.startingResolve} />
      <span className="tutorial-label">PRACTICE</span>
    </div>

    <div className="enemy-zone">
      <Enemy name={game.encounter.enemy.word} definition={game.encounter.enemy.definition}
        partOfSpeech={game.encounter.enemy.partOfSpeech} revealedIndices={enemyIndices}
        registerLetter={registerLetter} modifiers={getLetterStrikeGrammarModifiers(game)} modifierUnit="STRIKE"
        letterStates={game.enemyLetters}
        predictedHits={move && preview.valid ? preview.hits : []}
        resolvedHits={lastMove?.preview.hits} resolutionKey={lastMove ? game.playedWords.length : undefined}
        onResolutionComplete={onResolutionComplete} />
      <div className="tutorial-coach" aria-live="polite" aria-atomic="true">
        <TutorialPrompt state={state} ready={canAttack} />
      </div>
    </div>

    <section className="player-zone" aria-label="Tutorial word selection">
      {move && <AttackInfo word={preview.word} damage={preview.strikes} maxDamage={5} metric="strikes"
        bonuses={bonuses} ready={canAttack}
        message={!game.selectedTileIds.length
          ? `BUILD ${move.word}` : !selectedExpectedPrefix && !canAttack ? `BUILD ${move.word} · CLEAR TO TRY AGAIN`
            : !preview.valid ? 'KEEP BUILDING' : undefined} />}
      <div className="controls">
        <TileGrid tiles={game.tiles} specialTiles={getLetterStrikeTileSummary(game)}
          revealedIndices={tileIndices} registerTile={registerTile}
          selectedTileIds={game.selectedTileIds} ready={Boolean(move) && !resolving}
          primaryLabel={move ? 'ATTACK' : 'CONTINUE'} canAttack={canAttack || canContinue}
          onToggleTile={tileId => dispatch({ type: 'select', tileId })}
          onClear={() => dispatch({ type: 'clear' })}
          onAttack={() => {
            if (canContinue) {
              if (step === 'complete') onComplete()
              else dispatch({ type: 'continue' })
              return
            }
            if (!canAttack) return
            setResolving(true)
            dispatch({ type: 'attack' })
          }} />
      </div>
    </section>
  </main>
}

function TutorialPrompt({ state, ready }: { state: TutorialState; ready: boolean }) {
  const { step, game } = state
  switch (step) {
    case 'enemy': return <><span className="tutorial-label">THE ENEMY</span><p>REMOVE EVERY LETTER TO WIN.</p></>
    case 'counter': return <><span className="tutorial-label">BUILD HOT</span>
      <p>A COUNTER HAS THE OPPOSITE MEANING.</p>
      <span className="tutorial-note">HOT is the opposite of COLD.</span>
      <span className="tutorial-note">{ready ? 'All matching letters strike. Here, only O matches.' : 'Build HOT. Every matching letter will strike.'}</span></>
    case 'types': return <div className="tutorial-types">
      <p><span className="tutorial-good">COUNTER</span><span>Opposite meaning · HOT<br />All matching letters strike</span></p>
      <p><span>NEUTRAL</span><span>Other meaning · LAD<br />First matching letter strikes</span></p>
      <p><span className="tutorial-negative">RESISTED</span><span>Similar meaning · ICE<br />No normal strike</span></p>
    </div>
    case 'strike': return <><span className="tutorial-label tutorial-special">STRIKE · BUILD ICE</span>
      <p>THIS TILE ALWAYS HITS A MATCHING LETTER.</p>
      <span className="tutorial-note">ICE shares COLD's meaning, so it's resisted.</span>
      <span className="tutorial-note">The STRIKE C still hits.</span></>
    case 'grammar': return <><span className="tutorial-label tutorial-good">WORD TYPE · BUILD ICY</span>
      <p>THIS ENEMY GIVES ADJECTIVES +1 STRIKE.</p>
      <span className="tutorial-note">ICY describes something: it's an adjective.</span>
      <span className="tutorial-note">Resisted gives 0. The adjective bonus lets C strike.</span></>
    case 'resolve': return <><span className="tutorial-label">RESOLVE</span>
      <p>EACH WORD COSTS 1 RESOLVE.</p>
      <span className="tutorial-note">{game.encounter.startingResolve} → {game.playerResolve} after {game.playedWords.length} words</span></>
    case 'ward': return <><span className="tutorial-label tutorial-special">WARD · BUILD LAD</span>
      <p>KEEP YOUR RESOLVE THIS TURN.</p>
      <span className="tutorial-note">Use the WARD A. Resolve: {game.playerResolve}/{game.encounter.startingResolve}</span></>
    case 'ward-result': return <><span className="tutorial-label tutorial-special">WARD ACTIVATED</span>
      <p>{game.playerResolve} → {game.playerResolve} RESOLVE</p><span className="tutorial-note">Your word struck L. Your Resolve stayed.</span></>
    case 'armour': return <><span className="tutorial-label">ARMOUR · BUILD DIG</span>
      <p>ARMOURED LETTERS NEED 2 STRIKES.</p>
      <span className="tutorial-note">DIG has one D. This strike breaks its armour.</span></>
    case 'armour-break': return <><span className="tutorial-label">ONE MORE · BUILD DUO</span>
      <p>ARMOUR BROKEN. STRIKE D AGAIN.</p>
      <span className="tutorial-note">DUO has one D. This second strike removes it.</span></>
    case 'complete': return <><span className="tutorial-label tutorial-good">VICTORY</span>
      <p>EVERY LETTER REMOVED.</p><span className="tutorial-note">Practice complete. Your Daily is waiting.</span></>
  }
}
