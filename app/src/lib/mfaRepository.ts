import { supabase } from './supabase'

export type TotpFactor = {
  id: string
  status: 'verified' | 'unverified'
}

export type AssuranceLevel = {
  currentLevel: string | null
  nextLevel: string | null
}

export async function listTotpFactors(): Promise<TotpFactor[]> {
  if (!supabase) return []

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return (data?.totp ?? []).map((factor) => ({ id: factor.id, status: factor.status }))
}

export async function getAssuranceLevel(): Promise<AssuranceLevel> {
  if (!supabase) return { currentLevel: null, nextLevel: null }

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return { currentLevel: data.currentLevel, nextLevel: data.nextLevel }
}

export async function enrollTotp(): Promise<{ factorId: string; qrCode: string; secret: string }> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError

  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
  if (verifyError) throw verifyError
}

export async function unenrollTotp(factorId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

export async function verifyLoginChallenge(factorId: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado.')

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}
