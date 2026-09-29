import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import Enemy from '../components/Enemy'
import AttackInfo from '../components/AttackInfo'
import TileGrid from '../components/TileGrid'
import BattleResult from '../components/BattleResult'
import { MyInfo } from '../components/HealthInfo'
import { previewLetterStrike } from '../game/letterStrike'
import {
  canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds,
  getTutorialMove, tutorialReducer,
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
  const introducingBoard = ['goal', 'board'].includes(step)
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
  const header = <header className="header">
    <div className="title">WYRMLE</div>
    <button type="button" className="tutorial-skip" onClick={onSkip}>SKIP TUTORIAL</button>
  </header>

  if (step === 'complete' && !resolving) return <main className="container letter-combat tutorial-result" data-result="won" data-tutorial-step={step}>
    {header}
    <BattleResult game={game} actions={<>
      <p className="practice-rating">One guess earns ★★★, two earn ★★, three earn ★.<br />Real puzzles give you one attempt, saved as you go.</p>
      <button className="daily-button bingo-result-primary" onClick={onComplete}>Play your puzzle</button>
    </>} />
  </main>

  return <main className="container letter-combat tutorial-battle" data-tutorial-step={step} data-tutorial-reading={!move || undefined} data-board-layout={game.playerResolve === 1 ? 'ring' : 'wheel'} data-bingo-hunt>
    {header}
    <div className="battle-info">
      <MyInfo name="Lives" health={game.playerResolve} maxHealth={game.encounter.startingResolve} animateLives />
    </div>
    <div className="enemy-zone">
      <Enemy key={game.encounter.id}
        name={game.encounter.enemy.word} definition={game.encounter.enemy.definition}
        partOfSpeech={game.encounter.enemy.partOfSpeech} introFinished
        revealedIndices={game.enemyLetters.map((_, index) => index)} registerLetter={registerLetter}
        modifiers={[]} previewMode="bingo-match"
        letterStates={game.enemyLetters}
        predictedHits={showPrediction ? preview.bingoHunt?.matchingHits : []}
        predictedRecoveries={showPrediction ? preview.recoveries : []}
        resolvedHits={resolving ? lastMove?.preview.hits : undefined}
        resolvedRecoveries={resolving ? lastMove?.preview.recoveries : undefined}
        resolutionKey={resolving && lastMove ? `${game.encounter.id}:${game.playedWords.length}` : undefined}
        onResolutionComplete={onResolutionComplete} />
      <div className="tutorial-coach" aria-label="Practice instructions" aria-live="polite" aria-atomic="true">
        <TutorialPrompt state={state} selected={Boolean(move && canAttackInTutorial(state))} />
        {!move && <button type="button" className="daily-button tutorial-continue" disabled={!canContinue}
          onClick={() => dispatch({ type: 'continue' })}>Tap to continue <span aria-hidden="true">→</span></button>}
      </div>
    </div>
    <section className="player-zone" aria-label="Practice word selection">
      {!introducingBoard && <AttackInfo word={visiblePreview?.word ?? ''} damage={visiblePreview?.strikes ?? 0} maxDamage={0} metric="strikes"
        strikePreview={visiblePreview} counterRules={game.encounter.counterRules} enemyWord={game.encounter.enemy.word}
        ready={canAttack}
        resolveBefore={showPrediction ? game.playerResolve : undefined}
        message={resolving ? 'Watch the result…' : !move ? undefined
          : !game.selectedTileIds.length ? `BUILD ${move.word}`
            : !selectedExpectedPrefix ? 'CLEAR TO START AGAIN'
              : !preview.valid ? 'KEEP BUILDING' : undefined} />}
      <div className="controls">
        <TileGrid tiles={game.tiles} specialTiles={[]} layout={game.playerResolve === 1 ? 'ring' : 'wheel'} tileShape="circle"
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
    case 'goal': return <p>Find a word that means the opposite of <strong>DRY</strong> and contains D, R and Y. That’s a bingo. The tiles below hold the answer, mixed with extra letters.</p>
    case 'board': return <p>The outlines tell you how many copies to use: <strong>two Ds, one R and one Y</strong>. Underlined tiles match those letters. You have <strong>three lives</strong> to find the bingo.</p>
    case 'damp': return <p>{selected ? 'DAMP is an opposite adjective, just like DRY. It isn’t a bingo, but playing it removes some spare tiles. Try it.' : 'Need help? A simpler opposite clears spare tiles. Tap the highlighted tiles to spell DAMP. CLEAR lets you start your word again.'}</p>
    case 'removed': return <p>One life used. Some spare tiles have gone. Played letters stay available. The enemy doesn’t lose letters—you must cover them all in one word.</p>
    case 'wet': return <p>Play <strong>WET</strong>, another opposite adjective. This removes the last spare tiles. Other words are rejected without costing a life in Normal and Easy mode.</p>
    case 'bingo': return <p>One life left, and just the answer’s letters. Spell <strong>HYDRATED</strong>: supplied with water. Both Ds, R and Y turn red—every required copy is there.</p>
    case 'complete': return null
  }
}
