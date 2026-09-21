import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ShieldCheck, Users } from 'lucide-react'
import type { OrgMember } from './lib/organizationsRepository'
import type { BlockApprovalRow } from './lib/blockApprovalsRepository'
import type { BlockApprovalRequirementRow } from './lib/blockApprovalRequirementsRepository'

function memberLabel(member: OrgMember): string {
  return member.fullName || member.email.split('@')[0]
}

function BlockApprovalControls({ members, requirements, approvals, currentUserId, canManage, onToggleApproval, onToggleRequirement, onBeforeOpenPicker }: {
  members: OrgMember[]
  requirements: BlockApprovalRequirementRow[]
  approvals: BlockApprovalRow[]
  currentUserId: string
  canManage: boolean
  onToggleApproval: () => void
  onToggleRequirement: (userId: string) => void
  onBeforeOpenPicker: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showPicker) return
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (triggerRef.current?.contains(target)) return
      if (target.closest('.requirements-popover')) return
      setShowPicker(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showPicker])

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPopoverPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 216) })
    setShowPicker(true)
    onBeforeOpenPicker()
  }

  const approvedUserIds = new Set(approvals.map((approval) => approval.approved_by))
  const hasRequirements = requirements.length > 0
  const approvedCount = hasRequirements ? requirements.filter((requirement) => approvedUserIds.has(requirement.user_id)).length : approvals.length
  const isFullyApproved = hasRequirements ? approvedCount === requirements.length : approvals.length > 0
  const myApproval = approvals.find((approval) => approval.approved_by === currentUserId)

  return (
    <div className="block-approval" onClick={(event) => event.stopPropagation()}>
      {(approvals.length > 0 || hasRequirements) && (
        <button
          className={isFullyApproved ? 'block-menu approved' : 'block-menu partial'}
          onClick={canManage ? onToggleApproval : undefined}
          title={hasRequirements
            ? `${approvedCount}/${requirements.length} aprovações${myApproval ? ' · você já aprovou' : canManage ? ' · clique para aprovar' : ''}`
            : `Aprovado por ${approvals[0]?.approved_by_label ?? ''}${canManage ? ' · clique para desaprovar' : ''}`}
        >
          {isFullyApproved ? <Check size={16} /> : <span className="approval-count">{approvedCount}/{requirements.length}</span>}
        </button>
      )}
      {approvals.length === 0 && !hasRequirements && canManage && (
        <button className="block-menu" onClick={onToggleApproval} title="Aprovar bloco"><ShieldCheck size={16} /></button>
      )}
      {canManage && (
        <button ref={triggerRef} className="block-menu" onClick={() => (showPicker ? setShowPicker(false) : openPicker())} title="Definir aprovadores necessários"><Users size={13} /></button>
      )}
      {showPicker && popoverPos && createPortal(
        <div className="requirements-popover" style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left }} onClick={(event) => event.stopPropagation()}>
          <span className="requirements-popover-title">APROVADORES NECESSÁRIOS</span>
          {members.map((member) => (
            <label key={member.userId} className="requirements-popover-option">
              <input type="checkbox" checked={requirements.some((requirement) => requirement.user_id === member.userId)} onChange={() => onToggleRequirement(member.userId)} />
              <span>{memberLabel(member)}</span>
              {approvedUserIds.has(member.userId) && <Check size={11} className="requirements-check" />}
            </label>
          ))}
          {members.length === 0 && <small className="empty-search">Nenhum membro na organização.</small>}
          {members.length > 0 && requirements.length === 0 && <small className="requirements-hint">Sem exigência: qualquer aprovação trava o bloco.</small>}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default BlockApprovalControls
