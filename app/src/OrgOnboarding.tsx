import { useState } from 'react'
import type { FormEvent } from 'react'
import { Building2 } from 'lucide-react'
import { createOrganization, type Membership } from './lib/organizationsRepository'
import { signOut } from './lib/authRepository'

function OrgOnboarding({ onCreated }: { onCreated: (membership: Membership) => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setError(null)
    setLoading(true)
    try {
      const membership = await createOrganization(name.trim())
      onCreated(membership)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel criar a organizacao.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
        <span className="canvas-kicker">QUASE LA</span>
        <h1><Building2 size={22} /> Crie sua organizacao</h1>
        <p className="auth-subtitle">A organizacao reune os projetos e os colaboradores do seu time.</p>
        <form onSubmit={handleSubmit}>
          <label>Nome da organizacao
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Nucleo de Projetos" autoFocus required />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? 'Aguarde...' : 'Criar organizacao'}</button>
        </form>
        <button type="button" className="tiny-link auth-signout" onClick={() => void signOut()}>Sair</button>
      </div>
    </div>
  )
}

export default OrgOnboarding
