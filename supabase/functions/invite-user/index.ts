// Edge Function: solo admin puede invitar usuarios (cualquier email válido)
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (inyectados por Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.111.0'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const next = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) || next.length > 254) return null
  return next
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Método no permitido' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: 'Configuración del servidor incompleta' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'No autenticado' })
  }

  let payload: { email?: string; redirectTo?: string }
  try {
    payload = (await req.json()) as { email?: string; redirectTo?: string }
  } catch {
    return json(400, { error: 'JSON inválido' })
  }

  const email = normalizeEmail(payload.email)
  if (!email) {
    return json(400, { error: 'Correo inválido' })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return json(401, { error: 'Sesión inválida' })
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    return json(403, { error: 'Solo un administrador puede invitar usuarios' })
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const redirectTo =
    typeof payload.redirectTo === 'string' && payload.redirectTo.startsWith('https://')
      ? payload.redirectTo
      : undefined

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  })

  if (inviteError) {
    return json(400, { error: inviteError.message || 'No se pudo enviar la invitación' })
  }

  return json(200, { ok: true, email })
})
