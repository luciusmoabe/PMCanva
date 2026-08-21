import { supabase } from './supabase'

export type BlockApprovalRow = {
  id: string
  project_id: string
  block_key: string
  approved_by: string | null
  approved_by_label: string
  approved_at: string
}

export async function listBlockApprovals(projectId: string): Promise<BlockApprovalRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('block_approvals')
    .select('*')
    .eq('project_id', projectId)

  if (error) {
    console.warn('Supabase block approvals load failed:', error.message)
    return []
  }
  return data ?? []
}

export async function approveBlock(projectId: string, blockKey: string, approvedByLabel: string): Promise<BlockApprovalRow> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase
    .from('block_approvals')
    .insert({ project_id: projectId, block_key: blockKey, approved_by_label: approvedByLabel })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function unapproveBlock(projectId: string, blockKey: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('block_approvals')
    .delete()
    .eq('project_id', projectId)
    .eq('block_key', blockKey)
    .select('id')
    .single()

  if (error) throw error
}
