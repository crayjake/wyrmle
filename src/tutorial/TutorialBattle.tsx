import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import Enemy from '../components/Enemy'
import AttackInfo from '../components/AttackInfo'
import TileGrid from '../components/TileGrid'
import { MyInfo } from '../components/HealthInfo'
import WyrmCharacter from '../components/WyrmCharacter'
import { previewLetterStrike } from '../game/letterStrike'
import { getLetterStrikeBonuses, getLetterStrikeGrammarModifiers, getLetterStrikeTileSummary } from '../game/letterStrikeHud'
import {
  canAttackInTutorial, canContinueInTutorial, createTutorial, getAllowedTutorialTileIds,
  getTutorialMove, tutorialReducer, tutorialSteps,
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
  const mainElement = useRef<HTMLElement | null>(null)
  const tileElements = useRef<(HTMLButtonElement | null)[]>([])
  const { game, step } = state
  useEffect(() => {
    mainElement.current?.scrollTo({ top: 0 })
  }, [step])
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
      const tile = game.tiles[index]
      const highlighted = tile.id === nextTileId && !resolving && allowedTileIds.includes(tile.id)
      element.dataset.tutorialHint = String(highlighted)
      element.dataset.tutorialMatch = String((step === 'matching' || step === 'counter')
        && game.selectedTileIds.includes(tile.id) && (tile.letter === 'A' || tile.letter === 'D'))
      if (highlighted) element.setAttribute('aria-description', 'Next tile in this tutorial word')
      else element.removeAttribute('aria-description')
    })
  }, [game.tiles, game.selectedTileIds, nextTileId, resolving, allowedTileIds, step])
  const lastMove = game.playedWords.at(-1)
  const onResolutionComplete = useCallback(() => setResolving(false), [])
  const validSelection = Boolean(move && preview.valid)
  const lessonIndex = tutorialSteps.findIndex(lesson => lesson.id === step)
  const primaryLabel = move?.action === 'attack' ? 'ATTACK' : 'CONTINUE'
  const showPrediction = validSelection && step !== 'build' && step !== 'matching'
  const resultStep = !move && step !== 'goal' && step !== 'resolve' && step !== 'complete'
  const visiblePreview = resultStep ? lastMove?.preview : preview
  const recoveryText = showPrediction && preview.recoveries?.length
    ? preview.recoveries.map(recovery => `${recovery.letter}: ${recovery.hitsBefore === 0 ? 'returns' : 'gains armour'}`).join(' · ')
    : undefined

  return <main ref={mainElement} className="container letter-combat tutorial-battle" data-tutorial-step={step}>
    <header className="header">
      <div className="title">WYRMLE<span className="wyrm-dock" aria-hidden="true"><WyrmCharacter idle /></span></div>
      <button type="button" className="tutorial-skip" onClick={onSkip}>SKIP TUTORIAL</button>
    </header>

    <div className="battle-info">
      <MyInfo name="Resolve" health={game.playerResolve} maxHealth={game.encounter.startingResolve} />
      <span className="tutorial-label">PRACTICE {lessonIndex + 1}/{tutorialSteps.length} · {game.playerResolve}/{game.encounter.startingResolve}</span>
    </div>

    <div className="enemy-zone">
      <Enemy key={game.encounter.id + (step === 'regen-alive' ? '-alive' : '')}
        name={game.encounter.enemy.word} definition={game.encounter.enemy.definition}
        partOfSpeech={game.encounter.enemy.partOfSpeech}
        revealedIndices={game.enemyLetters.map((_, index) => index)} registerLetter={registerLetter}
        modifiers={getLetterStrikeGrammarModifiers(game)} modifierUnit="STRIKE"
        letterStates={game.enemyLetters}
        predictedHits={showPrediction ? preview.hits : []}
        predictedRecoveries={showPrediction ? preview.recoveries : []}
        resolvedHits={lastMove?.preview.hits} resolvedRecoveries={lastMove?.preview.recoveries}
        resolutionKey={lastMove ? `${game.encounter.id}:${game.playedWords.length}` : undefined}
        onResolutionComplete={onResolutionComplete} />
      <section className="tutorial-coach" aria-label="Tutorial instructions" aria-live="polite" aria-atomic="true">
        <div className="tutorial-coach-heading">
          <span className="tutorial-progress">{lessonIndex < 8 ? 'BASICS' : 'EXTRA TOOLS'} · {lessonIndex + 1}/{tutorialSteps.length}</span>
          <span className="tutorial-label">{tutorialSteps[lessonIndex].label}</span>
        </div>
        <TutorialPrompt state={state} />
        <span className="tutorial-next">{resolving ? 'Watch the result…'
          : canContinue ? step === 'complete' ? 'CONTINUE to choose your mode.' : 'CONTINUE when you’re ready.'
            : canAttack ? 'Check the preview, then ATTACK.'
              : !selectedExpectedPrefix && game.selectedTileIds.length ? 'Tap CLEAR, then follow the highlighted letters.'
                : `Select ${move?.word.split('').join(' · ')}.`}</span>
      </section>
    </div>

    <section className="player-zone" aria-label="Tutorial word selection">
      {(move || resultStep) && <AttackInfo word={visiblePreview?.word ?? ''} damage={visiblePreview?.strikes ?? 0} maxDamage={5} metric="strikes"
        bonuses={visiblePreview?.valid && step !== 'build' && step !== 'matching' ? getLetterStrikeBonuses(visiblePreview) : []}
        ready={canAttack}
        resolveBefore={showPrediction ? game.playerResolve : undefined}
        resolveAfter={showPrediction ? Math.max(0, game.playerResolve - preview.resolveCost) : undefined}
        recoveryText={recoveryText}
        message={!move && !resultStep ? 'PRACTICE · YOUR DAILY IS UNTOUCHED'
          : move && !game.selectedTileIds.length ? `BUILD ${move.word}`
            : step === 'build' ? 'LETTERS IN YOUR SELECTION ORDER'
              : step === 'matching' ? 'YOUR WORD · GLAD'
              : move && !preview.valid ? 'KEEP BUILDING' : undefined} />}
      <div className="controls">
        <TileGrid tiles={game.tiles} specialTiles={getLetterStrikeTileSummary(game)}
          revealedIndices={tileIndices} registerTile={registerTile}
          selectedTileIds={game.selectedTileIds} ready={allowedTileIds.length > 0 && !resolving}
          allowedTileIds={allowedTileIds}
          primaryLabel={primaryLabel} canAttack={canAttack || canContinue}
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

