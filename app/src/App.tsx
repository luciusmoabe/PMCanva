import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, Archive, ArchiveRestore, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleHelp, FilePlus2, FileJson, FileText, Filter, FolderKanban, Grid2X2, History, Image as ImageIcon, LayoutDashboard, Link2, MessageCircle, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pin, Plus, Rocket, Search, Settings, ShieldCheck, Sparkles, Undo2, Users, X } from 'lucide-react'
import {
  archiveProject,
  createNote,
  createProject as createProjectRequest,
  deleteNote,
  deleteProject,
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
import { listCanvasVersions, type CanvasVersionRow, type VersionNoteSnapshot } from './lib/canvasVersionsRepository'
import { approveBlock, listBlockApprovals, unapproveBlock, type BlockApprovalRow } from './lib/blockApprovalsRepository'
import { addRequiredApprover, listBlockApprovalRequirements, removeRequiredApprover, type BlockApprovalRequirementRow } from './lib/blockApprovalRequirementsRepository'
import { linkRequirementToDeliverable, listRequirementDeliverableLinks, unlinkRequirementFromDeliverable, type RequirementDeliverableLinkRow } from './lib/requirementDeliverableLinksRepository'
import BlockApprovalControls from './BlockApprovalControls'
import { signOut } from './lib/authRepository'
import { getDisplayName, getInitials } from './lib/userDisplay'
import { roleLabels } from './lib/roleLabels'
import { projectStatusLabels } from './lib/projectStatusLabels'
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

function sortNotes(list: NoteRow[]): NoteRow[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.position - b.position || a.created_at.localeCompare(b.created_at))
}

function isRiskTreated(note: NoteRow): boolean {
  return Boolean(note.risk_probability && note.risk_impact && note.risk_response && note.assignee_user_id)
}

