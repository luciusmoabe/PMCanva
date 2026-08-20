import { useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { verifyLoginChallenge } from './lib/mfaRepository'
import { signOut } from './lib/authRepository'

function MfaChallengeScreen({ factorId, onVerified }: { factorId: string | null; onVerified: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!factorId) {
      setError('Fator de autenticação não encontrado. Saia e entre novamente.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await verifyLoginChallenge(factorId, code)
      onVerified()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
        <span className="canvas-kicker">VERIFICAÇÃO EM DUAS ETAPAS</span>
        <h1>Digite o código do app autenticador</h1>
        <form onSubmit={handleSubmit}>
          <label>Código de 6 dígitos
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} required autoFocus />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            <ShieldCheck size={15} />
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>
        <button type="button" className="tiny-link forgot-password-link" onClick={() => void signOut()}>Sair</button>
      </div>
    </div>
  )
}

export default MfaChallengeScreen
