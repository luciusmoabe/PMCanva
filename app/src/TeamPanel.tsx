import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { UserPlus, Users, X } from 'lucide-react'
import { listOrgMembers, type OrgMember, type Membership } from './lib/organizationsRepository'
import { createInvitation, listOrgInvitations, revokeInvitation, type InvitationRow } from './lib/invitationsRepository'
import { roleLabels } from './lib/roleLabels'

const roleOptions: Membership['role'][] = ['admin', 'editor', 'commenter', 'reader']

function TeamPanel({ organizationId, role }: { organizationId: string; role: Membership['role'] }) {
  const isAdmin = role === 'admin'
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Membership['role']>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function refreshMembers() {
    listOrgMembers(organizationId).then(setMembers)
  }

  function refreshInvitations() {
    if (isAdmin) listOrgInvitations(organizationId).then(setInvitations)
  }

  useEffect(() => {
    refreshMembers()
    refreshInvitations()
  }, [organizationId])

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    if (!inviteEmail.trim()) return
    setError(null)
    setLoading(true)
    try {
      await createInvitation(organizationId, inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      refreshInvitations()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel enviar o convite.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(invitationId: string) {
    try {
      await revokeInvitation(invitationId)
      setInvitations((current) => current.filter((item) => item.id !== invitationId))
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Nao foi possivel revogar o convite.')
    }
  }

  return (
    <div className="team-panel">
      <div className="team-section">
        <h2><Users size={16} /> Membros da organizacao</h2>
        {members.map((member) => (
          <div className="member-row" key={member.membershipId}>
            <div className="member-info">
              <b>{member.fullName || member.email.split('@')[0]}</b>
              <small>{member.email}</small>
            </div>
            <span className="role-badge">{roleLabels[member.role]}</span>
          </div>
        ))}
        {members.length === 0 && <p className="empty-search">Carregando membros...</p>}
      </div>

      {isAdmin && (
        <div className="team-section">
          <h2><UserPlus size={16} /> Convidar membro</h2>
          <p className="auth-subtitle">Nenhum e-mail e enviado automaticamente — avise a pessoa por fora que ela foi convidada.</p>
          <form className="invite-form" onSubmit={handleInvite}>
            <label>E-mail
              <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="pessoa@empresa.com" required />
            </label>
            <label>Papel
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Membership['role'])}>
                {roleOptions.map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}
              </select>
            </label>
            <button type="submit" className="primary-button" disabled={loading}><UserPlus size={15} /> Convidar</button>
          </form>
          {error && <div className="error-banner">{error}</div>}

          {invitations.length > 0 && <>
            <span className="canvas-kicker">CONVITES PENDENTES</span>
            {invitations.map((invitation) => (
              <div className="invite-row" key={invitation.id}>
                <div className="invite-info">
                  <b>{invitation.email}</b>
                  <small>{roleLabels[invitation.role]}</small>
                </div>
                <button className="icon-button" onClick={() => handleRevoke(invitation.id)} title="Revogar convite"><X size={15} /></button>
              </div>
            ))}
          </>}
        </div>
      )}
    </div>
  )
}

export default TeamPanel
