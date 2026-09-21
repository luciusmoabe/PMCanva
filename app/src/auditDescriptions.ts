import { blockMeta } from './blockMeta'
import type { AuditEventRow } from './lib/auditRepository'

export function describeAuditEvent(event: AuditEventRow): string {
  const blockTitle = blockMeta.find((meta) => meta.id === event.block_key)?.title ?? event.block_key ?? ''
  switch (event.action) {
    case 'note_created': return `${event.actor_label} adicionou uma nota em ${blockTitle}`
    case 'note_updated': return `${event.actor_label} editou uma nota em ${blockTitle}`
    case 'note_deleted': return `${event.actor_label} excluiu uma nota em ${blockTitle}`
    case 'project_approved': return `${event.actor_label} aprovou o projeto`
    case 'project_new_version': return `${event.actor_label} criou uma nova versão`
    case 'block_approved': return `${event.actor_label} aprovou o bloco ${blockTitle}`
    case 'block_unapproved': return `${event.actor_label} desfez a aprovação do bloco ${blockTitle}`
    case 'project_archived': return `${event.actor_label} arquivou o projeto`
    case 'project_restored': return `${event.actor_label} restaurou o projeto`
    case 'project_submitted': return `${event.actor_label} enviou o projeto para validação`
    case 'project_execution_started': return `${event.actor_label} iniciou a execução do projeto`
    case 'project_returned_to_draft': return `${event.actor_label} devolveu o projeto para rascunho`
    case 'requirement_linked': return `${event.actor_label} vinculou um requisito a uma entrega`
    case 'requirement_unlinked': return `${event.actor_label} desvinculou um requisito de uma entrega`
    default: return event.actor_label
  }
}
