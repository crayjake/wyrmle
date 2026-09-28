import './BingoHunt.css'

/** The same explanation appears before a fresh attempt and in Help. */
export default function BingoHuntInstructions({ partOfSpeech, daily = false }: { partOfSpeech: string; daily?: boolean }) {
  return <div className="hunt-instructions">
    <p><strong>Find an opposite word using every enemy letter, including repeats.</strong> All red means bingo. You don’t need every tile.</p>
    <p>Tap tiles in order to spell an opposite <strong>{partOfSpeech}</strong> for the meaning shown. Underlined tiles match the enemy.</p>
    <p><strong>Stuck? Play a simpler opposite.</strong> Each uses one of your three lives and removes spare tiles. Words don’t use up their tiles. There are no refills.</p>
    <p>On your last life, <strong>only the bingo’s letters remain</strong>. Rearrange them to win.</p>
    <p>{daily && 'One attempt per day. '}Other words and repeat guesses cost no lives.</p>
    <p className="hunt-rating">★★★ first guess · ★★ second · ★ third</p>
  </div>
}
