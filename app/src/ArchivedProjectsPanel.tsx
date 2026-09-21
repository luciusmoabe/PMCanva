import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { listArchivedProjects, type ProjectRow } from './lib/projectsRepository'

function ArchivedProjectsPanel({ organizationId, onRestore }: { organizationId: string; onRestore: (projectId: string) => Promise<void> }) {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)

  function refresh() {
    listArchivedProjects(organizationId).then(setProjects)
  }

  useEffect(refresh, [organizationId])

  async function handleRestore(projectId: string) {
    await onRestore(projectId)
    refresh()
  }

  return (
    <section className="overview-panel">
      <div className="activity-heading"><div><span className="canvas-kicker">PROJETOS ARQUIVADOS</span><h2>Arquivados</h2></div></div>
      <div className="overview-table">
        <div className="overview-row overview-head"><span>Projeto</span><span>Gerente</span><span>Status</span><span>Versão</span><span>Arquivado em</span><span /></div>
        {projects === null ? <p className="empty-search">Carregando...</p> : projects.length === 0 ? <p className="empty-search">Nenhum projeto arquivado.</p> : projects.map((project) => (
          <div className="overview-row" key={project.id}>
            <span className="overview-project-name">{project.name}</span>
            <span>{project.manager_name || '-'}</span>
            <span className={project.status === 'APROVADO' ? 'overview-badge approved' : 'overview-badge draft'}>{project.status}</span>
            <span>{project.version.toFixed(1)}</span>
            <span>{project.archived_at ? new Date(project.archived_at).toLocaleString('pt-BR') : '-'}</span>
            <button type="button" className="tiny-link" onClick={() => handleRestore(project.id)}><RotateCcw size={12} /> Restaurar</button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ArchivedProjectsPanel
