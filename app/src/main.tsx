import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './AuthGate.tsx'
import PublicCanvasView from './PublicCanvasView.tsx'
import InviteLandingScreen from './InviteLandingScreen.tsx'

const searchParams = new URLSearchParams(window.location.search)
const shareToken = searchParams.get('share')
const invitationId = searchParams.get('invite')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareToken ? <PublicCanvasView token={shareToken} /> : invitationId ? <InviteLandingScreen invitationId={invitationId} /> : <AuthGate />}
  </StrictMode>,
)
