import type { ProjectRow } from './lib/projectsRepository'

function OverviewPanel({ projects, onOpenProject }: { projects: ProjectRow[]; onOpenProject: (projectId: string) => void }) {
  const total = projects.length
  const approved = projects.filter((project) => project.status === 'APROVADO').length
  const pending = total - approved
  const sorted = [...projects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  return (
    <section className="overview-panel">
      <div className="overview-stats">
        <div className="overview-stat"><strong>{total}</strong><span>Projetos</span></div>
        <div className="overview-stat"><strong>{approved}</strong><span>Aprovados</span></div>
        <div className="overview-stat"><strong>{pending}</strong><span>Aguardando aprovação</span></div>
      </div>
      <div className="overview-table">
        <div className="overview-row overview-head"><span>Projeto</span><span>Gerente</span><span>Status</span><span>Versão</span><span>Última revisão</span><span /></div>
        {sorted.length === 0 ? <p className="empty-search">Nenhum projeto ainda.</p> : sorted.map((project) => (
          <div className="overview-row" key={project.id}>
            <span className="overview-project-name">{project.name}</span>
            <span>{project.manager_name || '-'}</span>
            <span className={project.status === 'APROVADO' ? 'overview-badge approved' : 'overview-badge draft'}>{project.status}</span>
            <span>{project.version.toFixed(1)}</span>
            <span>{new Date(project.updated_at).toLocaleString('pt-BR')}</span>
            <button type="button" className="tiny-link" onClick={() => onOpenProject(project.id)}>Abrir</button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default OverviewPanel