function TutorialPrompt({ state }: { state: TutorialState }) {
  switch (state.step) {
    case 'goal': return <><p>REMOVE EVERY ENEMY LETTER TO WIN.</p>
      <span className="tutorial-note">The enemy word is SAD: “feeling unhappy”.</span></>
    case 'resolve': return <><p>EACH WORD NORMALLY COSTS 1 RESOLVE.</p>
      <span className="tutorial-note">You have 5. Run out before the enemy is gone and you lose.</span></>
    case 'build': return <><p>BUILD GLAD IN THAT ORDER.</p>
      <span className="tutorial-note">Letters can be anywhere. Use 3+ letters.</span>
      <span className="tutorial-note">Tap a selected letter to undo, or CLEAR.</span></>
    case 'matching': return <><p>ONLY SHARED LETTERS CAN STRIKE.</p>
      <div className="tutorial-mapping" aria-label="Your selected A matches enemy A. Your selected D matches enemy D.">
        <span>Your <b>A</b></span><span aria-hidden="true">→</span><span>Enemy <b>A</b></span>
        <span>Your <b>D</b></span><span aria-hidden="true">→</span><span>Enemy <b>D</b></span>
      </div>
      <span className="tutorial-note">G and L don’t match SAD, so they cannot hit it.</span></>
    case 'counter': return <><p>GLAD COUNTERS SAD.</p>
      <span className="tutorial-note">Opposite meaning: every matching tile strikes. A and D will disappear.</span>
      <span className="tutorial-note">× means removed. Resolve will fall from 5 to 4.</span></>
    case 'counter-result': return <><p>A AND D ARE GONE. ONLY S REMAINS.</p>
      <span className="tutorial-note">Resolve: 5 → 4. Used tiles were replaced with new letters.</span></>
    case 'neutral': return <><p>SUN IS NEUTRAL: NO MEANING LINK.</p>
      <span className="tutorial-note">Normally, only the first matching tile in your word strikes.</span>
      <span className="tutorial-note">S will remove the last enemy letter. Resolve: 4 → 3.</span></>
    case 'basic-complete': return <><p>YOUR FIRST VICTORY.</p>
      <span className="tutorial-note">Every enemy letter is gone. Next: a few small practice examples.</span></>
    case 'armour': return <><p>A DOUBLE BORDER MEANS ARMOUR.</p>
      <span className="tutorial-note">S needs two strikes. SUN’s one strike will break its armour; S will stay.</span>
      <span className="tutorial-note">− means armour breaks. Resolve: 5 → 4.</span></>
    case 'armour-result': return <><p>S LOST ITS ARMOUR, NOT ITS LETTER.</p>
      <span className="tutorial-note">Double border → single border. It needs one more strike.</span></>
    case 'armour-finish': return <><p>STRIKE S ONCE MORE.</p>
      <span className="tutorial-note">Build SUN again. You may repeat words. This strike removes S.</span></>
    case 'armour-complete': return <><p>SECOND STRIKE: S IS GONE.</p>
      <span className="tutorial-note">Double border → single border → dot.</span></>
    case 'resisted': return <><p>SAD AGAINST SAD IS RESISTED.</p>
      <span className="tutorial-note">Same meaning: no normal strikes. Build SAD to preview 0.</span>
      <span className="tutorial-note">We’ll inspect it without spending Resolve.</span></>
    case 'strike': return <><p>A STRIKE TILE ALWAYS HITS ITS MATCH.</p>
      <span className="tutorial-note">This S has STRIKE. SAD is still resisted, but S will hit anyway.</span>
      <span className="tutorial-note">A and D get no normal strikes. Resolve: 5 → 4.</span></>
    case 'strike-result': return <><p>STRIKE REMOVED S THROUGH RESISTANCE.</p>
      <span className="tutorial-note">The special tile was used up. A and D stayed.</span></>
    case 'ward': return <><p>WARD SAVES THIS WORD’S RESOLVE.</p>
      <span className="tutorial-note">This example has 3 of 5 left. Use WARD D in DIG to remove D.</span>
      <span className="tutorial-note">Resolve will stay at 3 → 3.</span></>
    case 'ward-result': return <><p>WARD KEPT RESOLVE AT 3 OF 5.</p>
      <span className="tutorial-note">D disappeared. Resolve: 3 → 3. The WARD tile was used up.</span></>
    case 'regen-dead': return <><p className="tutorial-negative">REGEN HELPS THE ENEMY.</p>
      <span className="tutorial-note">E is gone. RED hits R, then REGEN E brings E back.</span>
      <span className="tutorial-note">Use the red E to inspect. No attack yet.</span></>
    case 'regen-alive': return <><p className="tutorial-negative">A LIVING LETTER CAN REGAIN ARMOUR.</p>
      <span className="tutorial-note">E is alive here. RED hits R, then REGEN E adds armour.</span>
      <span className="tutorial-note">Red + means recovery. Armour cannot exceed two hits.</span></>
    case 'regen-safe': return <><p>CHOOSE THE PLAIN E THIS TIME.</p>
      <span className="tutorial-note">Build RED without REGEN. R will disappear; E will stay unarmoured.</span></>
    case 'regen-result': return <><p>SAFE: R REMOVED. E DID NOT RECOVER.</p>
      <span className="tutorial-note">Check red recovery marks before Attack. REGEN affects only its matching letter.</span></>
    case 'grammar': return <><p>SOME ENEMIES HAVE WORD-TYPE WEAKNESSES.</p>
      <span className="tutorial-note">DAMP describes something. Its +1 lets D then A strike.</span>
      <span className="tutorial-note">Only confirmed word types earn a bonus.</span></>
    case 'grammar-result': return <><p>DAMP REMOVED D AND A.</p>
      <span className="tutorial-note">Neutral gave one strike; the adjective bonus gave another. Unconfirmed word types get no bonus.</span></>
    case 'long': return <><p>NEUTRAL WORDS OF 6+ LETTERS GET +1.</p>
      <span className="tutorial-note">STREAM has six letters. S then T will strike; R and M won’t.</span>
      <span className="tutorial-note">LONG and word-type bonuses can combine, when enough letters match.</span></>
    case 'long-result': return <><p>LONG ADDED A SECOND STRIKE.</p>
      <span className="tutorial-note">S and T are gone. The preview shows the exact targets before every Attack.</span></>
    case 'complete': return <><p>FIND WORDS. CHECK THE PREVIEW. CLEAR THE ENEMY.</p>
      <span className="tutorial-note">× removes · − breaks armour · red + restores.</span>
      <span className="tutorial-note">Watch Resolve and REGEN. Your Daily attempt is still untouched.</span></>
  }
}
