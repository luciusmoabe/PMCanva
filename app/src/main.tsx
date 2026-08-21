import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './AuthGate.tsx'
import PublicCanvasView from './PublicCanvasView.tsx'

const shareToken = new URLSearchParams(window.location.search).get('share')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareToken ? <PublicCanvasView token={shareToken} /> : <AuthGate />}
  </StrictMode>,
)
