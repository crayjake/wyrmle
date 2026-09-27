import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import Enemy from '../components/Enemy'
import AttackInfo from '../components/AttackInfo'
import TileGrid from '../components/TileGrid'
import RefillSupply from '../components/RefillSupply'
import BattleResult from '../components/BattleResult'
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
  const jump = (step: TutorialStep) => { setResolving(false); dispatch({ type: 'jump', step }) }
  const header = <header className="header">
    <div className="title">WYRMLE</div>
    <button type="button" className="tutorial-skip" onClick={onSkip}>SKIP TUTORIAL</button>
  </header>

  if (['three-won', 'two-won', 'complete'].includes(step) && !resolving) return <main className="container letter-combat tutorial-result" data-result="won" data-tutorial-step={step}>
    {header}
    <BattleResult game={game} onRetry={() => jump('goal')}
      nudge={step === 'three-won' ? 'A win unlocks 2 lives. Same board, same refills: find a shorter route.'
        : 'Two stars! Now try the same puzzle with one life.'}
      actions={<>
        <button type="button" className="daily-button bingo-result-primary" onClick={() => step === 'complete' ? onComplete() : dispatch({ type: 'continue' })}>
          {step === 'three-won' ? 'TRY 2 LIVES' : step === 'two-won' ? 'TRY THE BINGO' : 'PLAY TODAY'}
        </button>
        {step === 'complete' ? <button type="button" className="daily-button" onClick={() => jump('goal')}>Replay tutorial</button>
          : <p className="daily-best">Replays keep your best stars. Losing doesn’t reduce your next attempt’s lives.</p>}
      </>} />
  </main>

  if (step === 'goal') return <main className="container tutorial-overview" data-tutorial-step={step}>
    {header}
    <section className="tutorial-intro" aria-labelledby="tutorial-title">
      <span className="tutorial-eyebrow">A daily word battle</span>
      <h1 id="tutorial-title">Look for counters.</h1>
      <ul className="tutorial-summary">
        <li><strong>Counter:</strong> an opposing idea, like water against dryness. Each matching letter hits.</li>
        <li><strong>Neutral:</strong> unrelated to the enemy. Only the first matching letter hits. Useful when you’re one hit short.</li>
        <li><strong>Similar:</strong> more of the same idea, like DRY against ARID. No hits.</li>
      </ul>
      <p className="tutorial-completion-note">Use the letter tiles to clear the enemy word before your lives run out.</p>
      <div className="tutorial-intro-actions">
        <button type="button" className="daily-button tutorial-start" onClick={() => jump('board')}>TRY ARID · 3 → 2 → 1 LIVES</button>
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
      <MyInfo name="Lives" health={game.playerResolve} maxHealth={game.encounter.startingResolve} animateLives />
      <RefillSupply game={game} />
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
        message={resolving ? 'Watch the result…' : !move ? 'CONTINUE WHEN READY'
          : !game.selectedTileIds.length ? `BUILD ${move.word}`
            : !selectedExpectedPrefix ? 'CLEAR TO START AGAIN'
              : !preview.valid ? 'KEEP BUILDING' : undefined} />
      <div className="controls">
        <TileGrid tiles={game.tiles} specialTiles={getLetterStrikeTileSummary(game)}
          revealedIndices={tileIndices} registerTile={registerTile}
          selectedTileIds={game.selectedTileIds} ready={allowedTileIds.length > 0 && !resolving}
          allowedTileIds={allowedTileIds} enemyLetters={game.enemyLetters} matchHint="underline"
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
    case 'board': return <p>ARID means dry. It’s the enemy word: clear all four letters to win. LIVES shows how many words you can play. You have three. R and I have double borders: each needs two hits.</p>
    case 'water': return <p>{selected
      ? 'WATER fights dryness. The preview shows two hits: A will go, and R will lose one of its two borders. Play the word to spend one life.'
      : 'Tap or swipe the highlighted tiles to spell WATER. Use any tiles, once each, to make words of 3+ letters. Underlined letters match the enemy. CLEAR lets you start the word again.'}</p>
    case 'spring': return <p>Used tiles are replaced. REFILLS counts what’s left: letters still in the enemy, plus other letters in the blank box. It doesn’t show draw order. Build SPRING, a source of water, to hit R and I.</p>
    case 'dip': return <p>One life left. DIP means to put something into liquid. Build it to remove I and D and win.</p>
    case 'three-won': return <p>Three words, one star. Next, the same board with two lives.</p>
    case 'rain': return <p>Same board and refills, two lives. Build RAIN: another way to bring water to dry land.</p>
    case 'muddier': return <p>One life left. Build MUDDIER: wet ground instead of dry. R, I and D clear the remaining letters.</p>
    case 'two-won': return <p>Two words, two stars. Next, find the one-word win.</p>
    case 'bingo': return <p>One life. Build IRRIGATED: supplied with water. Two Rs and two Is break the armour and clear every letter.</p>
    case 'neutral': return <p>Build GRID. It has nothing to do with dryness, so only its first matching letter gets a hit.</p>
    case 'neutral-result': return <p>GRID used a life to crack R’s armour. Neutral words can help, but counters do more with each life.</p>
    case 'resisted': return <p>Build DRY. It means much the same as ARID, so it won’t hit any letters.</p>
    case 'resisted-result': return <p>DRY used a life and hit nothing. Check the preview before playing a word.</p>
    case 'complete': return <p>Bingo! Every letter removed in one word: three stars.</p>
    case 'goal': return null
  }
}
