import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import Enemy from '../components/Enemy'
import AttackInfo from '../components/AttackInfo'
import TileGrid from '../components/TileGrid'
import { MyInfo } from '../components/HealthInfo'
import { previewLetterStrike } from '../game/letterStrike'
import { getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from '../game/letterStrikeHud'
import {
  canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds,
  getTutorialMove, tutorialExamples, tutorialReducer,
} from './tutorial'
import type { TutorialState, TutorialStep } from './tutorial'
import './TutorialBattle.css'

const tileIndices = Array.from({ length: 16 }, (_, index) => index)
const registerLetter = () => {}

export default function TutorialBattle({ onComplete, onSkip, initialStep = 'goal' }: {
  onComplete: () => void
  onSkip: () => void
  initialStep?: TutorialStep
}) {
  const [state, dispatch] = useReducer(tutorialReducer, initialStep, createTutorial)
  const [resolving, setResolving] = useState(false)
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const { game, step } = state
  const move = getTutorialMove(state)
  const preview = previewLetterStrike(game)
  const allowedTileIds = getAllowedTutorialTileIds(state)
  const canAttack = !resolving && canAttackInTutorial(state)
  const canContinue = !resolving && canContinueInTutorial(state)
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
      if (highlighted) element.setAttribute('aria-description', 'Next tile in this practice word')
      else element.removeAttribute('aria-description')
    })
  }, [game.tiles, nextTileId, resolving])
  const lastMove = game.playedWords.at(-1)
  const onResolutionComplete = useCallback(() => setResolving(false), [])
  const showPrediction = Boolean(move && preview.valid && !resolving)
  const visiblePreview = move ? preview : lastMove?.preview
  const coreDemo = step === 'counter' || step === 'neutral'
  const jump = (step: TutorialStep) => { setResolving(false); dispatch({ type: 'jump', step }) }
  const header = <header className="header">
    <div className="title">WYRMLE</div>
    <button type="button" className="tutorial-skip" onClick={onSkip}>SKIP TUTORIAL</button>
  </header>

  if (step === 'goal' || step === 'complete' && !resolving) return <main className="container tutorial-overview" data-tutorial-step={step}>
    {header}
    <section className="tutorial-intro" aria-labelledby="tutorial-title">
      <span className="tutorial-eyebrow">{step === 'goal' ? 'A daily word battle' : 'Practice complete'}</span>
      <h1 id="tutorial-title">{step === 'goal' ? 'Words are your weapons.' : 'You’re ready.'}</h1>
      {step === 'goal' ? <ul className="tutorial-summary">
        <li>Spell words of 3+ letters. Tap or swipe; tiles can be anywhere.</li>
        <li>Counter meanings hit every matching letter. Neutral words hit once; similar words hit nothing.</li>
        <li>Remove the whole enemy before your lives run out. Each word costs one life.</li>
      </ul> : <p className="tutorial-completion-note">Find a counter, check its targets, then play. Used tiles refill while supplies last; empty spaces stay when the reserve runs out.</p>}
      <div className="tutorial-intro-actions">
        <button type="button" className="daily-button tutorial-start" onClick={() => step === 'goal' ? jump('counter') : onComplete()}>
          {step === 'goal' ? 'TRY THE DEMO' : 'PLAY TODAY'}
        </button>
        {step !== 'goal' && <button type="button" className="daily-button" onClick={() => jump('counter')}>Replay the demo</button>}
      </div>
      <div className="tutorial-examples">
        <p>More practice</p>
        <div className="tutorial-example-list">
          {tutorialExamples.map(example => <button type="button" className="daily-button tutorial-example" key={example.step}
            title={example.description} onClick={() => jump(example.step)}>{example.label}</button>)}
        </div>
      </div>
    </section>
  </main>

  return <main className="container letter-combat tutorial-battle" data-tutorial-step={step}>
    {header}
    <div className="battle-info">
      <MyInfo name="Lives" health={game.playerResolve} maxHealth={game.encounter.startingResolve} />
      <span className="tutorial-label">{coreDemo ? `DEMO · WORD ${step === 'counter' ? '1' : '2'} OF 2` : 'OPTIONAL PRACTICE'}</span>
    </div>
    <div className="enemy-zone">
      <Enemy key={game.encounter.id}
        name={game.encounter.enemy.word} definition={game.encounter.enemy.definition}
        partOfSpeech={game.encounter.enemy.partOfSpeech} introFinished
        revealedIndices={game.enemyLetters.map((_, index) => index)} registerLetter={registerLetter}
        modifiers={getLetterStrikeGrammarModifiers(game)} modifierUnit="HIT"
        letterStates={game.enemyLetters}
        predictedHits={showPrediction ? preview.hits : []}
        predictedRecoveries={showPrediction ? preview.recoveries : []}
        resolvedHits={resolving ? lastMove?.preview.hits : undefined}
        resolvedRecoveries={resolving ? lastMove?.preview.recoveries : undefined}
        resolutionKey={resolving && lastMove ? `${game.encounter.id}:${game.playedWords.length}` : undefined}
        onResolutionComplete={onResolutionComplete} />
      <div className="tutorial-coach" aria-label="Practice instructions" aria-live="polite" aria-atomic="true">
        <TutorialPrompt state={state} selected={Boolean(move && canAttackInTutorial(state))} />
      </div>
    </div>
    <section className="player-zone" aria-label="Practice word selection">
      <AttackInfo word={visiblePreview?.word ?? ''} damage={visiblePreview?.strikes ?? 0} maxDamage={0} metric="strikes"
        strikePreview={visiblePreview} enemyWord={game.encounter.enemy.word}
        ready={canAttack}
        resolveBefore={showPrediction ? game.playerResolve : undefined}
        message={resolving ? 'Watch the result…' : !move ? 'CONTINUE TO FINISH'
          : !game.selectedTileIds.length ? `BUILD ${move.word}`
            : !selectedExpectedPrefix ? 'CLEAR TO START AGAIN'
              : !preview.valid ? 'KEEP BUILDING' : undefined} />
      <div className="controls">
        <TileGrid tiles={game.tiles} specialTiles={getLetterStrikeTileSummary(game)}
          revealedIndices={tileIndices} registerTile={registerTile}
          selectedTileIds={game.selectedTileIds} ready={allowedTileIds.length > 0 && !resolving}
          allowedTileIds={allowedTileIds}
          primaryLabel={move?.action === 'attack' ? 'ATTACK' : 'CONTINUE'} canAttack={canAttack || canContinue}
          onToggleTile={tileId => dispatch({ type: 'select', tileId })}
          onSelectTiles={tileIds => dispatch({ type: 'select-many', tileIds })}
          onClear={() => dispatch({ type: 'clear' })}
          onAttack={() => {
            if (canContinue) { dispatch({ type: 'continue' }); return }
            if (!canAttack) return
            setResolving(true)
            dispatch({ type: 'attack' })
          }} />
      </div>
    </section>
  </main>
}

