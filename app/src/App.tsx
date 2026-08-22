import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, Archive, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleHelp, FilePlus2, FileJson, FileText, Filter, FolderKanban, Grid2X2, History, Image as ImageIcon, LayoutDashboard, Link2, MessageCircle, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import {
  archiveProject,
  createNote,
  createProject as createProjectRequest,
  deleteNote,
  listNotes,
  listProjects,
  restoreProject,
  seedNotesFromTemplate,
  subscribeToProject,
  updateNote,
  updateProject,
  type NoteRow,
  type ProjectRow,
} from './lib/projectsRepository'
import { listOrgMembers, type Membership, type OrgMember } from './lib/organizationsRepository'
import { listComments, createComment, type CommentRow } from './lib/commentsRepository'
import { listAuditEvents, type AuditEventRow } from './lib/auditRepository'
import { describeAuditEvent } from './auditDescriptions'
import { listCanvasVersions, type CanvasVersionRow } from './lib/canvasVersionsRepository'
import { approveBlock, listBlockApprovals, unapproveBlock, type BlockApprovalRow } from './lib/blockApprovalsRepository'
import { signOut } from './lib/authRepository'
import { getDisplayName, getInitials } from './lib/userDisplay'
import { roleLabels } from './lib/roleLabels'
import TeamPanel from './TeamPanel'
import SecurityPanel from './SecurityPanel'
import OverviewPanel from './OverviewPanel'
import TemplatesPanel from './TemplatesPanel'
import type { ProjectTemplate } from './templates'
import ArchivedProjectsPanel from './ArchivedProjectsPanel'
import OrgActivityPanel from './OrgActivityPanel'
import './App.css'
import { blockMeta } from './blockMeta'
import type { BlockMeta } from './blockMeta'

type CanvasBlock = BlockMeta & { notes: NoteRow[] }

const navItems = [{ label: 'Visão geral', icon: LayoutDashboard }, { label: 'Meus projetos', icon: FolderKanban }, { label: 'Templates', icon: Grid2X2 }, { label: 'Equipe', icon: Users }]

const noteColors = ['yellow', 'mint', 'blue', 'lavender', 'peach', 'coral'] as const

function memberLabel(member: OrgMember): string {
  return member.fullName || member.email.split('@')[0]
}

