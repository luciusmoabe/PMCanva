import { supabase } from './supabase'
import type { CommentRow } from './commentsRepository'
import type { BlockApprovalRow } from './blockApprovalsRepository'

export type ProjectRow = {
  id: string
  organization_id: string
  name: string
  manager_name: string
  manager_user_id: string | null
  status: string
  version: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type NoteRow = {
  id: string
  project_id: string
  block_key: string
  text: string
  author: string
  color: string
  status: 'done' | 'review' | null
  indicator: string | null
  evidence_source: string | null
  review_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type NoteSupportFields = {
  indicator: string | null
  evidenceSource: string | null
  reviewDate: string | null
}

export async function listProjects(organizationId: string): Promise<ProjectRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('Supabase projects load failed:', error.message)
    return []
  }
  return data ?? []
}

export async function createProject(organizationId: string, name: string, managerUserId: string, managerName: string): Promise<ProjectRow> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase
    .from('projects')
    .insert({ organization_id: organizationId, name, manager_user_id: managerUserId, manager_name: managerName })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateProject(projectId: string, patch: Partial<Pick<ProjectRow, 'name' | 'manager_name' | 'manager_user_id' | 'status' | 'version'>>): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('projects').update(patch).eq('id', projectId)
  if (error) throw error
}

export async function listNotes(projectId: string): Promise<NoteRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('Supabase notes load failed:', error.message)
    return []
  }
  return data ?? []
}

export async function createNote(projectId: string, blockKey: string, text: string, author: string, color: string, support: NoteSupportFields): Promise<NoteRow> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase
    .from('notes')
    .insert({ project_id: projectId, block_key: blockKey, text, author, color, indicator: support.indicator, evidence_source: support.evidenceSource, review_date: support.reviewDate })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateNote(noteId: string, patch: Partial<Pick<NoteRow, 'text' | 'status' | 'color' | 'indicator' | 'evidence_source' | 'review_date'>>): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('notes').update(patch).eq('id', noteId).select('id').single()
  if (error) throw error
}

export async function deleteNote(noteId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('notes').delete().eq('id', noteId).select('id').single()
  if (error) throw error
}

export type ProjectRealtimeHandlers = {
  onNoteInsert: (note: NoteRow) => void
  onNoteUpdate: (note: NoteRow) => void
  onNoteDelete: (noteId: string) => void
  onProjectUpdate: (project: ProjectRow) => void
  onCommentInsert: (comment: CommentRow) => void
  onBlockApprovalInsert: (approval: BlockApprovalRow) => void
  onBlockApprovalDelete: (approvalId: string) => void
}

export function subscribeToProject(projectId: string, handlers: ProjectRealtimeHandlers, onStatus?: (status: 'online' | 'offline') => void) {
  if (!supabase) {
    onStatus?.('offline')
    return () => undefined
  }
  const client = supabase

  const channel = client
    .channel(`project-${projectId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes', filter: `project_id=eq.${projectId}` }, (payload) => {
      handlers.onNoteInsert(payload.new as NoteRow)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes', filter: `project_id=eq.${projectId}` }, (payload) => {
      handlers.onNoteUpdate(payload.new as NoteRow)
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes', filter: `project_id=eq.${projectId}` }, (payload) => {
      handlers.onNoteDelete((payload.old as { id: string }).id)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, (payload) => {
      handlers.onProjectUpdate(payload.new as ProjectRow)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `project_id=eq.${projectId}` }, (payload) => {
      handlers.onCommentInsert(payload.new as CommentRow)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'block_approvals', filter: `project_id=eq.${projectId}` }, (payload) => {
      handlers.onBlockApprovalInsert(payload.new as BlockApprovalRow)
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'block_approvals', filter: `project_id=eq.${projectId}` }, (payload) => {
      handlers.onBlockApprovalDelete((payload.old as { id: string }).id)
    })
    .subscribe((status) => {
      onStatus?.(status === 'SUBSCRIBED' ? 'online' : 'offline')
    })

  return () => { void client.removeChannel(channel) }
}
