import { useEffect, useState } from 'react'
import App from './App'
import AuthScreen from './AuthScreen'
import OrgOnboarding from './OrgOnboarding'
import { useSession } from './lib/useSession'
import { isSupabaseConfigured } from './lib/supabase'
import { listMyMemberships, type Membership } from './lib/organizationsRepository'

function AuthGate() {
  const { session, user, loading: sessionLoading } = useSession()
  const [memberships, setMemberships] = useState<Membership[] | null>(null)

  useEffect(() => {
    if (!session) {
      setMemberships(null)
      return
    }
    let isMounted = true
    listMyMemberships().then((result) => { if (isMounted) setMemberships(result) })
    return () => { isMounted = false }
  }, [session])

  if (!isSupabaseConfigured) {
    return <div className="auth-screen"><div className="auth-card"><h1>Backend nao configurado</h1><p className="auth-subtitle">Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em app/.env.local.</p></div></div>
  }

  if (sessionLoading) return <div className="auth-screen" />

  if (!session || !user) return <AuthScreen />

  if (memberships === null) return <div className="auth-screen" />

  if (memberships.length === 0) {
    return <OrgOnboarding onCreated={(membership) => setMemberships([membership])} />
  }

  const activeMembership = memberships[0]
  return <App session={session} organizationId={activeMembership.organizationId} organizationName={activeMembership.organizationName} role={activeMembership.role} />
}

export default AuthGate
