import { supabase } from './supabase'

export type RequirementDeliverableLinkRow = {
  id: string
  project_id: string
  requirement_note_id: string
  deliverable_note_id: string
  created_by: string | null
  created_at: string
}

export async function listRequirementDeliverableLinks(projectId: string): Promise<RequirementDeliverableLinkRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('requirement_deliverable_links')
    .select('*')
    .eq('project_id', projectId)

  if (error) {
    console.warn('Supabase requirement-deliverable links load failed:', error.message)
    return []
  }
  return data ?? []
}

export async function linkRequirementToDeliverable(projectId: string, requirementNoteId: string, deliverableNoteId: string): Promise<RequirementDeliverableLinkRow> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase
    .from('requirement_deliverable_links')
    .insert({ project_id: projectId, requirement_note_id: requirementNoteId, deliverable_note_id: deliverableNoteId })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function unlinkRequirementFromDeliverable(requirementNoteId: string, deliverableNoteId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('requirement_deliverable_links')
    .delete()
    .eq('requirement_note_id', requirementNoteId)
    .eq('deliverable_note_id', deliverableNoteId)
    .select('id')
    .single()

  if (error) throw error
}