function ProjectControls({ projects, activeProjectId, members, onSelect, onCreate, onOpenCreate }: { projects: ProjectRow[]; activeProjectId: string | null; members: OrgMember[]; onSelect: (id: string) => void; onCreate: (name: string, managerUserId: string, managerName: string) => void; onOpenCreate: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [managerUserId, setManagerUserId] = useState('')
  const activeProject = projects.find((project) => project.id === activeProjectId)
  return <div className="project-controls"><button className="project-select" onClick={() => setIsOpen(!isOpen)}><span className="workspace-avatar">N</span><span><b>{activeProject?.name ?? 'Nenhum projeto'}</b><small>Projeto atual · {activeProject?.manager_name ?? '-'}</small></span><ChevronDown size={15} /></button>{isOpen && <div className="project-menu"><span className="project-menu-label">PROJETOS DA ORGANIZAÇÃO</span>{projects.map((project) => <button key={project.id} className={project.id === activeProjectId ? 'project-option selected' : 'project-option'} onClick={() => { onSelect(project.id); setIsOpen(false) }}><span><b>{project.name}</b><small>GP · {project.manager_name}</small></span>{project.id === activeProjectId && <Check size={14} />}</button>)}<button className="new-project-option" onClick={() => { onOpenCreate(); setManagerUserId(members[0]?.userId ?? ''); setIsCreating(true); setIsOpen(false) }}><Plus size={14} /> Novo projeto</button></div>}{isCreating && <div className="project-modal-backdrop" onClick={() => setIsCreating(false)}><form className="project-modal" onSubmit={(event) => { event.preventDefault(); const manager = members.find((member) => member.userId === managerUserId); if (name.trim() && manager) { onCreate(name.trim(), manager.userId, memberLabel(manager)); setIsCreating(false); setName('') } }} onClick={(event) => event.stopPropagation()}><span className="canvas-kicker">NOVO PROJETO</span><h2>Criar canvas do projeto</h2><label>Nome do projeto<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Implantação do PMO" autoFocus /></label><label>Gerente do projeto<select value={managerUserId} onChange={(event) => setManagerUserId(event.target.value)}>{members.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}</select></label><div className="project-modal-actions"><button type="button" className="secondary-button" onClick={() => setIsCreating(false)}>Cancelar</button><button type="submit" className="primary-button"><Plus size={15} /> Criar projeto</button></div></form></div>}</div>
}

function App({ session, organizationId, organizationName, role }: { session: Session; organizationId: string; organizationName: string; role: Membership['role'] }) {
  const user = session.user
  const displayName = getDisplayName(user)
  const initials = getInitials(displayName)
  const canEdit = role === 'admin' || role === 'editor'
  const canComment = role === 'admin' || role === 'editor' || role === 'commenter'

  const [activeNav, setActiveNav] = useState('Meus projetos')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [isProjectsLoading, setIsProjectsLoading] = useState(true)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [editName, setEditName] = useState('')
  const [editManagerUserId, setEditManagerUserId] = useState('')
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [selectedBlock, setSelectedBlock] = useState('why')
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingNote, setEditingNote] = useState<{ blockId: string; note: NoteRow } | null>(null)
  const [newNote, setNewNote] = useState('')
  const [newNoteColor, setNewNoteColor] = useState<string>('yellow')
  const [showNewNoteSupport, setShowNewNoteSupport] = useState(false)
  const [newNoteIndicator, setNewNoteIndicator] = useState('')
  const [newNoteEvidenceSource, setNewNoteEvidenceSource] = useState('')
  const [newNoteReviewDate, setNewNoteReviewDate] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEventRow[]>([])
  const [newComment, setNewComment] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'review' | 'done'>('all')
  const [activeView, setActiveView] = useState<'canvas' | 'activity' | 'history'>('canvas')
  const [canvasVersions, setCanvasVersions] = useState<CanvasVersionRow[]>([])
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [copiedVersionId, setCopiedVersionId] = useState<string | null>(null)
  const [blockApprovals, setBlockApprovals] = useState<BlockApprovalRow[]>([])
  const [realtimeStatus, setRealtimeStatus] = useState<'online' | 'offline'>('offline')
  const [actionError, setActionError] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const canvasGridRef = useRef<HTMLDivElement>(null)

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null
  const isLocked = activeProject?.status === 'APROVADO'
  const canEditNotes = canEdit && !isLocked
  const isProjectView = activeNav !== 'Equipe' && activeNav !== 'Configurações' && activeNav !== 'Visão geral' && activeNav !== 'Templates' && activeNav !== 'Arquivados' && activeNav !== 'Atividade'

  function blockApproval(blockKey: string): BlockApprovalRow | undefined {
    return blockApprovals.find((approval) => approval.block_key === blockKey)
  }

  function canEditNoteInBlock(blockKey: string): boolean {
    return canEditNotes && !blockApproval(blockKey)
  }

  function copyShareLink(version: CanvasVersionRow) {
    const link = `${window.location.origin}${window.location.pathname}?share=${version.share_token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedVersionId(version.id)
      setTimeout(() => setCopiedVersionId((current) => (current === version.id ? null : current)), 2000)
    })
  }

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
    listOrgMembers(organizationId).then((result) => { if (isMounted) setOrgMembers(result) })
    return () => { isMounted = false }
  }, [organizationId])

  useEffect(() => {
    if (!activeProjectId) { setNotes([]); setComments([]); setAuditEvents([]); setCanvasVersions([]); setBlockApprovals([]); return }
    let isMounted = true
    listNotes(activeProjectId).then((result) => { if (isMounted) setNotes(result) })
    listComments(activeProjectId).then((result) => { if (isMounted) setComments(result) })
    listAuditEvents(activeProjectId).then((result) => { if (isMounted) setAuditEvents(result) })
    listCanvasVersions(activeProjectId).then((result) => { if (isMounted) setCanvasVersions(result) })
    listBlockApprovals(activeProjectId).then((result) => { if (isMounted) setBlockApprovals(result) })
    const unsubscribe = subscribeToProject(activeProjectId, {
      onNoteInsert: (note) => setNotes((current) => (current.some((item) => item.id === note.id) ? current : [...current, note])),
      onNoteUpdate: (note) => setNotes((current) => current.map((item) => (item.id === note.id ? note : item))),
      onNoteDelete: (noteId) => setNotes((current) => current.filter((item) => item.id !== noteId)),
      onProjectUpdate: (project) => setProjects((current) => current.map((item) => (item.id === project.id ? project : item))),
      onCommentInsert: (comment) => setComments((current) => (current.some((item) => item.id === comment.id) ? current : [...current, comment])),
      onBlockApprovalInsert: (approval) => setBlockApprovals((current) => (current.some((item) => item.id === approval.id) ? current : [...current, approval])),
      onBlockApprovalDelete: (approvalId) => setBlockApprovals((current) => current.filter((item) => item.id !== approvalId)),
    }, setRealtimeStatus)
    return () => { isMounted = false; unsubscribe() }
  }, [activeProjectId])

  function refreshAuditEvents() {
    if (activeProjectId) listAuditEvents(activeProjectId).then(setAuditEvents)
  }

  function refreshCanvasVersions() {
    if (activeProjectId) listCanvasVersions(activeProjectId).then(setCanvasVersions)
  }

  function refreshOrgMembers() {
    listOrgMembers(organizationId).then(setOrgMembers)
  }

  async function toggleBlockApproval(blockKey: string) {
    if (!activeProjectId || !canEdit || isLocked) return
    try {
      if (blockApproval(blockKey)) {
        await unapproveBlock(activeProjectId, blockKey)
        setBlockApprovals((current) => current.filter((approval) => approval.block_key !== blockKey))
      } else {
        const approval = await approveBlock(activeProjectId, blockKey, displayName)
        setBlockApprovals((current) => [...current, approval])
      }
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar a aprovação do bloco.')
    }
  }

  async function addComment() {
    if (!newComment.trim() || !activeProjectId) return
    try {
      const comment = await createComment(activeProjectId, newComment.trim(), initials)
      setComments((current) => [...current, comment])
      setNewComment('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível adicionar o comentário.')
    }
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

  async function captureCanvasPng(): Promise<string | null> {
    if (!canvasGridRef.current) return null
    const { toPng } = await import('html-to-image')
    return toPng(canvasGridRef.current, { backgroundColor: '#f0eee8', pixelRatio: 2 })
  }

  async function exportCanvasPng() {
    if (!activeProject) return
    try {
      const dataUrl = await captureCanvasPng()
      if (!dataUrl) return
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `canvas-pmo-v${activeProject.version.toFixed(1)}.png`
      link.click()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível exportar a imagem.')
    }
  }

  async function exportCanvasPdf() {
    if (!activeProject) return
    try {
      const dataUrl = await captureCanvasPng()
      if (!dataUrl) return
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Falha ao carregar a imagem capturada.'))
        image.src = dataUrl
      })
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: image.width > image.height ? 'landscape' : 'portrait', unit: 'px', format: [image.width, image.height] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, image.width, image.height)
      pdf.save(`canvas-pmo-v${activeProject.version.toFixed(1)}.pdf`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível exportar o PDF.')
    }
  }

  async function addNote() {
    if (!newNote.trim() || !activeProjectId) return
    try {
      const support = { indicator: newNoteIndicator.trim() || null, evidenceSource: newNoteEvidenceSource.trim() || null, reviewDate: newNoteReviewDate || null }
      const note = await createNote(activeProjectId, selectedBlock, newNote.trim(), initials, newNoteColor, support)
      setNotes((current) => [...current, note])
      setNewNote('')
      setNewNoteColor('yellow')
      setShowNewNoteSupport(false)
      setNewNoteIndicator('')
      setNewNoteEvidenceSource('')
      setNewNoteReviewDate('')
      setIsAdding(false)
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível adicionar a nota.')
    }
  }

  async function saveEditedNote() {
    if (!editingNote || !editingNote.note.text.trim()) return
    const { id, text, status, color, indicator, evidence_source, review_date } = editingNote.note
    try {
      await updateNote(id, { text, status, color, indicator, evidence_source, review_date })
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, text, status, color, indicator, evidence_source, review_date } : note)))
      setEditingNote(null)
      refreshAuditEvents()
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
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível excluir a nota.')
    }
  }

  function selectProject(projectId: string) {
    setActiveProjectId(projectId)
  }

  async function createProject(name: string, managerUserId: string, managerName: string) {
    try {
      const project = await createProjectRequest(organizationId, name, managerUserId, managerName)
      setProjects((current) => [...current, project])
      setActiveProjectId(project.id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar o projeto.')
    }
  }

  async function createProjectFromTemplate(template: ProjectTemplate, name: string, managerUserId: string, managerName: string) {
    try {
      const project = await createProjectRequest(organizationId, name, managerUserId, managerName)
      await seedNotesFromTemplate(project.id, template.notes, initials)
      setProjects((current) => [...current, project])
      setActiveProjectId(project.id)
      setActiveNav('Meus projetos')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar o projeto a partir do template.')
    }
  }

  function openEditProject() {
    if (!activeProject) return
    refreshOrgMembers()
    setEditName(activeProject.name)
    setEditManagerUserId(activeProject.manager_user_id ?? orgMembers[0]?.userId ?? '')
    setIsEditingProject(true)
  }

  async function saveProjectEdit() {
    if (!activeProject || !editName.trim()) return
    const manager = orgMembers.find((member) => member.userId === editManagerUserId)
    if (!manager) return
    const managerName = memberLabel(manager)
    try {
      await updateProject(activeProject.id, { name: editName.trim(), manager_user_id: manager.userId, manager_name: managerName })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, name: editName.trim(), manager_user_id: manager.userId, manager_name: managerName } : project)))
      setIsEditingProject(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível salvar o projeto.')
    }
  }

  async function archiveActiveProject() {
    if (!activeProject) return
    try {
      await archiveProject(activeProject.id)
      const remaining = projects.filter((project) => project.id !== activeProject.id)
      setProjects(remaining)
      setActiveProjectId(remaining[0]?.id ?? null)
      setIsEditingProject(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível arquivar o projeto.')
    }
  }

  async function restoreProjectAction(projectId: string) {
    try {
      await restoreProject(projectId)
      const refreshed = await listProjects(organizationId)
      setProjects(refreshed)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível restaurar o projeto.')
    }
  }

  async function bumpVersion() {
    if (!activeProject) return
    const nextVersion = Number((activeProject.version + 0.1).toFixed(1))
    try {
      await updateProject(activeProject.id, { version: nextVersion, status: 'RASCUNHO' })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, version: nextVersion, status: 'RASCUNHO' } : project)))
      setBlockApprovals([])
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar uma nova versão.')
    }
  }

  async function approveProject() {
    if (!activeProject) return
    try {
      await updateProject(activeProject.id, { status: 'APROVADO' })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, status: 'APROVADO' } : project)))
      refreshAuditEvents()
      refreshCanvasVersions()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível aprovar o projeto.')
    }
  }

  return (
    <div className="app-shell">{isProjectView && <ProjectControls projects={projects} activeProjectId={activeProjectId} members={orgMembers} onSelect={selectProject} onCreate={createProject} onOpenCreate={refreshOrgMembers} />}
      <aside className="sidebar"><div className="brand"><span className="brand-mark">P</span><span>projectly</span></div><div className="workspace-switcher"><span className="workspace-avatar">{organizationName.slice(0, 1).toUpperCase() || 'O'}</span><span><b>{organizationName}</b><small>Workspace principal</small></span><ChevronDown size={15} /></div><nav className="main-nav" aria-label="Navegação principal"><span className="nav-caption">WORKSPACE</span>{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveNav(label); if (label === 'Templates') refreshOrgMembers() }}><Icon size={17} /><span>{label}</span>{label === 'Meus projetos' && projects.length > 0 && <em>{projects.length}</em>}</button>)}<span className="nav-caption nav-caption-spaced">GESTÃO</span><button className={activeNav === 'Atividade' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Atividade')}><Activity size={17} /><span>Atividade</span></button><button className={activeNav === 'Arquivados' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Arquivados')}><Archive size={17} /><span>Arquivados</span></button></nav><div className="sidebar-bottom"><div className="upgrade-card"><Sparkles size={16} /><div><strong>Plano Team</strong><small>{projects.length} projetos ativos</small></div><ArrowUpRight size={14} /></div><button className={activeNav === 'Configurações' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Configurações')}><Settings size={17} /><span>Configurações</span></button><button className="user-card" onClick={() => void signOut()} title="Sair"><span className="avatar">{initials}</span><span><b>{displayName}</b><small>{roleLabels[role]}</small></span><MoreHorizontal size={16} /></button></div></aside>
      <main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Meus projetos</span><span>/</span><b>{activeProject?.name ?? 'Sem projeto'}</b></div><div className="top-actions"><button className="icon-button" title="Ajuda"><CircleHelp size={18} /></button><button className="icon-button notification" title="Notificações"><Bell size={18} /><i /></button><span className="top-avatar">{initials}</span></div></header><div className="page-content">
        {actionError && <div className="error-banner page-error"><span>{actionError}</span><button className="icon-button" onClick={() => setActionError(null)}><X size={14} /></button></div>}
        {activeNav === 'Equipe' ? <TeamPanel organizationId={organizationId} role={role} /> : activeNav === 'Configurações' ? <SecurityPanel /> : activeNav === 'Visão geral' ? <OverviewPanel projects={projects} onOpenProject={(projectId) => { setActiveProjectId(projectId); setActiveNav('Meus projetos') }} /> : activeNav === 'Templates' ? <TemplatesPanel members={orgMembers} onCreate={createProjectFromTemplate} /> : activeNav === 'Arquivados' ? <ArchivedProjectsPanel organizationId={organizationId} onRestore={restoreProjectAction} /> : activeNav === 'Atividade' ? <OrgActivityPanel organizationId={organizationId} /> : isProjectsLoading ? <p className="empty-search">Carregando projetos...</p> : !activeProject ? (
          <section className="project-heading"><div><span className="canvas-kicker">COMECE POR AQUI</span><h1>Nenhum projeto ainda</h1><p>Use "Novo projeto" no canto superior esquerdo para criar o primeiro canvas da organização.</p></div></section>
        ) : <>
        <section className="project-heading"><div><div className="eyebrow"><span className="status-dot" /> {activeProject.status}{isLocked && <span className="updated">· travado até nova versão</span>}</div><h1>{activeProject.name}</h1><p>Uma visão compartilhada para transformar ideias em projetos alinhados.</p></div>{canEdit && <div className="heading-actions"><button className="secondary-button" onClick={bumpVersion}><FilePlus2 size={16} /> Nova versão</button><button className="primary-button" onClick={approveProject} disabled={isLocked}><Check size={16} /> {isLocked ? 'Canvas aprovado' : 'Enviar para aprovação'}</button></div>}</section><section className="meta-row"><div className="people"><div className="avatar-stack"><span className="avatar-stack-item teal">{initials}</span></div><span>{displayName}</span></div><div className="meta-items"><button className={showComments ? 'meta-button active' : 'meta-button'} onClick={() => setShowComments(!showComments)}><MessageCircle size={15} /> comentários</button><span className="divider" /><button className="meta-button"><ShieldCheck size={15} /> versão {activeProject.version.toFixed(1)}</button></div></section>{showComments && <aside className="comments-panel"><div><span className="canvas-kicker">DISCUSSÃO ATIVA</span><strong>Comentários do canvas</strong></div><p>Os comentários abaixo ficam salvos apenas neste navegador.</p></aside>}<div className="toolbar"><div className="view-tabs"><button className={activeView === 'canvas' ? 'view-tab active' : 'view-tab'} onClick={() => setActiveView('canvas')}><BookOpen size={15} /> Canvas</button><button className={activeView === 'activity' ? 'view-tab active' : 'view-tab'} onClick={() => setActiveView('activity')}><Activity size={15} /> Atividade</button><button className={activeView === 'history' ? 'view-tab active' : 'view-tab'} onClick={() => setActiveView('history')}><History size={15} /> Versões</button></div><div className="toolbar-actions"><div className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no canvas" /></div><div className="filter-wrap"><button className={showFilters ? 'filter-button active' : 'filter-button'} onClick={() => setShowFilters(!showFilters)}><Filter size={15} /> Filtros</button>{showFilters && <div className="filter-menu"><span>FILTRAR NOTAS</span>{(['all', 'review', 'done'] as const).map((filter) => <button key={filter} className={activeFilter === filter ? 'filter-option selected' : 'filter-option'} onClick={() => { setActiveFilter(filter); setShowFilters(false) }}>{filter === 'all' ? 'Todas as notas' : filter === 'review' ? 'Em revisão' : 'Validadas'}{activeFilter === filter && <Check size={13} />}</button>)}</div>}</div>{canEdit && <button className="icon-button" onClick={openEditProject} title="Editar projeto"><MoreHorizontal size={18} /></button>}</div></div>{activeView === 'activity' ? <section className="activity-panel"><div className="activity-heading"><div><span className="canvas-kicker">HISTÓRICO DO PROJETO</span><h2>Atividade recente</h2></div><span className="activity-count">{auditEvents.length} eventos</span></div>{auditEvents.length === 0 ? <p className="empty-search">Nenhuma atividade registrada ainda.</p> : auditEvents.map((event) => <div className="activity-item" key={event.id}><span className={`activity-icon ${event.action === 'note_deleted' ? 'sand' : 'green'}`}>{event.action === 'project_approved' ? <Check size={14} /> : event.action === 'project_new_version' ? <FilePlus2 size={14} /> : <Activity size={14} />}</span><div><strong>{describeAuditEvent(event)}</strong><small>{new Date(event.created_at).toLocaleString('pt-BR')}</small></div></div>)}</section> : activeView === 'history' ? <section className="activity-panel"><div className="activity-heading"><div><span className="canvas-kicker">VERSÕES APROVADAS</span><h2>Histórico de versões</h2></div><span className="activity-count">{canvasVersions.length} versões</span></div>{canvasVersions.length === 0 ? <p className="empty-search">Nenhuma versão aprovada ainda.</p> : canvasVersions.map((version) => <div className="version-item" key={version.id}><div className="version-item-header"><button className="version-item-toggle" onClick={() => setExpandedVersionId(expandedVersionId === version.id ? null : version.id)}><span className="activity-icon green"><History size={14} /></span><div><strong>Versão {version.version.toFixed(1)} · {version.project_name}</strong><small>Aprovado por {version.approved_by_label} em {new Date(version.approved_at).toLocaleString('pt-BR')}</small></div></button><button className="version-share-button" onClick={() => copyShareLink(version)} title="Copiar link público de leitura"><Link2 size={13} /> {copiedVersionId === version.id ? 'Copiado!' : 'Copiar link'}</button><button className="version-item-toggle version-item-chevron" onClick={() => setExpandedVersionId(expandedVersionId === version.id ? null : version.id)}><ChevronDown size={15} className={expandedVersionId === version.id ? 'chevron open' : 'chevron'} /></button></div>{expandedVersionId === version.id && <div className="version-snapshot">{version.notes_snapshot.length === 0 ? <p className="empty-search">Nenhuma nota registrada nesta versão.</p> : blockMeta.map((meta) => { const blockNotes = version.notes_snapshot.filter((note) => note.block_key === meta.id); return blockNotes.length === 0 ? null : <div className="version-block" key={meta.id}><span className="version-block-title">{meta.title}</span>{blockNotes.map((note, index) => <p key={index} className={`note ${note.color}`}>{note.text}<span className="note-author">{note.author}</span></p>)}</div> })}</div>}</div>)}</section> : <div className="canvas-wrap"><div className="canvas-intro"><div><span className="canvas-kicker">MODELO DE PROJETO</span><h2>Project Model Canvas <span>·</span> <small>rascunho compartilhado</small></h2></div><div className="canvas-legend"><span><i className="legend-dot verified" /> validado</span><span><i className="legend-dot review" /> em revisão</span></div></div><div className="canvas-grid" ref={canvasGridRef} data-manager={activeProject.manager_name} data-project={activeProject.name}>{filteredBlocks.map((block) => <article key={block.id} className={`canvas-block ${block.tone} ${selectedBlock === block.id ? 'selected' : ''}`} onClick={() => setSelectedBlock(block.id)}><div className="block-header"><div><span className="question-label">{block.question}</span><h3>{block.title}</h3></div>{blockApproval(block.id) ? <button className="block-menu approved" onClick={(event) => { event.stopPropagation(); toggleBlockApproval(block.id) }} title={`Bloco aprovado por ${blockApproval(block.id)?.approved_by_label}${canEdit && !isLocked ? ' · clique para desaprovar' : ''}`}><Check size={16} /></button> : canEdit && !isLocked && <button className="block-menu" onClick={(event) => { event.stopPropagation(); toggleBlockApproval(block.id) }} title="Aprovar bloco"><ShieldCheck size={16} /></button>}</div><div className="notes-list">{block.notes.map((note) => <div className={`note ${note.color}`} key={note.id} onClick={(event) => { event.stopPropagation(); setEditingNote({ blockId: block.id, note }) }}><p>{note.text}</p><div className="note-footer"><span className="note-author">{note.author}</span>{note.status === 'done' && <Check size={13} className="note-check" />}{note.status === 'review' && <span className="review-label">revisar</span>}</div></div>)}{block.notes.length === 0 && <span className="empty-search">Nenhuma nota encontrada</span>}</div>{canEditNoteInBlock(block.id) && <button className="add-note" onClick={(event) => { event.stopPropagation(); setSelectedBlock(block.id); setIsAdding(true) }}><Plus size={14} /> adicionar nota</button>}</article>)}</div><div className="canvas-footer"><span><span className="pulse-dot" /> {realtimeStatus === 'online' ? 'Sincronização online' : 'Modo local'}</span></div></div>}
        </>}
      </div></main>
      {isProjectView && activeProject && <div className="export-wrap"><button className="export-button" onClick={() => setShowExportMenu(!showExportMenu)} title="Exportar canvas"><ArrowDownToLine size={15} /> Exportar</button>{showExportMenu && <div className="export-menu"><button onClick={() => { void exportCanvasPng(); setShowExportMenu(false) }}><ImageIcon size={14} /> Imagem PNG</button><button onClick={() => { void exportCanvasPdf(); setShowExportMenu(false) }}><FileText size={14} /> PDF</button><button onClick={() => { exportCanvas(); setShowExportMenu(false) }}><FileJson size={14} /> Backup JSON</button></div>}</div>}
      {isProjectView && showComments && <aside className="comment-composer"><div className="comment-composer-header"><span><MessageCircle size={15} /> Adicionar comentário</span><button className="icon-button" onClick={() => setShowComments(false)}><X size={15} /></button></div><div className="comment-list">{comments.map((comment) => <p key={comment.id}><b>{comment.author}</b>{comment.text}</p>)}</div>{canComment ? <><textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Escreva uma observação para a equipe..." /><button className="primary-button comment-submit" onClick={addComment}><MessageCircle size={15} /> Comentar</button></> : <p className="empty-search">Apenas leitura para o seu papel.</p>}</aside>}
      {editingNote && <div className="composer-backdrop" onClick={() => setEditingNote(null)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setEditingNote(null)}><X size={17} /></button><span className="canvas-kicker">EDITAR NOTA</span><h2>{blocks.find((block) => block.id === editingNote.blockId)?.title}</h2><textarea autoFocus readOnly={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.text} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, text: event.target.value } })} />{(canEditNoteInBlock(editingNote.blockId) || editingNote.note.indicator || editingNote.note.evidence_source || editingNote.note.review_date) && <div className="note-support-fields"><label>Indicador<input disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.indicator ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, indicator: event.target.value || null } })} placeholder="Ex.: % de adoção" /></label><label>Fonte da evidência<input disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.evidence_source ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, evidence_source: event.target.value || null } })} placeholder="Ex.: pesquisa com usuários" /></label><label>Data de revisão<input type="date" disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.review_date ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, review_date: event.target.value || null } })} /></label></div>}{canEditNoteInBlock(editingNote.blockId) ? <><div className="note-status-editor"><span>STATUS DA NOTA</span><button className={editingNote.note.status === 'review' || !editingNote.note.status ? 'status-choice selected' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'review' } })}>Em revisão</button><button className={editingNote.note.status === 'done' ? 'status-choice selected done' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'done' } })}>Validada</button></div><div className="color-picker">{noteColors.map((color) => <button type="button" key={color} className={color === editingNote.note.color ? `color-swatch ${color} selected` : `color-swatch ${color}`} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, color } })} aria-label={`Cor ${color}`} />)}</div><div className="composer-actions"><button className="danger-button" onClick={deleteEditedNote}>Excluir</button><button className="secondary-button" onClick={() => setEditingNote(null)}>Cancelar</button><button className="primary-button" onClick={saveEditedNote}><Check size={16} /> Salvar nota</button></div></> : <><p className="empty-search">{isLocked ? 'Projeto aprovado está travado. Crie uma nova versão para editar.' : blockApproval(editingNote.blockId) ? 'Bloco aprovado está travado. Desaprove o bloco para editar.' : 'Apenas leitura para o seu papel.'}</p><div className="composer-actions"><button className="secondary-button" onClick={() => setEditingNote(null)}>Fechar</button></div></>}</div></div>}
      {isEditingProject && <div className="project-modal-backdrop" onClick={() => setIsEditingProject(false)}><form className="project-modal" onSubmit={(event) => { event.preventDefault(); saveProjectEdit() }} onClick={(event) => event.stopPropagation()}><span className="canvas-kicker">EDITAR PROJETO</span><h2>Editar projeto</h2>{isLocked && <p className="empty-search">Projeto aprovado está travado. Crie uma nova versão para editar nome/gerente — mas ainda dá para arquivar.</p>}<label>Nome do projeto<input value={editName} onChange={(event) => setEditName(event.target.value)} disabled={isLocked} autoFocus /></label><label>Gerente do projeto<select value={editManagerUserId} onChange={(event) => setEditManagerUserId(event.target.value)} disabled={isLocked}>{orgMembers.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}</select></label><div className="project-modal-actions"><button type="button" className="danger-button" onClick={archiveActiveProject}><Archive size={14} /> Arquivar projeto</button><button type="button" className="secondary-button" onClick={() => setIsEditingProject(false)}>Cancelar</button>{!isLocked && <button type="submit" className="primary-button"><Check size={15} /> Salvar</button>}</div></form></div>}
      {isAdding && <div className="composer-backdrop" onClick={() => setIsAdding(false)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setIsAdding(false)}><X size={17} /></button><span className="canvas-kicker">NOVA NOTA</span><h2>{blocks.find((block) => block.id === selectedBlock)?.title}</h2><textarea autoFocus value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Escreva uma ideia curta e objetiva..." /><div className="color-picker">{noteColors.map((color) => <button type="button" key={color} className={color === newNoteColor ? `color-swatch ${color} selected` : `color-swatch ${color}`} onClick={() => setNewNoteColor(color)} aria-label={`Cor ${color}`} />)}</div><button type="button" className="tiny-link support-fields-toggle" onClick={() => setShowNewNoteSupport(!showNewNoteSupport)}>{showNewNoteSupport ? 'Ocultar campos de apoio' : '+ Campos de apoio (opcional)'}</button>{showNewNoteSupport && <div className="note-support-fields"><label>Indicador<input value={newNoteIndicator} onChange={(event) => setNewNoteIndicator(event.target.value)} placeholder="Ex.: % de adoção" /></label><label>Fonte da evidência<input value={newNoteEvidenceSource} onChange={(event) => setNewNoteEvidenceSource(event.target.value)} placeholder="Ex.: pesquisa com usuários" /></label><label>Data de revisão<input type="date" value={newNoteReviewDate} onChange={(event) => setNewNoteReviewDate(event.target.value)} /></label></div>}<div className="composer-actions"><button className="secondary-button" onClick={() => setIsAdding(false)}>Cancelar</button><button className="primary-button" onClick={addNote}><Plus size={16} /> Adicionar nota</button></div></div></div>}
    </div>
  )
}

export default App
