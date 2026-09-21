import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { projectTemplates, type ProjectTemplate } from './templates'
import { blockMeta } from './blockMeta'
import type { OrgMember } from './lib/organizationsRepository'

function memberLabel(member: OrgMember): string {
  return member.fullName || member.email.split('@')[0]
}

function TemplatesPanel({ members, onCreate }: { members: OrgMember[]; onCreate: (template: ProjectTemplate, name: string, managerUserId: string, managerName: string) => void }) {
  const [selected, setSelected] = useState<ProjectTemplate | null>(null)
  const [name, setName] = useState('')
  const [managerUserId, setManagerUserId] = useState('')

  function openTemplate(template: ProjectTemplate) {
    setSelected(template)
    setName(template.name)
    setManagerUserId(members[0]?.userId ?? '')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const manager = members.find((member) => member.userId === managerUserId)
    if (!selected || !name.trim() || !manager) return
    onCreate(selected, name.trim(), manager.userId, memberLabel(manager))
    setSelected(null)
  }

  return (
    <section className="templates-panel">
      <div className="activity-heading"><div><span className="canvas-kicker">COMEÇAR DE UM MODELO</span><h2>Templates</h2></div></div>
      <div className="template-grid">
        {projectTemplates.map((template) => (
          <article className="template-card" key={template.id}>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <div className="template-block-list">
              {blockMeta.map((meta) => {
                const count = template.notes.filter((note) => note.blockKey === meta.id).length
                return count === 0 ? null : <span key={meta.id} className="template-block-chip">{meta.title} · {count}</span>
              })}
            </div>
            <button type="button" className="primary-button" onClick={() => openTemplate(template)}><Plus size={15} /> Usar este template</button>
          </article>
        ))}
      </div>
      {selected && <div className="project-modal-backdrop" onClick={() => setSelected(null)}>
        <form className="project-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
          <span className="canvas-kicker">NOVO PROJETO A PARTIR DE TEMPLATE</span>
          <h2>{selected.name}</h2>
          <label>Nome do projeto
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </label>
          <label>Gerente do projeto
            <select value={managerUserId} onChange={(event) => setManagerUserId(event.target.value)}>
              {members.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}
            </select>
          </label>
          <div className="project-modal-actions">
            <button type="button" className="secondary-button" onClick={() => setSelected(null)}>Cancelar</button>
            <button type="submit" className="primary-button"><Plus size={15} /> Criar projeto</button>
          </div>
        </form>
      </div>}
    </section>
  )
}

export default TemplatesPanel
