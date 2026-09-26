import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { trackViewport } from './viewport'
import { migrateArchiveProgress } from './daily/archiveProgress'

const stopTrackingViewport = trackViewport()
if (import.meta.hot) import.meta.hot.dispose(stopTrackingViewport)
// Migrate before mounting either the calendar or a game. Originals are retained.
try { migrateArchiveProgress(window.localStorage) } catch { /* A blocked store must not prevent play. */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
