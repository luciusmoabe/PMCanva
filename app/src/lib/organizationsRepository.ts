import { supabase } from './supabase'

export type Membership = {
  organizationId: string
  organizationName: string
  role: 'admin' | 'editor' | 'commenter' | 'reader'
}

type MembershipRow = {
  organization_id: string
  role: Membership['role']
  organizations: { name: string } | { name: string }[] | null
}

export async function listMyMemberships(): Promise<Membership[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('memberships')
    .select('organization_id, role, organizations(name)')
    .returns<MembershipRow[]>()

  if (error) {
    console.warn('Supabase memberships load failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
    return { organizationId: row.organization_id, organizationName: org?.name ?? '', role: row.role }
  })
}

type OrganizationRow = { id: string; name: string; created_by: string | null; created_at: string }

export async function createOrganization(name: string): Promise<Membership> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase.rpc('create_organization_with_owner', { org_name: name })
  if (error) throw error

  const org = data as unknown as OrganizationRow
  return { organizationId: org.id, organizationName: org.name, role: 'admin' }
}
