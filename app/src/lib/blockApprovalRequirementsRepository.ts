import { supabase } from './supabase'

export type BlockApprovalRequirementRow = {
  id: string
  project_id: string
  block_key: string
  user_id: string
  added_by: string | null
  created_at: string
}

export async function listBlockApprovalRequirements(projectId: string): Promise<BlockApprovalRequirementRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('block_approval_requirements')
    .select('*')
    .eq('project_id', projectId)

  if (error) {
    console.warn('Supabase block approval requirements load failed:', error.message)
    return []
  }
  return data ?? []
}

export async function addRequiredApprover(projectId: string, blockKey: string, userId: string): Promise<BlockApprovalRequirementRow> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase
    .from('block_approval_requirements')
    .insert({ project_id: projectId, block_key: blockKey, user_id: userId })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function removeRequiredApprover(projectId: string, blockKey: string, userId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('block_approval_requirements')
    .delete()
    .eq('project_id', projectId)
    .eq('block_key', blockKey)
    .eq('user_id', userId)
    .select('id')
    .single()

  if (error) throw error
}
