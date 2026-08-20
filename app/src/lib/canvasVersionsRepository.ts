import { supabase } from './supabase'

export type VersionNoteSnapshot = {
  block_key: string
  text: string
  author: string
  color: string
  status: 'done' | 'review' | null
}

export type CanvasVersionRow = {
  id: string
  project_id: string
  version: number
  project_name: string
  manager_name: string
  approved_by: string | null
  approved_by_label: string
  notes_snapshot: VersionNoteSnapshot[]
  approved_at: string
}

export async function listCanvasVersions(projectId: string): Promise<CanvasVersionRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('canvas_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('approved_at', { ascending: false })

  if (error) {
    console.warn('Supabase canvas versions load failed:', error.message)
    return []
  }
  return data ?? []
}
