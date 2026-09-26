import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { trackViewport } from './viewport'

const stopTrackingViewport = trackViewport()
if (import.meta.hot) import.meta.hot.dispose(stopTrackingViewport)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
