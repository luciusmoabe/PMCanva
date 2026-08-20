import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { enrollTotp, listTotpFactors, unenrollTotp, verifyTotpEnrollment, type TotpFactor } from './lib/mfaRepository'

function SecurityPanel() {
  const [factors, setFactors] = useState<TotpFactor[] | null>(null)
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  function refreshFactors() {
    listTotpFactors().then(setFactors)
  }

  useEffect(refreshFactors, [])

  const verifiedFactor = factors?.find((factor) => factor.status === 'verified') ?? null

  async function startEnrollment() {
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      for (const factor of factors ?? []) {
        if (factor.status === 'unverified') await unenrollTotp(factor.id)
      }
      const result = await enrollTotp()
      setEnrollment(result)
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : 'Não foi possível iniciar a ativação.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmEnrollment(event: FormEvent) {
    event.preventDefault()
    if (!enrollment) return
    setError(null)
    setLoading(true)
    try {
      await verifyTotpEnrollment(enrollment.factorId, code)
      setEnrollment(null)
      setCode('')
      setInfo('Autenticação em duas etapas ativada.')
      refreshFactors()
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  async function disableMfa() {
    if (!verifiedFactor) return
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await unenrollTotp(verifiedFactor.id)
      setInfo('Autenticação em duas etapas desativada.')
      refreshFactors()
    } catch (unenrollError) {
      setError(unenrollError instanceof Error ? unenrollError.message : 'Não foi possível desativar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="activity-panel security-panel">
      <div className="activity-heading">
        <div><span className="canvas-kicker">SEGURANÇA DA CONTA</span><h2>Autenticação em duas etapas</h2></div>
      </div>
      <div className="security-body">
        {factors === null ? <p className="empty-search">Carregando...</p> : enrollment ? (
          <>
            <p>Escaneie o QR code com um app autenticador (Google Authenticator, Authy, 1Password...) e digite o código gerado para confirmar.</p>
            <img className="mfa-qr" src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qrCode)}`} alt="QR code para configurar o autenticador" />
            <p className="mfa-secret">Ou digite manualmente: <code>{enrollment.secret}</code></p>
            <form onSubmit={confirmEnrollment}>
              <label>Código de 6 dígitos
                <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} required autoFocus />
              </label>
              {error && <div className="error-banner">{error}</div>}
              <div className="composer-actions"><button type="button" className="secondary-button" onClick={() => { setEnrollment(null); setCode(''); setError(null) }}>Cancelar</button><button type="submit" className="primary-button" disabled={loading}><ShieldCheck size={15} /> Confirmar</button></div>
            </form>
          </>
        ) : verifiedFactor ? (
          <>
            <p className="mfa-status"><ShieldCheck size={16} className="mfa-status-icon" /> Autenticação em duas etapas está <b>ativada</b> na sua conta.</p>
            {info && <div className="info-banner">{info}</div>}
            {error && <div className="error-banner">{error}</div>}
            <button className="danger-button" onClick={disableMfa} disabled={loading}><ShieldOff size={15} /> Desativar</button>
          </>
        ) : (
          <>
            <p className="mfa-status">Sua conta ainda não tem autenticação em duas etapas. Ative para exigir um código do celular, além da senha, a cada login.</p>
            {info && <div className="info-banner">{info}</div>}
            {error && <div className="error-banner">{error}</div>}
            <button className="primary-button" onClick={startEnrollment} disabled={loading}><ShieldCheck size={15} /> Ativar autenticação em duas etapas</button>
          </>
        )}
      </div>
    </section>
  )
}

export default SecurityPanel
