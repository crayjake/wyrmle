import { lazy, Suspense } from 'react'
import PuzzleErrorBoundary from './components/PuzzleErrorBoundary'
import PuzzleLoading from './components/PuzzleLoading'
import './App.css'
import './components/DailyPanels.css'

const DailyApp = lazy(() => import('./daily/DailyChallenge'))
const WheelPreview = lazy(() => import('./experimental/wheel/WheelPreview'))
const ConceptPreviews = lazy(() => import('./experimental/synonyms/ConceptPreviews'))

export default function App() {
  const preview = new URLSearchParams(window.location.search).get('preview')
  return <PuzzleErrorBoundary>
    <Suspense fallback={<PuzzleLoading />}>
      {preview === 'concepts' ? <ConceptPreviews /> : preview === 'wheel' ? <WheelPreview /> : <DailyApp />}
    </Suspense>
  </PuzzleErrorBoundary>
}