function TutorialPrompt({ state, selected }: { state: TutorialState; selected: boolean }) {
  switch (state.step) {
    case 'counter': return <p>{selected
      ? 'GLAD is SAD’s opposite: A and D disappear. Check the preview, then PLAY WORD.'
      : 'Build GLAD using the highlighted letters. Letters can be anywhere.'}</p>
    case 'neutral': return <p>{selected
      ? 'SUN is neutral: only its first match, S, is hit. PLAY WORD to win.'
      : 'Used tiles have refilled. Build SUN to remove the last S.'}</p>
    case 'armour': return <p>Build SUN. S has a double border: one hit breaks armour; a second removes S.</p>
    case 'armour-finish': return <p>S lost its armour. Build SUN again to remove it. Repeating words is allowed.</p>
    case 'armour-complete': return <p>Two hits removed S: double border → single border → dot.</p>
    case 'resisted': return <p>Build SAD. It means the same as the enemy: no hits, even though all three letters match.</p>
    case 'resisted-result': return <p>SAD cost one life and hit nothing. Look for a counter instead.</p>
    case 'bingo': return <p>Build GLADDENS: it means to make happy. Both D tiles are needed to break and remove the armoured D.</p>
    case 'bingo-result': return <p>Bingo! One counter removed every letter, including the armour. Beta puzzles each hide a one-word win.</p>
    case 'complete': return <p>Every enemy letter is gone. You won!</p>
    case 'goal': return null
  }
}
