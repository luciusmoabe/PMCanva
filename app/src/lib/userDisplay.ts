import type { User } from '@supabase/supabase-js'

export function getDisplayName(user: User | null): string {
  if (!user) return ''
  const fullName = user.user_metadata?.full_name
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim()
  return user.email?.split('@')[0] ?? 'Usuario'
}

export function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
