import { supabase } from './supabase'

export type CommentRow = {
  id: string
  project_id: string
  text: string
  author: string
  created_by: string | null
  created_at: string
}

export async function listComments(projectId: string): Promise<CommentRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('Supabase comments load failed:', error.message)
    return []
  }
  return data ?? []
}

export async function createComment(projectId: string, text: string, author: string): Promise<CommentRow> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase
    .from('comments')
    .insert({ project_id: projectId, text, author })
    .select('*')
    .single()

  if (error) throw error
  return data
}