function ProjectControls({ projects, activeProjectId, members, onSelect, onCreate, onOpenCreate }: { projects: ProjectRow[]; activeProjectId: string | null; members: OrgMember[]; onSelect: (id: string) => void; onCreate: (name: string, managerUserId: string, managerName: string) => void; onOpenCreate: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [managerUserId, setManagerUserId] = useState('')
  const activeProject = projects.find((project) => project.id === activeProjectId)
  return <div className="project-controls"><button type="button" className="project-select" aria-label="Selecionar projeto" aria-expanded={isOpen} title={activeProject?.name ?? 'Selecionar projeto'} onClick={() => setIsOpen(!isOpen)}><span className="workspace-avatar">N</span><span><b>{activeProject?.name ?? 'Nenhum projeto'}</b><small>Projeto atual · {activeProject?.manager_name ?? '-'}</small></span><ChevronDown size={15} /></button>{isOpen && <div className="project-menu"><span className="project-menu-label">PROJETOS DA ORGANIZAÇÃO</span>{projects.map((project) => <button key={project.id} className={project.id === activeProjectId ? 'project-option selected' : 'project-option'} onClick={() => { onSelect(project.id); setIsOpen(false) }}><span><b>{project.name}</b><small>GP · {project.manager_name}</small></span>{project.id === activeProjectId && <Check size={14} />}</button>)}<button className="new-project-option" onClick={() => { onOpenCreate(); setManagerUserId(members[0]?.userId ?? ''); setIsCreating(true); setIsOpen(false) }}><Plus size={14} /> Novo projeto</button></div>}{isCreating && <div className="project-modal-backdrop" onClick={() => setIsCreating(false)}><form className="project-modal" onSubmit={(event) => { event.preventDefault(); const manager = members.find((member) => member.userId === managerUserId); if (name.trim() && manager) { onCreate(name.trim(), manager.userId, memberLabel(manager)); setIsCreating(false); setName('') } }} onClick={(event) => event.stopPropagation()}><span className="canvas-kicker">NOVO PROJETO</span><h2>Criar canvas do projeto</h2><label>Nome do projeto<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Implantação do PMO" autoFocus /></label><label>Gerente do projeto<select value={managerUserId} onChange={(event) => setManagerUserId(event.target.value)}>{members.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}</select></label><div className="project-modal-actions"><button type="button" className="secondary-button" onClick={() => setIsCreating(false)}>Cancelar</button><button type="submit" className="primary-button"><Plus size={15} /> Criar projeto</button></div></form></div>}</div>
}

function App({ session, organizationId, organizationName, role, memberships, onSelectOrganization }: { session: Session; organizationId: string; organizationName: string; role: Membership['role']; memberships: Membership[]; onSelectOrganization: (organizationId: string) => void }) {
  const user = session.user
  const displayName = getDisplayName(user)
  const initials = getInitials(displayName)
  const canEdit = role === 'admin' || role === 'editor'
  const canComment = role === 'admin' || role === 'editor' || role === 'commenter'

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('projectly.sidebarCollapsed') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('projectly.sidebarCollapsed', String(isSidebarCollapsed)) } catch { /* Storage may be unavailable. */ }
  }, [isSidebarCollapsed])

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
  const [newNoteAssigneeUserId, setNewNoteAssigneeUserId] = useState('')
  const [showNewNoteSupport, setShowNewNoteSupport] = useState(false)
  const [newNoteIndicator, setNewNoteIndicator] = useState('')
  const [newNoteEvidenceSource, setNewNoteEvidenceSource] = useState('')
  const [newNoteReviewDate, setNewNoteReviewDate] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEventRow[]>([])
  const [newComment, setNewComment] = useState('')
  const [newNoteComment, setNewNoteComment] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'review' | 'done' | 'archived'>('all')
  const [activeView, setActiveView] = useState<'canvas' | 'activity' | 'history'>('canvas')
  const [canvasVersions, setCanvasVersions] = useState<CanvasVersionRow[]>([])
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [copiedVersionId, setCopiedVersionId] = useState<string | null>(null)
  const [isComparingVersions, setIsComparingVersions] = useState(false)
  const [compareBaseId, setCompareBaseId] = useState<string | null>(null)
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null)
  const [blockApprovals, setBlockApprovals] = useState<BlockApprovalRow[]>([])
  const [blockApprovalRequirements, setBlockApprovalRequirements] = useState<BlockApprovalRequirementRow[]>([])
  const [requirementDeliverableLinks, setRequirementDeliverableLinks] = useState<RequirementDeliverableLinkRow[]>([])
  const [realtimeStatus, setRealtimeStatus] = useState<'online' | 'offline'>('offline')
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const canvasGridRef = useRef<HTMLDivElement>(null)

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null
  const isLocked = activeProject?.status === 'APROVADO' || activeProject?.status === 'EM_EXECUCAO'
  const canEditNotes = canEdit && !isLocked
  const isProjectView = activeNav !== 'Equipe' && activeNav !== 'Configurações' && activeNav !== 'Visão geral' && activeNav !== 'Templates' && activeNav !== 'Arquivados' && activeNav !== 'Atividade'
  const primaryStatusAction = activeProject?.status === 'EM_VALIDACAO' ? approveProject : submitProjectForValidation
  const primaryStatusLabel =
    activeProject?.status === 'EM_VALIDACAO' ? 'Aprovar versão'
    : activeProject?.status === 'APROVADO' ? 'Canvas aprovado'
    : activeProject?.status === 'EM_EXECUCAO' ? 'Em execução'
    : 'Enviar para validação'

  function blockApprovalsFor(blockKey: string): BlockApprovalRow[] {
    return blockApprovals.filter((approval) => approval.block_key === blockKey)
  }

  function blockRequirementsFor(blockKey: string): BlockApprovalRequirementRow[] {
    return blockApprovalRequirements.filter((requirement) => requirement.block_key === blockKey)
  }

  function isBlockApproved(blockKey: string): boolean {
    const requirements = blockRequirementsFor(blockKey)
    const approvals = blockApprovalsFor(blockKey)
    if (requirements.length === 0) return approvals.length > 0
    return requirements.every((requirement) => approvals.some((approval) => approval.approved_by === requirement.user_id))
  }

  function canEditNoteInBlock(blockKey: string): boolean {
    return canEditNotes && !isBlockApproved(blockKey)
  }

  function deliverableLinksForRequirement(requirementNoteId: string): RequirementDeliverableLinkRow[] {
    return requirementDeliverableLinks.filter((link) => link.requirement_note_id === requirementNoteId)
  }

  async function toggleRequirementDeliverableLink(requirementNoteId: string, deliverableNoteId: string) {
    if (!activeProjectId) return
    try {
      const existing = deliverableLinksForRequirement(requirementNoteId).find((link) => link.deliverable_note_id === deliverableNoteId)
      if (existing) {
        await unlinkRequirementFromDeliverable(requirementNoteId, deliverableNoteId)
        setRequirementDeliverableLinks((current) => current.filter((link) => link.id !== existing.id))
      } else {
        const link = await linkRequirementToDeliverable(activeProjectId, requirementNoteId, deliverableNoteId)
        setRequirementDeliverableLinks((current) => [...current, link])
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar o vínculo com a entrega.')
    }
  }

  function copyShareLink(version: CanvasVersionRow) {
    const link = `${window.location.origin}${window.location.pathname}?share=${version.share_token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedVersionId(version.id)
      setTimeout(() => setCopiedVersionId((current) => (current === version.id ? null : current)), 2000)
    })
  }

  function openCompareVersions() {
    setCompareBaseId(canvasVersions[1]?.id ?? canvasVersions[0]?.id ?? null)
    setCompareTargetId(canvasVersions[0]?.id ?? null)
    setIsComparingVersions(true)
  }

  function diffBlockNotes(baseNotes: VersionNoteSnapshot[], targetNotes: VersionNoteSnapshot[]) {
    const removed: VersionNoteSnapshot[] = []
    const unchanged: VersionNoteSnapshot[] = []
    const targetPool = [...targetNotes]
    for (const note of baseNotes) {
      const matchIndex = targetPool.findIndex((candidate) => candidate.text === note.text)
      if (matchIndex >= 0) { unchanged.push(note); targetPool.splice(matchIndex, 1) } else { removed.push(note) }
    }
    return { removed, added: targetPool, unchanged }
  }

  const blocks: CanvasBlock[] = useMemo(
    () => blockMeta.map((meta) => ({ ...meta, notes: sortNotes(notes.filter((note) => note.block_key === meta.id)) })),
    [notes],
  )
  const filteredBlocks = blocks
    .map((block) => ({
      ...block,
      notes: block.notes.filter((note) =>
        note.text.toLowerCase().includes(search.toLowerCase())
        && (activeFilter === 'archived' ? note.archived_at !== null : note.archived_at === null && (activeFilter === 'all' || note.status === activeFilter)),
      ),
    }))
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
    setIsComparingVersions(false)
    if (!activeProjectId) { setNotes([]); setComments([]); setAuditEvents([]); setCanvasVersions([]); setBlockApprovals([]); setBlockApprovalRequirements([]); setRequirementDeliverableLinks([]); return }
    let isMounted = true
    listNotes(activeProjectId).then((result) => { if (isMounted) setNotes(result) })
    listComments(activeProjectId).then((result) => { if (isMounted) setComments(result) })
    listAuditEvents(activeProjectId).then((result) => { if (isMounted) setAuditEvents(result) })
    listCanvasVersions(activeProjectId).then((result) => { if (isMounted) setCanvasVersions(result) })
    listBlockApprovals(activeProjectId).then((result) => { if (isMounted) setBlockApprovals(result) })
    listBlockApprovalRequirements(activeProjectId).then((result) => { if (isMounted) setBlockApprovalRequirements(result) })
    listRequirementDeliverableLinks(activeProjectId).then((result) => { if (isMounted) setRequirementDeliverableLinks(result) })
    const unsubscribe = subscribeToProject(activeProjectId, {
      onNoteInsert: (note) => setNotes((current) => (current.some((item) => item.id === note.id) ? current : [...current, note])),
      onNoteUpdate: (note) => setNotes((current) => current.map((item) => (item.id === note.id ? note : item))),
      onNoteDelete: (noteId) => setNotes((current) => current.filter((item) => item.id !== noteId)),
      onProjectUpdate: (project) => setProjects((current) => current.map((item) => (item.id === project.id ? project : item))),
      onCommentInsert: (comment) => setComments((current) => (current.some((item) => item.id === comment.id) ? current : [...current, comment])),
      onBlockApprovalInsert: (approval) => setBlockApprovals((current) => (current.some((item) => item.id === approval.id) ? current : [...current, approval])),
      onBlockApprovalDelete: (approvalId) => setBlockApprovals((current) => current.filter((item) => item.id !== approvalId)),
      onBlockApprovalRequirementInsert: (requirement) => setBlockApprovalRequirements((current) => (current.some((item) => item.id === requirement.id) ? current : [...current, requirement])),
      onBlockApprovalRequirementDelete: (requirementId) => setBlockApprovalRequirements((current) => current.filter((item) => item.id !== requirementId)),
      onRequirementDeliverableLinkInsert: (link) => setRequirementDeliverableLinks((current) => (current.some((item) => item.id === link.id) ? current : [...current, link])),
      onRequirementDeliverableLinkDelete: (linkId) => setRequirementDeliverableLinks((current) => current.filter((item) => item.id !== linkId)),
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
      const myApproval = blockApprovalsFor(blockKey).find((approval) => approval.approved_by === user.id)
      if (myApproval) {
        await unapproveBlock(activeProjectId, blockKey, user.id)
        setBlockApprovals((current) => current.filter((approval) => approval.id !== myApproval.id))
      } else {
        const approval = await approveBlock(activeProjectId, blockKey, displayName)
        setBlockApprovals((current) => [...current, approval])
      }
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar a aprovação do bloco.')
    }
  }

  async function toggleRequiredApprover(blockKey: string, userId: string) {
    if (!activeProjectId || !canEdit || isLocked) return
    try {
      const existing = blockRequirementsFor(blockKey).find((requirement) => requirement.user_id === userId)
      if (existing) {
        await removeRequiredApprover(activeProjectId, blockKey, userId)
        setBlockApprovalRequirements((current) => current.filter((requirement) => requirement.id !== existing.id))
      } else {
        const requirement = await addRequiredApprover(activeProjectId, blockKey, userId)
        setBlockApprovalRequirements((current) => [...current, requirement])
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar os aprovadores exigidos.')
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

  function noteCommentsFor(noteId: string): CommentRow[] {
    return comments.filter((comment) => comment.note_id === noteId)
  }

  async function addNoteComment() {
    if (!editingNote || !newNoteComment.trim() || !activeProjectId) return
    try {
      const comment = await createComment(activeProjectId, newNoteComment.trim(), initials, editingNote.note.id)
      setComments((current) => [...current, comment])
      setNewNoteComment('')
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
      const assigneeMember = orgMembers.find((member) => member.userId === newNoteAssigneeUserId)
      const assignee = { userId: assigneeMember?.userId ?? null, label: assigneeMember ? memberLabel(assigneeMember) : null }
      const position = blocks.find((block) => block.id === selectedBlock)?.notes.length ?? 0
      const note = await createNote(activeProjectId, selectedBlock, newNote.trim(), initials, newNoteColor, support, assignee, position)
      setNotes((current) => [...current, note])
      setNewNote('')
      setNewNoteColor('yellow')
      setNewNoteAssigneeUserId('')
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
    const { id, text, status, color, indicator, evidence_source, review_date, assignee_user_id, assignee_label, risk_probability, risk_impact, risk_response } = editingNote.note
    try {
      await updateNote(id, { text, status, color, indicator, evidence_source, review_date, assignee_user_id, assignee_label, risk_probability, risk_impact, risk_response })
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, text, status, color, indicator, evidence_source, review_date, assignee_user_id, assignee_label, risk_probability, risk_impact, risk_response } : note)))
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

  async function toggleNotePinned(note: NoteRow) {
    try {
      await updateNote(note.id, { pinned: !note.pinned })
      setNotes((current) => current.map((item) => (item.id === note.id ? { ...item, pinned: !item.pinned } : item)))
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível fixar a nota.')
    }
  }

  async function moveEditedNote(direction: 'up' | 'down') {
    if (!editingNote) return
    const siblings = sortNotes(notes.filter((note) => note.block_key === editingNote.blockId))
    const index = siblings.findIndex((note) => note.id === editingNote.note.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return
    const current = siblings[index]
    const neighbor = siblings[swapIndex]
    try {
      await updateNote(current.id, { position: neighbor.position })
      await updateNote(neighbor.id, { position: current.position })
      setNotes((prev) => prev.map((note) => (note.id === current.id ? { ...note, position: neighbor.position } : note.id === neighbor.id ? { ...note, position: current.position } : note)))
      setEditingNote({ ...editingNote, note: { ...editingNote.note, position: neighbor.position } })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível reordenar a nota.')
    }
  }

  async function toggleArchiveEditedNote() {
    if (!editingNote) return
    const { id, archived_at } = editingNote.note
    const nextArchivedAt = archived_at ? null : new Date().toISOString()
    try {
      await updateNote(id, { archived_at: nextArchivedAt })
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, archived_at: nextArchivedAt } : note)))
      setEditingNote(null)
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível arquivar a nota.')
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

  async function deleteProjectAction(project: ProjectRow): Promise<boolean> {
    if (isDeletingProject || role !== 'admin' || !window.confirm(`Excluir definitivamente o projeto "${project.name}"? Todas as notas, coment?rios, aprova??es, vers?es e hist?rico ser?o apagados. Esta a??o n?o pode ser desfeita.`)) return false
    setActionError(null)
    setIsDeletingProject(true)
    try {
      await deleteProject(project.id)
      const remaining = projects.filter((item) => item.id !== project.id)
      setProjects(remaining)
      if (activeProjectId === project.id) {
        setActiveProjectId(remaining[0]?.id ?? null)
        setIsEditingProject(false)
        setEditingNote(null)
      }
      return true
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'N?o foi poss?vel excluir o projeto. Verifique sua permiss?o e a configura??o do banco.')
      return false
    } finally {
      setIsDeletingProject(false)
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

  async function submitProjectForValidation() {
    if (!activeProject) return
    try {
      await updateProject(activeProject.id, { status: 'EM_VALIDACAO' })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, status: 'EM_VALIDACAO' } : project)))
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível enviar o projeto para validação.')
    }
  }

  async function returnProjectToDraft() {
    if (!activeProject) return
    try {
      await updateProject(activeProject.id, { status: 'RASCUNHO' })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, status: 'RASCUNHO' } : project)))
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível voltar o projeto para rascunho.')
    }
  }

  async function startProjectExecution() {
    if (!activeProject) return
    try {
      await updateProject(activeProject.id, { status: 'EM_EXECUCAO' })
      setProjects((current) => current.map((project) => (project.id === activeProject.id ? { ...project, status: 'EM_EXECUCAO' } : project)))
      refreshAuditEvents()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível iniciar a execução do projeto.')
    }
  }

  return (
    <div className={isSidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>{isProjectView && <ProjectControls projects={projects} activeProjectId={activeProjectId} members={orgMembers} onSelect={selectProject} onCreate={createProject} onOpenCreate={refreshOrgMembers} />}
      <aside id="workspace-sidebar" className="sidebar" hidden={isSidebarCollapsed}><div className="brand"><span className="brand-mark">P</span><span>projectly</span></div><div className="workspace-switcher"><span className="workspace-avatar">{organizationName.slice(0, 1).toUpperCase() || 'O'}</span><span><b>{organizationName}</b><small>{roleLabels[role]}</small></span></div><nav className="main-nav" aria-label="Navegação principal"><span className="nav-caption">WORKSPACE</span>{navItems.map(({ label, icon: Icon }) => <button key={label} title={label} aria-label={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveNav(label); if (label === 'Templates') refreshOrgMembers() }}><Icon size={17} /><span>{label}</span>{label === 'Meus projetos' && projects.length > 0 && <em>{projects.length}</em>}</button>)}<span className="nav-caption nav-caption-spaced">GESTÃO</span><button title="Atividade" aria-label="Atividade" className={activeNav === 'Atividade' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Atividade')}><Activity size={17} /><span>Atividade</span></button><button title="Arquivados" aria-label="Arquivados" className={activeNav === 'Arquivados' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Arquivados')}><Archive size={17} /><span>Arquivados</span></button></nav><div className="sidebar-bottom"><div className="upgrade-card"><Sparkles size={16} /><div><strong>Plano Team</strong><small>{projects.length} projetos ativos</small></div><ArrowUpRight size={14} /></div><button className={activeNav === 'Configurações' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav('Configurações')}><Settings size={17} /><span>Configurações</span></button><button className="user-card" onClick={() => void signOut()} title="Sair"><span className="avatar">{initials}</span><span><b>{displayName}</b><small>{roleLabels[role]}</small></span><MoreHorizontal size={16} /></button></div></aside>
      <main className="main-content"><header className="topbar"><div className="topbar-navigation"><button type="button" className="icon-button sidebar-toggle" onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)} aria-controls="workspace-sidebar" aria-expanded={!isSidebarCollapsed} aria-label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} title={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>{isSidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>{memberships.length > 1 && <select className="organization-select" aria-label="Organiza??o ativa" value={organizationId} onChange={(event) => onSelectOrganization(event.target.value)}>{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName} ? {roleLabels[membership.role]}</option>)}</select>}<div className="breadcrumbs"><span>Meus projetos</span><span>/</span><b>{activeProject?.name ?? 'Sem projeto'}</b></div></div><div className="top-actions"><button className="icon-button" title="Ajuda"><CircleHelp size={18} /></button><button className="icon-button notification" title="Notificações"><Bell size={18} /><i /></button><span className="top-avatar">{initials}</span></div></header><div className="page-content">
        {actionError && <div className="error-banner page-error"><span>{actionError}</span><button className="icon-button" onClick={() => setActionError(null)}><X size={14} /></button></div>}
        {activeNav === 'Equipe' ? <TeamPanel organizationId={organizationId} role={role} /> : activeNav === 'Configurações' ? <SecurityPanel /> : activeNav === 'Visão geral' ? <OverviewPanel projects={projects} onOpenProject={(projectId) => { setActiveProjectId(projectId); setActiveNav('Meus projetos') }} /> : activeNav === 'Templates' ? <TemplatesPanel members={orgMembers} onCreate={createProjectFromTemplate} /> : activeNav === 'Arquivados' ? <ArchivedProjectsPanel organizationId={organizationId} onRestore={restoreProjectAction} canDelete={role === 'admin'} onDelete={deleteProjectAction} /> : activeNav === 'Atividade' ? <OrgActivityPanel organizationId={organizationId} /> : isProjectsLoading ? <p className="empty-search">Carregando projetos...</p> : !activeProject ? (
          <section className="project-heading"><div><span className="canvas-kicker">COMECE POR AQUI</span><h1>Nenhum projeto ainda</h1><p>Use "Novo projeto" no canto superior esquerdo para criar o primeiro canvas da organização.</p></div></section>
        ) : <>
        <section className="project-heading"><div><div className="eyebrow"><span className="status-dot" /> {projectStatusLabels[activeProject.status] ?? activeProject.status}{isLocked && <span className="updated">· travado até nova versão</span>}</div><h1>{activeProject.name}</h1><p>Uma visão compartilhada para transformar ideias em projetos alinhados.</p></div>{canEdit && <div className="heading-actions">{isLocked && <button className="secondary-button" onClick={bumpVersion}><FilePlus2 size={16} /> Nova versão</button>}{activeProject.status === 'EM_VALIDACAO' && <button className="secondary-button" onClick={returnProjectToDraft}><Undo2 size={16} /> Voltar para rascunho</button>}{activeProject.status === 'APROVADO' && <button className="secondary-button" onClick={startProjectExecution}><Rocket size={16} /> Iniciar execução</button>}<button className="primary-button" onClick={primaryStatusAction} disabled={isLocked}><Check size={16} /> {primaryStatusLabel}</button></div>}</section><section className="meta-row"><div className="people"><div className="avatar-stack"><span className="avatar-stack-item teal">{initials}</span></div><span>{displayName}</span></div><div className="meta-items"><button className={showComments ? 'meta-button active' : 'meta-button'} onClick={() => setShowComments(!showComments)}><MessageCircle size={15} /> comentários</button><span className="divider" /><button className="meta-button"><ShieldCheck size={15} /> versão {activeProject.version.toFixed(1)}</button></div></section>{showComments && <aside className="comments-panel"><div><span className="canvas-kicker">DISCUSSÃO ATIVA</span><strong>Comentários do canvas</strong></div><p>Os comentários abaixo ficam salvos apenas neste navegador.</p></aside>}<div className="toolbar"><div className="view-tabs"><button className={activeView === 'canvas' ? 'view-tab active' : 'view-tab'} onClick={() => setActiveView('canvas')}><BookOpen size={15} /> Canvas</button><button className={activeView === 'activity' ? 'view-tab active' : 'view-tab'} onClick={() => setActiveView('activity')}><Activity size={15} /> Atividade</button><button className={activeView === 'history' ? 'view-tab active' : 'view-tab'} onClick={() => setActiveView('history')}><History size={15} /> Versões</button></div><div className="toolbar-actions"><div className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no canvas" /></div><div className="filter-wrap"><button className={showFilters ? 'filter-button active' : 'filter-button'} onClick={() => setShowFilters(!showFilters)}><Filter size={15} /> Filtros</button>{showFilters && <div className="filter-menu"><span>FILTRAR NOTAS</span>{(['all', 'review', 'done', 'archived'] as const).map((filter) => <button key={filter} className={activeFilter === filter ? 'filter-option selected' : 'filter-option'} onClick={() => { setActiveFilter(filter); setShowFilters(false) }}>{filter === 'all' ? 'Todas as notas' : filter === 'review' ? 'Em revisão' : filter === 'done' ? 'Validadas' : 'Arquivadas'}{activeFilter === filter && <Check size={13} />}</button>)}</div>}</div>{canEdit && <button className="icon-button" onClick={openEditProject} title="Editar projeto"><MoreHorizontal size={18} /></button>}</div></div>{activeView === 'activity' ? <section className="activity-panel"><div className="activity-heading"><div><span className="canvas-kicker">HISTÓRICO DO PROJETO</span><h2>Atividade recente</h2></div><span className="activity-count">{auditEvents.length} eventos</span></div>{auditEvents.length === 0 ? <p className="empty-search">Nenhuma atividade registrada ainda.</p> : auditEvents.map((event) => <div className="activity-item" key={event.id}><span className={`activity-icon ${event.action === 'note_deleted' ? 'sand' : 'green'}`}>{event.action === 'project_approved' ? <Check size={14} /> : event.action === 'project_new_version' ? <FilePlus2 size={14} /> : <Activity size={14} />}</span><div><strong>{describeAuditEvent(event)}</strong><small>{new Date(event.created_at).toLocaleString('pt-BR')}</small></div></div>)}</section> : activeView === 'history' ? <section className="activity-panel"><div className="activity-heading"><div><span className="canvas-kicker">VERSÕES APROVADAS</span><h2>Histórico de versões</h2></div><div className="activity-heading-actions">{canvasVersions.length >= 2 && <button className="secondary-button" onClick={() => (isComparingVersions ? setIsComparingVersions(false) : openCompareVersions())}>{isComparingVersions ? 'Fechar comparação' : 'Comparar versões'}</button>}<span className="activity-count">{canvasVersions.length} versões</span></div></div>{isComparingVersions ? (() => {
          const base = canvasVersions.find((version) => version.id === compareBaseId)
          const target = canvasVersions.find((version) => version.id === compareTargetId)
          const compareBlocks = base && target && base.id !== target.id ? blockMeta
            .map((meta) => ({ meta, diff: diffBlockNotes(base.notes_snapshot.filter((note) => note.block_key === meta.id), target.notes_snapshot.filter((note) => note.block_key === meta.id)) }))
            .filter(({ diff }) => diff.removed.length + diff.unchanged.length + diff.added.length > 0) : []
          return <div className="version-compare"><div className="version-compare-selects"><label>Versão base<select value={compareBaseId ?? ''} onChange={(event) => setCompareBaseId(event.target.value)}>{canvasVersions.map((version) => <option key={version.id} value={version.id}>Versão {version.version.toFixed(1)} · {new Date(version.approved_at).toLocaleDateString('pt-BR')}</option>)}</select></label><label>Versão comparada<select value={compareTargetId ?? ''} onChange={(event) => setCompareTargetId(event.target.value)}>{canvasVersions.map((version) => <option key={version.id} value={version.id}>Versão {version.version.toFixed(1)} · {new Date(version.approved_at).toLocaleDateString('pt-BR')}</option>)}</select></label></div>{!base || !target ? <p className="empty-search">Selecione duas versões para comparar.</p> : base.id === target.id ? <p className="empty-search">Escolha duas versões diferentes para comparar.</p> : compareBlocks.length === 0 ? <p className="empty-search">Nenhuma nota registrada nessas versões.</p> : <div className="version-compare-blocks">{compareBlocks.map(({ meta, diff }) => <div className="version-block" key={meta.id}><span className="version-block-title">{meta.title}</span>{diff.removed.map((note, index) => <p key={`removed-${index}`} className={`note ${note.color} note-removed`}>{note.text}<span className="note-diff-badge removed">removida</span></p>)}{diff.unchanged.map((note, index) => <p key={`unchanged-${index}`} className={`note ${note.color}`}>{note.text}<span className="note-author">{note.author}</span></p>)}{diff.added.map((note, index) => <p key={`added-${index}`} className={`note ${note.color} note-added`}>{note.text}<span className="note-diff-badge added">nova</span></p>)}</div>)}</div>}</div>
        })() : canvasVersions.length === 0 ? <p className="empty-search">Nenhuma versão aprovada ainda.</p> : canvasVersions.map((version) => <div className="version-item" key={version.id}><div className="version-item-header"><button className="version-item-toggle" onClick={() => setExpandedVersionId(expandedVersionId === version.id ? null : version.id)}><span className="activity-icon green"><History size={14} /></span><div><strong>Versão {version.version.toFixed(1)} · {version.project_name}</strong><small>Aprovado por {version.approved_by_label} em {new Date(version.approved_at).toLocaleString('pt-BR')}</small></div></button><button className="version-share-button" onClick={() => copyShareLink(version)} title="Copiar link público de leitura"><Link2 size={13} /> {copiedVersionId === version.id ? 'Copiado!' : 'Copiar link'}</button><button className="version-item-toggle version-item-chevron" onClick={() => setExpandedVersionId(expandedVersionId === version.id ? null : version.id)}><ChevronDown size={15} className={expandedVersionId === version.id ? 'chevron open' : 'chevron'} /></button></div>{expandedVersionId === version.id && <div className="version-snapshot">{version.notes_snapshot.length === 0 ? <p className="empty-search">Nenhuma nota registrada nesta versão.</p> : blockMeta.map((meta) => { const blockNotes = version.notes_snapshot.filter((note) => note.block_key === meta.id); return blockNotes.length === 0 ? null : <div className="version-block" key={meta.id}><span className="version-block-title">{meta.title}</span>{blockNotes.map((note, index) => <p key={index} className={`note ${note.color}`}>{note.text}<span className="note-author">{note.author}</span></p>)}</div> })}</div>}</div>)}</section> : <div className="canvas-wrap"><div className="canvas-intro"><div><span className="canvas-kicker">MODELO DE PROJETO</span><h2>Project Model Canvas <span>·</span> <small>rascunho compartilhado</small></h2></div><div className="canvas-legend"><span><i className="legend-dot verified" /> validado</span><span><i className="legend-dot review" /> em revisão</span></div></div><div className="canvas-grid" ref={canvasGridRef} data-manager={activeProject.manager_name} data-project={activeProject.name}>{filteredBlocks.map((block) => <article key={block.id} className={`canvas-block ${block.tone} ${selectedBlock === block.id ? 'selected' : ''}`} onClick={() => setSelectedBlock(block.id)}><div className="block-header"><div><span className="question-label">{block.question}</span><h3>{block.title}</h3>{(blocks.find((item) => item.id === block.id)?.notes.filter((note) => !note.archived_at).length ?? 0) === 0 && <span className="empty-block-badge">bloco vazio</span>}</div><BlockApprovalControls members={orgMembers} requirements={blockRequirementsFor(block.id)} approvals={blockApprovalsFor(block.id)} currentUserId={user.id} canManage={canEdit && !isLocked} onToggleApproval={() => toggleBlockApproval(block.id)} onToggleRequirement={(userId) => toggleRequiredApprover(block.id, userId)} onBeforeOpenPicker={refreshOrgMembers} /></div><div className="notes-list">{block.notes.map((note) => <div className={note.archived_at ? `note ${note.color} archived` : `note ${note.color}`} key={note.id} onClick={(event) => { event.stopPropagation(); refreshOrgMembers(); setNewNoteComment(''); setEditingNote({ blockId: block.id, note }) }}>{canEditNoteInBlock(block.id) ? <button type="button" className={note.pinned ? 'note-pin-button pinned' : 'note-pin-button'} onClick={(event) => { event.stopPropagation(); toggleNotePinned(note) }} title={note.pinned ? 'Desafixar nota' : 'Fixar nota'}><Pin size={11} /></button> : note.pinned ? <span className="note-pin-button pinned" title="Nota fixada"><Pin size={11} /></span> : null}<p>{note.text}</p><div className="note-footer">{note.archived_at && <span className="note-archived-badge">arquivada</span>}{block.id === 'risks' && <span className={isRiskTreated(note) ? 'risk-treated-badge treated' : 'risk-treated-badge'}>{isRiskTreated(note) ? 'tratado' : 'não tratado'}</span>}{block.id === 'requirements' && (deliverableLinksForRequirement(note.id).length === 0 ? <span className="note-unassigned" title="Sem entrega vinculada">sem entrega</span> : <span className="note-comment-badge" title="Entregas vinculadas"><Link2 size={9} /> {deliverableLinksForRequirement(note.id).length}</span>)}{!note.assignee_user_id && <span className="note-unassigned" title="Sem responsável definido">sem responsável</span>}{note.assignee_label && <span className="note-assignee" title={`Responsável: ${note.assignee_label}`}>{getInitials(note.assignee_label)}</span>}<span className="note-author" title={`Criado por ${note.author}`}>{note.author}</span>{noteCommentsFor(note.id).length > 0 && <span className="note-comment-badge" title="Ver comentários da nota"><MessageCircle size={9} /> {noteCommentsFor(note.id).length}</span>}{note.status === 'done' && <Check size={13} className="note-check" />}{note.status === 'review' && <span className="review-label">revisar</span>}</div></div>)}{block.notes.length === 0 && <span className="empty-search">Nenhuma nota encontrada</span>}</div>{canEditNoteInBlock(block.id) && <button className="add-note" onClick={(event) => { event.stopPropagation(); refreshOrgMembers(); setSelectedBlock(block.id); setIsAdding(true) }}><Plus size={14} /> adicionar nota</button>}</article>)}</div><div className="canvas-footer"><span><span className="pulse-dot" /> {realtimeStatus === 'online' ? 'Sincronização online' : 'Modo local'}</span></div></div>}
        </>}
      </div></main>
      {isProjectView && activeProject && <div className="export-wrap"><button className="export-button" onClick={() => setShowExportMenu(!showExportMenu)} title="Exportar canvas"><ArrowDownToLine size={15} /> Exportar</button>{showExportMenu && <div className="export-menu"><button onClick={() => { void exportCanvasPng(); setShowExportMenu(false) }}><ImageIcon size={14} /> Imagem PNG</button><button onClick={() => { void exportCanvasPdf(); setShowExportMenu(false) }}><FileText size={14} /> PDF</button><button onClick={() => { exportCanvas(); setShowExportMenu(false) }}><FileJson size={14} /> Backup JSON</button></div>}</div>}
      {isProjectView && showComments && <aside className="comment-composer"><div className="comment-composer-header"><span><MessageCircle size={15} /> Adicionar comentário</span><button className="icon-button" onClick={() => setShowComments(false)}><X size={15} /></button></div><div className="comment-list">{comments.map((comment) => <p key={comment.id}><b>{comment.author}</b>{comment.text}</p>)}</div>{canComment ? <><textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Escreva uma observação para a equipe..." /><button className="primary-button comment-submit" onClick={addComment}><MessageCircle size={15} /> Comentar</button></> : <p className="empty-search">Apenas leitura para o seu papel.</p>}</aside>}
      {editingNote && <div className="composer-backdrop" onClick={() => setEditingNote(null)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setEditingNote(null)}><X size={17} /></button><span className="canvas-kicker">EDITAR NOTA</span><h2>{blocks.find((block) => block.id === editingNote.blockId)?.title}</h2><textarea autoFocus readOnly={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.text} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, text: event.target.value } })} />{(canEditNoteInBlock(editingNote.blockId) || editingNote.note.indicator || editingNote.note.evidence_source || editingNote.note.review_date) && <div className="note-support-fields"><label>Indicador<input disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.indicator ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, indicator: event.target.value || null } })} placeholder="Ex.: % de adoção" /></label><label>Fonte da evidência<input disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.evidence_source ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, evidence_source: event.target.value || null } })} placeholder="Ex.: pesquisa com usuários" /></label><label>Data de revisão<input type="date" disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.review_date ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, review_date: event.target.value || null } })} /></label></div>}{editingNote.blockId === 'risks' && <div className="note-support-fields"><div className="risk-treated-row"><span className={isRiskTreated(editingNote.note) ? 'risk-treated-badge treated' : 'risk-treated-badge'}>{isRiskTreated(editingNote.note) ? 'Risco tratado' : 'Risco não tratado'}</span></div><label>Probabilidade<select disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.risk_probability ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, risk_probability: (event.target.value || null) as typeof editingNote.note.risk_probability } })}><option value="">Não definida</option><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></label><label>Impacto<select disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.risk_impact ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, risk_impact: (event.target.value || null) as typeof editingNote.note.risk_impact } })}><option value="">Não definido</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option></select></label><label>Resposta ao risco<select disabled={!canEditNoteInBlock(editingNote.blockId)} value={editingNote.note.risk_response ?? ''} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, risk_response: (event.target.value || null) as typeof editingNote.note.risk_response } })}><option value="">Não definida</option><option value="mitigar">Mitigar</option><option value="transferir">Transferir</option><option value="aceitar">Aceitar</option><option value="evitar">Evitar</option></select></label><p className="empty-search">Responsável pelo risco é o campo "Responsável" acima.</p></div>}{editingNote.blockId === 'requirements' && <div className="note-support-fields"><span className="canvas-kicker">ENTREGAS VINCULADAS</span>{notes.filter((note) => note.block_key === 'deliverables' && !note.archived_at).length === 0 ? <p className="empty-search">Nenhuma entrega cadastrada ainda neste projeto.</p> : <div className="deliverable-link-list">{notes.filter((note) => note.block_key === 'deliverables' && !note.archived_at).map((deliverable) => { const linked = deliverableLinksForRequirement(editingNote.note.id).some((link) => link.deliverable_note_id === deliverable.id); return <label key={deliverable.id} className="deliverable-link-item"><input type="checkbox" checked={linked} disabled={!canEditNoteInBlock('requirements')} onChange={() => toggleRequirementDeliverableLink(editingNote.note.id, deliverable.id)} />{deliverable.text}</label> })}</div>}</div>}{canEditNoteInBlock(editingNote.blockId) ? <><div className="note-status-editor"><span>STATUS DA NOTA</span><button className={editingNote.note.status === 'review' || !editingNote.note.status ? 'status-choice selected' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'review' } })}>Em revisão</button><button className={editingNote.note.status === 'done' ? 'status-choice selected done' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'done' } })}>Validada</button></div><div className="color-picker">{noteColors.map((color) => <button type="button" key={color} className={color === editingNote.note.color ? `color-swatch ${color} selected` : `color-swatch ${color}`} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, color } })} aria-label={`Cor ${color}`} />)}</div><label className="assignee-field">Responsável (opcional)<select value={editingNote.note.assignee_user_id ?? ''} onChange={(event) => { const member = orgMembers.find((item) => item.userId === event.target.value); setEditingNote({ ...editingNote, note: { ...editingNote.note, assignee_user_id: member?.userId ?? null, assignee_label: member ? memberLabel(member) : null } }) }}><option value="">Ninguém</option>{orgMembers.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}</select></label><div className="composer-actions"><button className="danger-button" onClick={deleteEditedNote}>Excluir</button><button type="button" className="icon-button" onClick={() => moveEditedNote('up')} title="Mover para cima"><ArrowUp size={14} /></button><button type="button" className="icon-button" onClick={() => moveEditedNote('down')} title="Mover para baixo"><ArrowDown size={14} /></button><button type="button" className="secondary-button" onClick={toggleArchiveEditedNote}>{editingNote.note.archived_at ? <><ArchiveRestore size={14} /> Restaurar</> : <><Archive size={14} /> Arquivar</>}</button><button className="secondary-button" onClick={() => setEditingNote(null)}>Cancelar</button><button className="primary-button" onClick={saveEditedNote}><Check size={16} /> Salvar nota</button></div></> : <><p className="empty-search">{isLocked ? 'Projeto aprovado está travado. Crie uma nova versão para editar.' : isBlockApproved(editingNote.blockId) ? 'Bloco aprovado está travado. Desaprove o bloco para editar.' : 'Apenas leitura para o seu papel.'}</p><div className="composer-actions"><button className="secondary-button" onClick={() => setEditingNote(null)}>Fechar</button></div></>}<div className="note-comments"><span className="canvas-kicker">COMENTÁRIOS DA NOTA</span>{noteCommentsFor(editingNote.note.id).length === 0 ? <p className="empty-search">Nenhum comentário nesta nota ainda.</p> : noteCommentsFor(editingNote.note.id).map((comment) => <p key={comment.id} className="note-comment"><b>{comment.author}</b>{comment.text}</p>)}{canComment && <div className="note-comment-composer"><textarea value={newNoteComment} onChange={(event) => setNewNoteComment(event.target.value)} placeholder="Comentar nesta nota..." /><button type="button" className="secondary-button" onClick={addNoteComment}><MessageCircle size={14} /> Comentar</button></div>}</div></div></div>}
      {isEditingProject && <div className="project-modal-backdrop" onClick={() => setIsEditingProject(false)}><form className="project-modal" onSubmit={(event) => { event.preventDefault(); saveProjectEdit() }} onClick={(event) => event.stopPropagation()}><span className="canvas-kicker">EDITAR PROJETO</span><h2>Editar projeto</h2>{isLocked && <p className="empty-search">Projeto aprovado está travado. Crie uma nova versão para editar nome/gerente — mas ainda dá para arquivar.</p>}<label>Nome do projeto<input value={editName} onChange={(event) => setEditName(event.target.value)} disabled={isLocked} autoFocus /></label><label>Gerente do projeto<select value={editManagerUserId} onChange={(event) => setEditManagerUserId(event.target.value)} disabled={isLocked}>{orgMembers.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}</select></label><div className="project-modal-actions"><button type="button" className="danger-button" onClick={archiveActiveProject}><Archive size={14} /> Arquivar projeto</button>{role === 'admin' && <button type="button" className="danger-button" disabled={isDeletingProject} onClick={() => { if (activeProject) void deleteProjectAction(activeProject) }}>{isDeletingProject ? 'Excluindo...' : 'Excluir definitivamente'}</button>}<button type="button" className="secondary-button" onClick={() => setIsEditingProject(false)}>Cancelar</button>{!isLocked && <button type="submit" className="primary-button"><Check size={15} /> Salvar</button>}</div></form></div>}
      {isAdding && <div className="composer-backdrop" onClick={() => setIsAdding(false)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setIsAdding(false)}><X size={17} /></button><span className="canvas-kicker">NOVA NOTA</span><h2>{blocks.find((block) => block.id === selectedBlock)?.title}</h2><textarea autoFocus value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Escreva uma ideia curta e objetiva..." /><div className="color-picker">{noteColors.map((color) => <button type="button" key={color} className={color === newNoteColor ? `color-swatch ${color} selected` : `color-swatch ${color}`} onClick={() => setNewNoteColor(color)} aria-label={`Cor ${color}`} />)}</div><label className="assignee-field">Responsável (opcional)<select value={newNoteAssigneeUserId} onChange={(event) => setNewNoteAssigneeUserId(event.target.value)}><option value="">Ninguém</option>{orgMembers.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}</select></label><button type="button" className="tiny-link support-fields-toggle" onClick={() => setShowNewNoteSupport(!showNewNoteSupport)}>{showNewNoteSupport ? 'Ocultar campos de apoio' : '+ Campos de apoio (opcional)'}</button>{showNewNoteSupport && <div className="note-support-fields"><label>Indicador<input value={newNoteIndicator} onChange={(event) => setNewNoteIndicator(event.target.value)} placeholder="Ex.: % de adoção" /></label><label>Fonte da evidência<input value={newNoteEvidenceSource} onChange={(event) => setNewNoteEvidenceSource(event.target.value)} placeholder="Ex.: pesquisa com usuários" /></label><label>Data de revisão<input type="date" value={newNoteReviewDate} onChange={(event) => setNewNoteReviewDate(event.target.value)} /></label></div>}<div className="composer-actions"><button className="secondary-button" onClick={() => setIsAdding(false)}>Cancelar</button><button className="primary-button" onClick={addNote}><Plus size={16} /> Adicionar nota</button></div></div></div>}
    </div>
  )
}

export default App
