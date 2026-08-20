import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogIn, Mail, Sparkles, UserPlus } from 'lucide-react'
import { resetPasswordForEmail, signInWithMagicLink, signInWithPassword, signUpWithPassword } from './lib/authRepository'

type Mode = 'signin' | 'signup' | 'magic' | 'forgot'

const modeOptions: { id: Mode; label: string; icon: typeof LogIn }[] = [
  { id: 'signin', label: 'Entrar', icon: LogIn },
  { id: 'signup', label: 'Criar conta', icon: UserPlus },
  { id: 'magic', label: 'Link magico', icon: Sparkles },
]

function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password)
      } else if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUpWithPassword(email, password, fullName)
        if (needsEmailConfirmation) setInfo('Cadastro criado. Verifique seu e-mail para confirmar a conta antes de entrar.')
      } else if (mode === 'forgot') {
        await resetPasswordForEmail(email)
        setInfo('Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.')
      } else {
        await signInWithMagicLink(email)
        setInfo('Enviamos um link de acesso para o seu e-mail.')
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel completar a acao.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
        <span className="canvas-kicker">PROJECT MODEL CANVAS</span>
        <h1>{mode === 'forgot' ? 'Redefinir senha' : 'Acesse seu workspace'}</h1>
        {mode === 'forgot' ? (
          <button type="button" className="tiny-link" onClick={() => { setMode('signin'); setError(null); setInfo(null) }}>&larr; Voltar para o login</button>
        ) : (
          <div className="auth-tabs">
            {modeOptions.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={mode === id ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode(id); setError(null); setInfo(null) }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>Nome completo
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome" required />
            </label>
          )}
          <label>E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" required />
          </label>
          {mode !== 'magic' && mode !== 'forgot' && (
            <label>Senha
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" minLength={6} required />
            </label>
          )}
          {mode === 'signin' && (
            <button type="button" className="tiny-link forgot-password-link" onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}>Esqueci minha senha</button>
          )}
          {error && <div className="error-banner">{error}</div>}
          {info && <div className="info-banner">{info}</div>}
          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            {mode === 'magic' || mode === 'forgot' ? <Mail size={15} /> : <LogIn size={15} />}
            {loading ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'forgot' ? 'Enviar link de redefinição' : 'Enviar link magico'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthScreen
