import { lazy, Suspense } from 'react'
import PuzzleErrorBoundary from './components/PuzzleErrorBoundary'
import './App.css'
import './components/DailyPanels.css'

const DailyApp = lazy(() => import('./daily/DailyChallenge'))

export default function App() {
  return <PuzzleErrorBoundary>
    <Suspense fallback={<main className="container"><p>Loading puzzle…</p></main>}>
      <DailyApp />
    </Suspense>
  </PuzzleErrorBoundary>
}
