import './BingoHunt.css'

/** The same explanation appears before a fresh attempt and in Help. */
export default function BingoHuntInstructions({ partOfSpeech, daily = false, armour = false, hard = false }: {
  partOfSpeech: string; daily?: boolean; armour?: boolean; hard?: boolean
}) {
  return <div className="hunt-instructions">
    <p><strong>Find an opposite word using every enemy letter, including repeats.</strong>{hard
      ? ' Copy counts and guess previews are hidden.'
      : <>{armour && ' Each outline needs one copy.'} All red means bingo.</>}</p>
    <p>Tap tiles in order to spell an opposite <strong>{partOfSpeech}</strong>. Underlines match the enemy; unused tiles are fine.</p>
    <p><strong>Three lives.</strong> {hard ? <>Every new word costs one, even a wrong guess. Only antonyms remove spare tiles.</>
      : <>A simpler opposite uses one and removes spare tiles.</>} Played tiles stay; no refills.</p>
    <p>{hard ? <>Wrong guesses remove nothing, so <strong>spare tiles may remain on your last life</strong>.</>
      : <>Two simpler opposites leave <strong>just the bingo’s letters</strong>. Rearrange them to win.</>}</p>
    <p>{daily && 'One attempt per puzzle. '}{hard ? 'Non-words' : 'Other words'} and repeat guesses cost no lives.</p>
    <p className="hunt-rating">★★★ first guess · ★★ second · ★ third</p>
  </div>
}
