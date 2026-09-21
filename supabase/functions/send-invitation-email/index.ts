// Sends the "you've been invited" e-mail via Resend. Deliberately does
// its own authorization instead of trusting the caller: it re-queries
// the invitation using the CALLER's own JWT (forwarded automatically by
// supabase.functions.invoke), so Postgres RLS decides who's allowed to
// see that row — same "RLS is the only real boundary" rule the rest of
// this project follows, instead of duplicating the admin check here.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com/emails'

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  commenter: 'Comentarista',
  reader: 'Leitor',
}

// Edge Functions run on their own origin, so the browser preflights
// every call — without these headers, supabase.functions.invoke()
// fails with a CORS error before the function body ever runs.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body: { invitationId?: string; appUrl?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo da requisicao invalido.' }, 400)
  }

  const { invitationId, appUrl } = body
  if (!invitationId || !appUrl) {
    return jsonResponse({ error: 'invitationId e appUrl sao obrigatorios.' }, 400)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Nao autenticado.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'SUPABASE_URL/SUPABASE_ANON_KEY ausentes no ambiente da function.' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: invitation, error: invitationError } = await supabase
    .from('invitations')
    .select('email, role, organizations(name)')
    .eq('id', invitationId)
    .single()

  if (invitationError || !invitation) {
    return jsonResponse({ error: 'Convite nao encontrado ou sem permissao para envia-lo.' }, 404)
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return jsonResponse({ error: 'RESEND_API_KEY nao configurada. Rode: supabase secrets set RESEND_API_KEY=seu_valor' }, 500)
  }

  const fromAddress = Deno.env.get('RESEND_FROM') || 'projectly <onboarding@resend.dev>'
  const orgRaw = invitation.organizations as { name: string } | { name: string }[] | null
  const orgName = (Array.isArray(orgRaw) ? orgRaw[0]?.name : orgRaw?.name) || 'um workspace'
  const roleLabel = roleLabels[invitation.role as string] ?? invitation.role

  const emailRes = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [invitation.email],
      subject: `Você foi convidado para ${orgName} no projectly`,
      html: `
        <p>Olá,</p>
        <p>Você foi convidado para participar de <strong>${orgName}</strong> no projectly, como <strong>${roleLabel}</strong>.</p>
        <p><a href="${appUrl}">Entre ou crie sua conta com este e-mail</a> para aceitar o convite — ele aparece automaticamente assim que você faz login.</p>
        <p style="color:#8b9793;font-size:12px">Se você não esperava este e-mail, pode ignorá-lo.</p>
      `,
    }),
  })

  if (!emailRes.ok) {
    const detail = await emailRes.text()
    return jsonResponse({ error: `Resend recusou o envio: ${detail}` }, 502)
  }

  return jsonResponse({ ok: true }, 200)
})
