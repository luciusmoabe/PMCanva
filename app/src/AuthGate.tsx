import { useEffect, useState } from 'react'
import App from './App'
import AuthScreen from './AuthScreen'
import OrgOnboarding from './OrgOnboarding'
import ResetPasswordScreen from './ResetPasswordScreen'
import MfaChallengeScreen from './MfaChallengeScreen'
import { useSession } from './lib/useSession'
import { isSupabaseConfigured } from './lib/supabase'
import { listMyMemberships, type Membership } from './lib/organizationsRepository'
import { getAssuranceLevel, listTotpFactors } from './lib/mfaRepository'

function AuthGate() {
  const { session, user, loading: sessionLoading, isPasswordRecovery, clearPasswordRecovery } = useSession()
  const [memberships, setMemberships] = useState<Membership[] | null>(null)
  const [mfaState, setMfaState] = useState<'checking' | 'required' | 'clear'>('checking')
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      setMemberships(null)
      setSelectedOrganizationId(null)
      return
    }
    let isMounted = true
    listMyMemberships().then((result) => { if (isMounted) setMemberships(result) })
    return () => { isMounted = false }
  }, [session])

  useEffect(() => {
    if (!session || isPasswordRecovery) { setMfaState('clear'); return }
    let isMounted = true
    setMfaState('checking')
    getAssuranceLevel().then(async ({ currentLevel, nextLevel }) => {
      if (!isMounted) return
      if (nextLevel === 'aal2' && currentLevel !== nextLevel) {
        const factors = await listTotpFactors()
        if (!isMounted) return
        setMfaFactorId(factors.find((factor) => factor.status === 'verified')?.id ?? null)
        setMfaState('required')
      } else {
        setMfaState('clear')
      }
    })
    return () => { isMounted = false }
  }, [session, isPasswordRecovery])

  if (!isSupabaseConfigured) {
    return <div className="auth-screen"><div className="auth-card"><h1>Backend nao configurado</h1><p className="auth-subtitle">Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em app/.env.local.</p></div></div>
  }

  if (sessionLoading) return <div className="auth-screen" />

  if (!session || !user) return <AuthScreen />

  if (isPasswordRecovery) return <ResetPasswordScreen onDone={clearPasswordRecovery} />

  if (mfaState === 'checking') return <div className="auth-screen" />

  if (mfaState === 'required') return <MfaChallengeScreen factorId={mfaFactorId} onVerified={() => setMfaState('clear')} />

  if (memberships === null) return <div className="auth-screen" />

  if (memberships.length === 0) {
    return <OrgOnboarding onCreated={(membership) => setMemberships([membership])} />
  }

  // A freshly-accepted invite link (see InviteLandingScreen) redirects here
  // with ?org=<id> so the newly joined organization opens immediately,
  // instead of always defaulting to the first membership.
  const requestedOrgId = new URLSearchParams(window.location.search).get('org')
  const storageKey = 'projectly.activeOrganization.' + user.id
  let savedOrganizationId: string | null = null
  try { savedOrganizationId = localStorage.getItem(storageKey) } catch { /* Storage may be unavailable. */ }
  const activeMembership = memberships.find((membership) => membership.organizationId === (selectedOrganizationId ?? requestedOrgId))
    ?? memberships.find((membership) => membership.organizationId === savedOrganizationId)
    ?? memberships[0]
  function selectOrganization(organizationId: string) {
    if (!memberships?.some((membership) => membership.organizationId === organizationId)) return
    setSelectedOrganizationId(organizationId)
    try { localStorage.setItem(storageKey, organizationId) } catch { /* Storage may be unavailable. */ }
    const url = new URL(window.location.href)
    url.searchParams.set('org', organizationId)
    window.history.replaceState(window.history.state, '', url)
  }
  return <App key={user.id + ':' + activeMembership.organizationId} session={session} organizationId={activeMembership.organizationId} organizationName={activeMembership.organizationName} role={activeMembership.role} memberships={memberships} onSelectOrganization={selectOrganization} />
}

export default AuthGate
