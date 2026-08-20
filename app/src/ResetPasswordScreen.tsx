import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { updatePassword } from './lib/authRepository'

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      onDone()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
        <span className="canvas-kicker">REDEFINIR SENHA</span>
        <h1>Escolha uma nova senha</h1>
        <form onSubmit={handleSubmit}>
          <label>Nova senha
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" minLength={6} required autoFocus />
          </label>
          <label>Confirmar nova senha
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="********" minLength={6} required />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            <KeyRound size={15} />
            {loading ? 'Aguarde...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordScreen
