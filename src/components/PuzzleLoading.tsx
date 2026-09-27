import WyrmCharacter from './WyrmCharacter'
import './PuzzleLoading.css'

export default function PuzzleLoading() {
  return <main className="container puzzle-loading" aria-busy="true">
    <div className="puzzle-loading-orbit" role="status" aria-label="Loading puzzle">
      <span className="puzzle-loading-ring" aria-hidden="true" />
      <span className="puzzle-loading-wyrm"><WyrmCharacter idle /></span>
    </div>
  </main>
}
