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
  const introducingBoard = ['goal', 'board', 'word-types'].includes(step)
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

  return <main className="container letter-combat tutorial-battle" data-tutorial-step={step} data-tutorial-reading={!move || undefined}>
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
        {step === 'word-types' && <div className="tutorial-example-list" aria-label="Optional practice">
          {tutorialExamples.map(example => <button type="button" className="daily-button tutorial-example" key={example.step}
            title={example.description} onClick={() => jump(example.step)}>{example.label}</button>)}
        </div>}
        {!move && <button type="button" className="daily-button tutorial-continue" disabled={!canContinue}
          onClick={() => dispatch({ type: 'continue' })}>Tap to continue <span aria-hidden="true">→</span></button>}
      </div>
    </div>
    <section className="player-zone" aria-label="Practice word selection">
      {!introducingBoard && <AttackInfo word={visiblePreview?.word ?? ''} damage={visiblePreview?.strikes ?? 0} maxDamage={0} metric="strikes"
        strikePreview={visiblePreview} enemyWord={game.encounter.enemy.word}
        ready={canAttack}
        resolveBefore={showPrediction ? game.playerResolve : undefined}
        message={resolving ? 'Watch the result…' : !move ? undefined
          : !game.selectedTileIds.length ? `BUILD ${move.word}`
            : !selectedExpectedPrefix ? 'CLEAR TO START AGAIN'
              : !preview.valid ? 'KEEP BUILDING' : undefined} />}
      <div className="controls">
        <TileGrid tiles={game.tiles} specialTiles={getLetterStrikeTileSummary(game)}
          revealedIndices={tileIndices} registerTile={registerTile}
          selectedTileIds={game.selectedTileIds} ready={allowedTileIds.length > 0 && !resolving}
          allowedTileIds={allowedTileIds} enemyLetters={game.enemyLetters} matchHint="underline"
          showActions={Boolean(move)} canAttack={canAttack}
          onToggleTile={tileId => dispatch({ type: 'select', tileId })}
          onSelectTiles={tileIds => dispatch({ type: 'select-many', tileIds })}
          onClear={() => dispatch({ type: 'clear' })}
          onAttack={() => {
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
    case 'goal': return <p>Make words from the tiles below to attack <strong>ARID</strong>, the enemy above. <strong>Remove all its letters to win.</strong> ARID means dry, so WATER fights it: the shared letters A and R take a hit.</p>
    case 'board': return <p>Each hit removes a border. When a letter has no borders left, it disappears. R and I need two hits each. Every word costs one LIFE; you have three.</p>
    case 'word-types': return <ul className="tutorial-word-types">
      <li><strong>Counters</strong>, like WATER against dryness, hit every matching letter.</li>
      <li><strong>Neutral</strong> means unrelated. GRID hits only its first matching letter.</li>
      <li><strong>Similar words</strong>, like DRY, hit nothing.</li>
    </ul>
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
  }
}
