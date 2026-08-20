import { supabase } from './supabase'

export async function signUpWithPassword(email: string, password: string, fullName: string): Promise<{ needsEmailConfirmation: boolean }> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error

  return { needsEmailConfirmation: !data.session }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signInWithMagicLink(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { error } = await supabase.auth.signInWithOtp({ email })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}
