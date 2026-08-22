import { useEffect, useState } from 'react'
import { Activity, Check, FilePlus2 } from 'lucide-react'
import { listOrgAuditEvents, type OrgAuditEventRow } from './lib/auditRepository'
import { describeAuditEvent } from './auditDescriptions'

function OrgActivityPanel({ organizationId }: { organizationId: string }) {
  const [events, setEvents] = useState<OrgAuditEventRow[] | null>(null)

  useEffect(() => {
    listOrgAuditEvents(organizationId).then(setEvents)
  }, [organizationId])

  return (
    <section className="activity-panel">
      <div className="activity-heading">
        <div><span className="canvas-kicker">TODOS OS PROJETOS</span><h2>Atividade da organização</h2></div>
        {events && <span className="activity-count">{events.length} eventos</span>}
      </div>
      {events === null ? <p className="empty-search">Carregando...</p> : events.length === 0 ? <p className="empty-search">Nenhuma atividade registrada ainda.</p> : events.map((event) => (
        <div className="activity-item" key={event.id}>
          <span className={`activity-icon ${event.action === 'note_deleted' ? 'sand' : 'green'}`}>
            {event.action === 'project_approved' ? <Check size={14} /> : event.action === 'project_new_version' ? <FilePlus2 size={14} /> : <Activity size={14} />}
          </span>
          <div><strong>{describeAuditEvent(event)}</strong><small>{event.project_name} · {new Date(event.created_at).toLocaleString('pt-BR')}</small></div>
        </div>
      ))}
    </section>
  )
}

export default OrgActivityPanel
