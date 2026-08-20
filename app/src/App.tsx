import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, Archive, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleHelp, FilePlus2, Filter, FolderKanban, Grid2X2, LayoutDashboard, MessageCircle, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import {
  createNote,
  createProject as createProjectRequest,
  deleteNote,
  listNotes,
  listProjects,
  subscribeToProject,
  updateNote,
  updateProject,
  type NoteRow,
  type ProjectRow,
} from './lib/projectsRepository'
import type { Membership } from './lib/organizationsRepository'
import { signOut } from './lib/authRepository'
import { getDisplayName, getInitials } from './lib/userDisplay'
import './App.css'

type BlockMeta = { id: string; title: string; question: string; tone: string }
type CanvasBlock = BlockMeta & { notes: NoteRow[] }

const blockMeta: BlockMeta[] = [
  { id: 'why', title: 'Justificativas', question: 'POR QUE?', tone: 'coral' },
  { id: 'objectives', title: 'Objetivos SMART', question: 'POR QUE?', tone: 'coral' },
  { id: 'benefits', title: 'Benefícios', question: 'POR QUE?', tone: 'coral' },
  { id: 'product', title: 'Produto', question: 'O QUE?', tone: 'gold' },
  { id: 'requirements', title: 'Requisitos', question: 'O QUE?', tone: 'gold' },
  { id: 'stakeholders', title: 'Stakeholders externos', question: 'QUEM?', tone: 'teal' },
  { id: 'team', title: 'Equipe', question: 'QUEM?', tone: 'teal' },
  { id: 'assumptions', title: 'Premissas', question: 'COMO?', tone: 'blue' },
  { id: 'deliverables', title: 'Grupo de entregas', question: 'COMO?', tone: 'blue' },
  { id: 'constraints', title: 'Restrições', question: 'COMO?', tone: 'blue' },
  { id: 'risks', title: 'Riscos', question: 'COMO?', tone: 'blue' },
  { id: 'timeline', title: 'Linha do tempo', question: 'QUANDO?', tone: 'purple' },
  { id: 'costs', title: 'Custos', question: 'QUANTO?', tone: 'purple' },
]

const roleLabels: Record<Membership['role'], string> = { admin: 'Administrador', editor: 'Editor', commenter: 'Comentarista', reader: 'Leitor' }

const navItems = [{ label: 'Visão geral', icon: LayoutDashboard }, { label: 'Meus projetos', icon: FolderKanban, count: '8' }, { label: 'Templates', icon: Grid2X2 }, { label: 'Equipe', icon: Users }]

