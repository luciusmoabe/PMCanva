import { supabase } from './supabase'

export type AuditAction = 'note_created' | 'note_updated' | 'note_deleted' | 'project_approved' | 'project_new_version' | 'block_approved' | 'block_unapproved' | 'project_archived' | 'project_restored'

export type AuditEventRow = {
  id: string
  project_id: string
  actor: string | null
  actor_label: string
  action: AuditAction
  block_key: string | null
  created_at: string
}

export async function listAuditEvents(projectId: string): Promise<AuditEventRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Supabase audit events load failed:', error.message)
    return []
  }
  return data ?? []
}
