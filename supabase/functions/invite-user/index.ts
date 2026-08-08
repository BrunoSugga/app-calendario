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

function isSafeRedirect(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'https:') return true
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function isAlreadyRegistered(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('already') ||
    msg.includes('registered') ||
    msg.includes('exists') ||
    msg.includes('duplicate')
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Método no permitido' })
  }

  try {
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
    const jwt = authHeader.slice('Bearer '.length).trim()
    if (!jwt) {
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

    const { data: userData, error: userError } = await userClient.auth.getUser(jwt)
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
      typeof payload.redirectTo === 'string' && isSafeRedirect(payload.redirectTo)
        ? payload.redirectTo
        : undefined

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    })

    if (!inviteError) {
      return json(200, { ok: true, email, mode: 'invite' })
    }

    // Ya existe (invite previo): reenviar link de recuperación para setear contraseña
    if (isAlreadyRegistered(inviteError.message || '')) {
      const { error: recoverError } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (recoverError) {
        return json(400, {
          error:
            recoverError.message ||
            'Ese correo ya tiene cuenta y no se pudo reenviar el enlace. Pedile “Olvidé mi contraseña”.',
        })
      }
      return json(200, { ok: true, email, mode: 'recovery_resent' })
    }

    return json(400, { error: inviteError.message || 'No se pudo enviar la invitación' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return json(500, { error: message })
  }
})
