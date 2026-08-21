import { supabase } from './supabase'
import { listMyMemberships, type Membership } from './organizationsRepository'

export type InvitationRow = {
  id: string
  organization_id: string
  email: string
  role: Membership['role']
  status: 'pending' | 'accepted' | 'revoked'
  invited_by: string | null
  created_at: string
  accepted_at: string | null
}

export type InvitationWithOrgName = InvitationRow & { organizationName: string }

type InvitationWithOrgRow = InvitationRow & { organizations: { name: string } | { name: string }[] | null }

export async function listOrgInvitations(organizationId: string): Promise<InvitationRow[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('Supabase invitations load failed:', error.message)
    return []
  }
  return data ?? []
}

export async function listMyPendingInvitations(): Promise<InvitationWithOrgName[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('invitations')
    .select('*, organizations(name)')
    .eq('status', 'pending')
    .returns<InvitationWithOrgRow[]>()

  if (error) {
    console.warn('Supabase pending invitations load failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
    const { organizations: _organizations, ...invitation } = row
    return { ...invitation, organizationName: org?.name ?? '' }
  })
}

export async function createInvitation(organizationId: string, email: string, role: Membership['role']): Promise<InvitationRow> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await supabase
    .from('invitations')
    .insert({ organization_id: organizationId, email: normalizedEmail, role })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Ja existe um convite pendente para esse e-mail.')
    throw error
  }
  return data
}

export async function sendInvitationEmail(invitationId: string, appUrl: string): Promise<void> {
  if (!supabase) return

  const { data, error } = await supabase.functions.invoke('send-invitation-email', { body: { invitationId, appUrl } })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String(data.error))
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('invitations').update({ status: 'revoked' }).eq('id', invitationId)
  if (error) throw error
}

export async function acceptInvitation(invitationId: string): Promise<Membership> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase.rpc('accept_invitation', { invitation_id: invitationId })
  if (error) throw error

  const organizationId = (data as { organization_id: string }).organization_id
  const memberships = await listMyMemberships()
  const membership = memberships.find((item) => item.organizationId === organizationId)
  if (!membership) throw new Error('Convite aceito, mas nao foi possivel carregar a organizacao.')
  return membership
}
