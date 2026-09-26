import { lazy, Suspense } from 'react'
import { readBingoPreviewRequest } from './experimental/bingo/catalog'
import PuzzleErrorBoundary from './components/PuzzleErrorBoundary'
import './App.css'
import './components/DailyPanels.css'

const DailyApp = lazy(() => import('./LegacyDailyApp'))
const BingoPreview = lazy(() => import('./experimental/BingoPreview'))

export default function App() {
  const preview = readBingoPreviewRequest(window.location.search)
  return <PuzzleErrorBoundary>
    <Suspense fallback={<main className="container"><p>Loading puzzle…</p></main>}>
      {preview ? <BingoPreview request={preview} /> : <DailyApp />}
    </Suspense>
  </PuzzleErrorBoundary>
}