function ProjectControls({ projects, activeProjectId, onSelect, onCreate }: { projects: ProjectRow[]; activeProjectId: string | null; onSelect: (id: string) => void; onCreate: (name: string, manager: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [manager, setManager] = useState('')
  const activeProject = projects.find((project) => project.id === activeProjectId)
  return <div className="project-controls"><button className="project-select" onClick={() => setIsOpen(!isOpen)}><span className="workspace-avatar">N</span><span><b>{activeProject?.name ?? 'Nenhum projeto'}</b><small>Projeto atual · {activeProject?.manager_name ?? '-'}</small></span><ChevronDown size={15} /></button>{isOpen && <div className="project-menu"><span className="project-menu-label">PROJETOS DA ORGANIZAÇÃO</span>{projects.map((project) => <button key={project.id} className={project.id === activeProjectId ? 'project-option selected' : 'project-option'} onClick={() => { onSelect(project.id); setIsOpen(false) }}><span><b>{project.name}</b><small>GP · {project.manager_name}</small></span>{project.id === activeProjectId && <Check size={14} />}</button>)}<button className="new-project-option" onClick={() => { setIsCreating(true); setIsOpen(false) }}><Plus size={14} /> Novo projeto</button></div>}{isCreating && <div className="project-modal-backdrop" onClick={() => setIsCreating(false)}><form className="project-modal" onSubmit={(event) => { event.preventDefault(); if (name.trim() && manager.trim()) { onCreate(name.trim(), manager.trim()); setIsCreating(false); setName(''); setManager('') } }} onClick={(event) => event.stopPropagation()}><span className="canvas-kicker">NOVO PROJETO</span><h2>Criar canvas do projeto</h2><label>Nome do projeto<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Implantação do PMO" autoFocus /></label><label>Gerente do projeto<input value={manager} onChange={(event) => setManager(event.target.value)} placeholder="Ex.: Ana Souza" /></label><div className="project-modal-actions"><button type="button" className="secondary-button" onClick={() => setIsCreating(false)}>Cancelar</button><button type="submit" className="primary-button"><Plus size={15} /> Criar projeto</button></div></form></div>}</div>
}

function App({ session, organizationId, organizationName, role }: { session: Session; organizationId: string; organizationName: string; role: Membership['role'] }) {
  const user = session.user
  const displayName = getDisplayName(user)
  const initials = getInitials(displayName)
  const canEdit = role === 'admin' || role === 'editor'

  const [activeNav, setActiveNav] = useState('Meus projetos')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [isProjectsLoading, setIsProjectsLoading] = useState(true)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [selectedBlock, setSelectedBlock] = useState('why')
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingNote, setEditingNote] = useState<{ blockId: string; note: NoteRow } | null>(null)
  const [newNote, setNewNote] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<string[]>(() => JSON.parse(localStorage.getItem('projectly-comments') ?? '[]') as string[])
  const [newComment, setNewComment] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'review' | 'done'>('all')
  const [showActivity, setShowActivity] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'online' | 'offline'>('offline')
  const [actionError, setActionError] = useState<string | null>(null)

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null

  const blocks: CanvasBlock[] = useMemo(
    () => blockMeta.map((meta) => ({ ...meta, notes: notes.filter((note) => note.block_key === meta.id) })),
    [notes],
  )
  const filteredBlocks = blocks
    .map((block) => ({ ...block, notes: block.notes.filter((note) => note.text.toLowerCase().includes(search.toLowerCase()) && (activeFilter === 'all' || note.status === activeFilter)) }))
    .filter((block) => activeFilter === 'all' || block.notes.length > 0)

  useEffect(() => {
    let isMounted = true
    setIsProjectsLoading(true)
    listProjects(organizationId).then((result) => {
      if (!isMounted) return
      setProjects(result)
      setIsProjectsLoading(false)
      setActiveProjectId((current) => current ?? result[0]?.id ?? null)
    })
    return () => { isMounted = false }
  }, [organizationId])

  useEffect(() => {
    if (!activeProjectId) { setNotes([]); return }
    let isMounted = true
    listNotes(activeProjectId).then((result) => { if (isMounted) setNotes(result) })
    const unsubscribe = subscribeToProject(activeProjectId, {
      onNoteInsert: (note) => setNotes((current) => (current.some((item) => item.id === note.id) ? current : [...current, note])),
      onNoteUpdate: (note) => setNotes((current) => current.map((item) => (item.id === note.id ? note : item))),
      onNoteDelete: (noteId) => setNotes((current) => current.filter((item) => item.id !== noteId)),
      onProjectUpdate: (project) => setProjects((current) => current.map((item) => (item.id === project.id ? project : item))),
    }, setRealtimeStatus)
    return () => { isMounted = false; unsubscribe() }
  }, [activeProjectId])

  useEffect(() => { localStorage.setItem('projectly-comments', JSON.stringify(comments)) }, [comments])

  function addComment() {
    if (!newComment.trim()) return
    setComments((current) => [...current, newComment.trim()])
    setNewComment('')
  }

  function exportCanvas() {
    if (!activeProject) return
    const payload = JSON.stringify({ project: activeProject.name, manager: activeProject.manager_name, status: activeProject.status, version: activeProject.version, blocks, comments }, null, 2)
    const file = new Blob([payload], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(file)
    link.download = `canvas-pmo-v${activeProject.version.toFixed(1)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function addNote() {
    if (!newNote.trim() || !activeProjectId) return
    try {
      const note = await createNote(activeProjectId, selectedBlock, newNote.trim(), initials)
      setNotes((current) => [...current, note])
      setNewNote('')
      setIsAdding(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível adicionar a nota.')
    }
  }

  async function saveEditedNote() {
    if (!editingNote || !editingNote.note.text.trim()) return
    const { id, text, status } = editingNote.note
    try {
      await updateNote(id, { text, status })
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, text, status } : note)))
      setEditingNote(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível salvar a nota.')
    }
  }

  async function deleteEditedNote() {
    if (!editingNote) return
    const { id } = editingNote.note
    try {
      await deleteNote(id)
      setNotes((current) => current.filter((note) => note.id !== id))
      setEditingNote(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível excluir a nota.')
    }
  }

  function selectProject(projectId: string) {
    setActiveProjectId(projectId)
  }

  async function createProject(name: string, manager: string) {
    try {
      const project = await createProjectRequest(organizationId, name, manager)
      setProjects((current) => [...current, project])
      setActiveProjectId(project.id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar o projeto.')
    }
  }

  async function bumpVersion() {
    if (!activeProject) return
    const nextVersion = Number((activeProject.version + 0.1).toFixed(1))
    try {
      await updateProject(activeProject.id, { version: nextVersion, status: 'RASCUNHO' })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, version: nextVersion, status: 'RASCUNHO' } : project)))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar uma nova versão.')
    }
  }

  async function approveProject() {
    if (!activeProject) return
    try {
      await updateProject(activeProject.id, { status: 'APROVADO' })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, status: 'APROVADO' } : project)))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível aprovar o projeto.')
    }
  }

  return (
    <div className="app-shell"><ProjectControls projects={projects} activeProjectId={activeProjectId} onSelect={selectProject} onCreate={createProject} />
      <aside className="sidebar"><div className="brand"><span className="brand-mark">P</span><span>projectly</span></div><div className="workspace-switcher"><span className="workspace-avatar">{organizationName.slice(0, 1).toUpperCase() || 'O'}</span><span><b>{organizationName}</b><small>Workspace principal</small></span><ChevronDown size={15} /></div><nav className="main-nav" aria-label="Navegação principal"><span className="nav-caption">WORKSPACE</span>{navItems.map(({ label, icon: Icon, count }) => <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(label)}><Icon size={17} /><span>{label}</span>{count && <em>{count}</em>}</button>)}<span className="nav-caption nav-caption-spaced">GESTÃO</span><button className="nav-item"><Activity size={17} /><span>Atividade</span><i className="unread-dot" /></button><button className="nav-item"><Archive size={17} /><span>Arquivados</span></button></nav><div className="sidebar-bottom"><div className="upgrade-card"><Sparkles size={16} /><div><strong>Plano Team</strong><small>{projects.length} projetos ativos</small></div><ArrowUpRight size={14} /></div><button className="nav-item"><Settings size={17} /><span>Configurações</span></button><button className="user-card" onClick={() => void signOut()} title="Sair"><span className="avatar">{initials}</span><span><b>{displayName}</b><small>{roleLabels[role]}</small></span><MoreHorizontal size={16} /></button></div></aside>
      <main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Meus projetos</span><span>/</span><b>{activeProject?.name ?? 'Sem projeto'}</b></div><div className="top-actions"><button className="icon-button" title="Ajuda"><CircleHelp size={18} /></button><button className="icon-button notification" title="Notificações"><Bell size={18} /><i /></button><span className="top-avatar">{initials}</span></div></header><div className="page-content">
        {actionError && <div className="error-banner page-error"><span>{actionError}</span><button className="icon-button" onClick={() => setActionError(null)}><X size={14} /></button></div>}
        {isProjectsLoading ? <p className="empty-search">Carregando projetos...</p> : !activeProject ? (
          <section className="project-heading"><div><span className="canvas-kicker">COMECE POR AQUI</span><h1>Nenhum projeto ainda</h1><p>Use "Novo projeto" no canto superior esquerdo para criar o primeiro canvas da organização.</p></div></section>
        ) : <>
        <section className="project-heading"><div><div className="eyebrow"><span className="status-dot" /> {activeProject.status}</div><h1>{activeProject.name}</h1><p>Uma visão compartilhada para transformar ideias em projetos alinhados.</p></div>{canEdit && <div className="heading-actions"><button className="secondary-button" onClick={bumpVersion}><FilePlus2 size={16} /> Nova versão</button><button className="primary-button" onClick={approveProject}><Check size={16} /> {activeProject.status === 'APROVADO' ? 'Canvas aprovado' : 'Enviar para aprovação'}</button></div>}</section><section className="meta-row"><div className="people"><div className="avatar-stack"><span className="avatar-stack-item teal">{initials}</span></div><span>{displayName}</span></div><div className="meta-items"><button className={showComments ? 'meta-button active' : 'meta-button'} onClick={() => setShowComments(!showComments)}><MessageCircle size={15} /> comentários</button><span className="divider" /><button className="meta-button"><ShieldCheck size={15} /> versão {activeProject.version.toFixed(1)}</button></div></section>{showComments && <aside className="comments-panel"><div><span className="canvas-kicker">DISCUSSÃO ATIVA</span><strong>Comentários do canvas</strong></div><p>Os comentários abaixo ficam salvos apenas neste navegador.</p></aside>}<div className="toolbar"><div className="view-tabs"><button className={showActivity ? 'view-tab' : 'view-tab active'} onClick={() => setShowActivity(false)}><BookOpen size={15} /> Canvas</button><button className={showActivity ? 'view-tab active' : 'view-tab'} onClick={() => setShowActivity(true)}><Activity size={15} /> Atividade</button></div><div className="toolbar-actions"><div className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no canvas" /></div><div className="filter-wrap"><button className={showFilters ? 'filter-button active' : 'filter-button'} onClick={() => setShowFilters(!showFilters)}><Filter size={15} /> Filtros</button>{showFilters && <div className="filter-menu"><span>FILTRAR NOTAS</span>{(['all', 'review', 'done'] as const).map((filter) => <button key={filter} className={activeFilter === filter ? 'filter-option selected' : 'filter-option'} onClick={() => { setActiveFilter(filter); setShowFilters(false) }}>{filter === 'all' ? 'Todas as notas' : filter === 'review' ? 'Em revisão' : 'Validadas'}{activeFilter === filter && <Check size={13} />}</button>)}</div>}</div><button className="icon-button"><MoreHorizontal size={18} /></button></div></div>{showActivity ? <section className="activity-panel"><div className="activity-heading"><div><span className="canvas-kicker">HISTÓRICO DO PROJETO</span><h2>Atividade recente</h2></div></div><p className="empty-search">Trilha de auditoria ainda não implementada nesta versão.</p></section> : <div className="canvas-wrap"><div className="canvas-intro"><div><span className="canvas-kicker">MODELO DE PROJETO</span><h2>Project Model Canvas <span>·</span> <small>rascunho compartilhado</small></h2></div><div className="canvas-legend"><span><i className="legend-dot verified" /> validado</span><span><i className="legend-dot review" /> em revisão</span></div></div><div className="canvas-grid" data-manager={activeProject.manager_name} data-project={activeProject.name}>{filteredBlocks.map((block) => <article key={block.id} className={`canvas-block ${block.tone} ${selectedBlock === block.id ? 'selected' : ''}`} onClick={() => setSelectedBlock(block.id)}><div className="block-header"><div><span className="question-label">{block.question}</span><h3>{block.title}</h3></div><button className="block-menu" onClick={(event) => event.stopPropagation()}><MoreHorizontal size={16} /></button></div><div className="notes-list">{block.notes.map((note) => <div className={`note ${note.color}`} key={note.id} onClick={(event) => { event.stopPropagation(); setEditingNote({ blockId: block.id, note }) }}><p>{note.text}</p><div className="note-footer"><span className="note-author">{note.author}</span>{note.status === 'done' && <Check size={13} className="note-check" />}{note.status === 'review' && <span className="review-label">revisar</span>}</div></div>)}{block.notes.length === 0 && <span className="empty-search">Nenhuma nota encontrada</span>}</div>{canEdit && <button className="add-note" onClick={(event) => { event.stopPropagation(); setSelectedBlock(block.id); setIsAdding(true) }}><Plus size={14} /> adicionar nota</button>}</article>)}</div><div className="canvas-footer"><span><span className="pulse-dot" /> {realtimeStatus === 'online' ? 'Sincronização online' : 'Modo local'}</span></div></div>}
        </>}
      </div></main>
      {activeProject && <button className="export-button" onClick={exportCanvas} title="Baixar backup do canvas"><ArrowDownToLine size={15} /> Exportar backup</button>}
      {showComments && <aside className="comment-composer"><div className="comment-composer-header"><span><MessageCircle size={15} /> Adicionar comentário</span><button className="icon-button" onClick={() => setShowComments(false)}><X size={15} /></button></div><div className="comment-list">{comments.map((comment, index) => <p key={`${comment}-${index}`}><b>{initials}</b>{comment}</p>)}</div><textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Escreva uma observação para a equipe..." /><button className="primary-button comment-submit" onClick={addComment}><MessageCircle size={15} /> Comentar</button></aside>}
      {editingNote && <div className="composer-backdrop" onClick={() => setEditingNote(null)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setEditingNote(null)}><X size={17} /></button><span className="canvas-kicker">EDITAR NOTA</span><h2>{blocks.find((block) => block.id === editingNote.blockId)?.title}</h2><textarea autoFocus value={editingNote.note.text} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, text: event.target.value } })} /><div className="note-status-editor"><span>STATUS DA NOTA</span><button className={editingNote.note.status === 'review' || !editingNote.note.status ? 'status-choice selected' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'review' } })}>Em revisão</button><button className={editingNote.note.status === 'done' ? 'status-choice selected done' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'done' } })}>Validada</button></div><div className="composer-actions"><button className="danger-button" onClick={deleteEditedNote}>Excluir</button><button className="secondary-button" onClick={() => setEditingNote(null)}>Cancelar</button><button className="primary-button" onClick={saveEditedNote}><Check size={16} /> Salvar nota</button></div></div></div>}
      {isAdding && <div className="composer-backdrop" onClick={() => setIsAdding(false)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setIsAdding(false)}><X size={17} /></button><span className="canvas-kicker">NOVA NOTA</span><h2>{blocks.find((block) => block.id === selectedBlock)?.title}</h2><textarea autoFocus value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Escreva uma ideia curta e objetiva..." /><div className="composer-actions"><button className="secondary-button" onClick={() => setIsAdding(false)}>Cancelar</button><button className="primary-button" onClick={addNote}><Plus size={16} /> Adicionar nota</button></div></div></div>}
    </div>
  )
}

export default App
