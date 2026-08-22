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

export type OrgAuditEventRow = AuditEventRow & { project_name: string }

type OrgAuditEventJoinRow = AuditEventRow & { projects: { name: string } | { name: string }[] | null }

export async function listOrgAuditEvents(organizationId: string, limit = 50): Promise<OrgAuditEventRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('audit_events')
    .select('*, projects!inner(name)')
    .eq('projects.organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<OrgAuditEventJoinRow[]>()

  if (error) {
    console.warn('Supabase org audit events load failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const projectsRaw = row.projects
    const projectName = (Array.isArray(projectsRaw) ? projectsRaw[0]?.name : projectsRaw?.name) ?? ''
    const { projects: _projects, ...rest } = row
    return { ...rest, project_name: projectName }
  })
}
