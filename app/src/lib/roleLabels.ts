import type { Membership } from './organizationsRepository'

export const roleLabels: Record<Membership['role'], string> = {
  admin: 'Administrador',
  editor: 'Editor',
  commenter: 'Comentarista',
  reader: 'Leitor',
}
