import { lazy, Suspense } from 'react'
import PuzzleErrorBoundary from './components/PuzzleErrorBoundary'
import PuzzleLoading from './components/PuzzleLoading'
import './App.css'
import './components/DailyPanels.css'

const DailyApp = lazy(() => import('./daily/DailyChallenge'))
const WheelPreview = lazy(() => import('./experimental/wheel/WheelPreview'))

export default function App() {
  return <PuzzleErrorBoundary>
    <Suspense fallback={<PuzzleLoading />}>
      {new URLSearchParams(window.location.search).get('preview') === 'wheel' ? <WheelPreview /> : <DailyApp />}
    </Suspense>
  </PuzzleErrorBoundary>
}
