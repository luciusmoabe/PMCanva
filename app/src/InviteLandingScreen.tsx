import { useEffect, useState } from 'react'
import { Building2, Check, LogOut } from 'lucide-react'
import { useSession } from './lib/useSession'
import { isSupabaseConfigured } from './lib/supabase'
import { acceptInvitation, getInvitationPreview, type InvitationPreview } from './lib/invitationsRepository'
import { roleLabels } from './lib/roleLabels'
import { signOut } from './lib/authRepository'
import AuthScreen from './AuthScreen'
import './App.css'

function goToApp(organizationId?: string) {
  const target = organizationId ? `${window.location.origin}${window.location.pathname}?org=${organizationId}` : `${window.location.origin}${window.location.pathname}`
  window.location.href = target
}

function InviteLandingScreen({ invitationId }: { invitationId: string }) {
  const { session, user, loading: sessionLoading } = useSession()
  const [preview, setPreview] = useState<InvitationPreview | null | undefined>(undefined)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getInvitationPreview(invitationId).then(setPreview)
  }, [invitationId])

  async function handleAccept() {
    setError(null)
    setAccepting(true)
    try {
      const membership = await acceptInvitation(invitationId)
      goToApp(membership.organizationId)
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Nao foi possivel aceitar o convite.')
      setAccepting(false)
    }
  }

  if (!isSupabaseConfigured) {
    return <div className="auth-screen"><div className="auth-card"><h1>Backend nao configurado</h1><p className="auth-subtitle">Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em app/.env.local.</p></div></div>
  }

  if (preview === undefined || sessionLoading) return <div className="auth-screen" />

  if (preview === null || preview.status !== 'pending') {
    const message =
      preview?.status === 'accepted' ? 'Esse convite ja foi aceito.' :
      preview?.status === 'revoked' ? 'Esse convite foi revogado pelo administrador.' :
      'Esse link de convite nao existe ou nao esta mais disponivel.'
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
          <h1>Convite indisponivel</h1>
          <p className="auth-subtitle">{message}</p>
          <button type="button" className="primary-button auth-submit" onClick={() => goToApp()}>Ir para o projectly</button>
        </div>
      </div>
    )
  }

  const expired = new Date(preview.expiresAt).getTime() < Date.now()
  if (expired) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
          <h1>Convite expirado</h1>
          <p className="auth-subtitle">Este link de convite para <b>{preview.organizationName}</b> venceu. Peca para o administrador enviar um novo.</p>
          <button type="button" className="primary-button auth-submit" onClick={() => goToApp()}>Ir para o projectly</button>
        </div>
      </div>
    )
  }

  if (!session || !user) {
    const banner = (
      <>
        <span className="canvas-kicker">VOCE FOI CONVIDADO</span>
        <p className="auth-subtitle">
          <Building2 size={13} /> Entre ou crie sua conta com <b>{preview.email}</b> para entrar em <b>{preview.organizationName}</b> como {roleLabels[preview.role]}.
        </p>
      </>
    )
    return <AuthScreen initialEmail={preview.email} lockEmail banner={banner} />
  }

  if (user.email && user.email.toLowerCase() !== preview.email) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
          <h1>Convite para outro e-mail</h1>
          <p className="auth-subtitle">Este convite para <b>{preview.organizationName}</b> foi enviado para <b>{preview.email}</b>, mas voce esta conectado como <b>{user.email}</b>.</p>
          {error && <div className="error-banner">{error}</div>}
          <button type="button" className="primary-button auth-submit" onClick={() => void signOut()}><LogOut size={15} /> Sair e entrar com outro e-mail</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
        <span className="canvas-kicker">VOCE FOI CONVIDADO</span>
        <h1><Building2 size={22} /> {preview.organizationName}</h1>
        <p className="auth-subtitle">Voce vai entrar como <b>{roleLabels[preview.role]}</b>.</p>
        {error && <div className="error-banner">{error}</div>}
        <button type="button" className="primary-button auth-submit" disabled={accepting} onClick={() => void handleAccept()}>
          <Check size={15} /> {accepting ? 'Aguarde...' : 'Aceitar convite'}
        </button>
      </div>
    </div>
  )
}

export default InviteLandingScreen
