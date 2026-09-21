import { useEffect, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { getPublicCanvasVersion, type PublicCanvasVersion } from './lib/canvasVersionsRepository'
import { blockMeta } from './blockMeta'
import './App.css'

function PublicCanvasView({ token }: { token: string }) {
  const [version, setVersion] = useState<PublicCanvasVersion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicCanvasVersion(token).then((result) => {
      setVersion(result)
      setLoading(false)
    })
  }, [token])

  if (loading) return <div className="auth-screen" />

  if (!version) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
          <h1>Link não encontrado</h1>
          <p>Esse link de leitura pública não existe ou não está mais disponível.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-canvas-page">
      <header className="public-canvas-header">
        <div className="brand"><span className="brand-mark">P</span><span>projectly</span></div>
        <span className="public-canvas-badge"><ShieldCheck size={13} /> Somente leitura</span>
      </header>
      <div className="canvas-wrap">
        <div className="canvas-intro">
          <div>
            <span className="canvas-kicker">VERSÃO APROVADA · SOMENTE LEITURA</span>
            <h2>{version.project_name} <span>·</span> <small>versão {version.version.toFixed(1)} · gerente {version.manager_name}</small></h2>
          </div>
        </div>
        <div className="canvas-grid">
          {blockMeta.map((meta) => {
            const notes = version.notes_snapshot.filter((note) => note.block_key === meta.id)
            return (
              <article key={meta.id} className={`canvas-block ${meta.tone}`}>
                <div className="block-header"><div><span className="question-label">{meta.question}</span><h3>{meta.title}</h3></div></div>
                <div className="notes-list">
                  {notes.map((note, index) => (
                    <div className={`note ${note.color}`} key={index}>
                      <p>{note.text}</p>
                      <div className="note-footer">
                        <span className="note-author">{note.author}</span>
                        {note.status === 'done' && <Check size={13} className="note-check" />}
                        {note.status === 'review' && <span className="review-label">revisar</span>}
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && <span className="empty-search">Nenhuma nota</span>}
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <p className="public-canvas-footer">Aprovado em {new Date(version.approved_at).toLocaleString('pt-BR')} · gerado pelo projectly</p>
    </div>
  )
}

export default PublicCanvasView
