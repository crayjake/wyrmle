import { lazy, Suspense } from 'react'
import PuzzleErrorBoundary from './components/PuzzleErrorBoundary'
import PuzzleLoading from './components/PuzzleLoading'
import './App.css'
import './components/DailyPanels.css'

const DailyApp = lazy(() => import('./daily/DailyChallenge'))

export default function App() {
  return <PuzzleErrorBoundary>
    <Suspense fallback={<PuzzleLoading />}>
      <DailyApp />
    </Suspense>
  </PuzzleErrorBoundary>
}
