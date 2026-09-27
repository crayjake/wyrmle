import WyrmCharacter from './WyrmCharacter'
import './PuzzleLoading.css'

export default function PuzzleLoading() {
  return <main className="container puzzle-loading" aria-busy="true">
    <div className="puzzle-loading-mascot" role="status" aria-label="Loading puzzle">
      <span className="puzzle-loading-wyrm"><WyrmCharacter idle loading /></span>
    </div>
  </main>
}
